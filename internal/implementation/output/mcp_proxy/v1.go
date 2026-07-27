package mcp_proxy

import (
	"bytes"
	"crypto/cipher"
	"crypto/subtle"
	"io"
	"net/http"
	"sync"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	mcp_helpers "hexago/internal/implementation/output/mcp_proxy/helpers"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/pkg/browser"
)

var openBrowser = browser.OpenURL

type cred struct {
	token     string
	endpoint  string
	expiredAt time.Time
}

type v1 struct {
	locker       sync.RWMutex
	aead         cipher.AEAD
	cfg          input_itf.MCPServersConfig
	serverToCred map[string]*cred
	httpCli      input_itf.HttpCli
	db           input_itf.StorageMCP
}

func InitV1(
	cfg *input_itf.MCPServersConfig,
	db input_itf.StorageMCP,
	httpCli input_itf.HttpCli,
) (output_itf.MCPProxyServer, error) {
	aead, err := mcp_helpers.NewCipher(cfg.EncodeKey)
	if err != nil {
		return nil, custom_error.Critical("cannot build mcp credential cipher: %v", err)
	}

	validated, err := validate(*cfg)
	if err != nil {
		return nil, err
	}

	s := &v1{
		locker:       sync.RWMutex{},
		aead:         aead,
		cfg:          validated,
		serverToCred: map[string]*cred{},
		httpCli:      httpCli,
		db:           db,
	}

	if err := s.loadCredentials(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *v1) loadCredentials() error {
	stored, err := s.db.ListAuthenticated()
	if err != nil {
		return custom_error.TypedCritical(enums.ErrCannotGetAuthInfo, "cannot load mcp creds: %v", err)
	}

	supported := map[string]any{}
	for _, server := range s.cfg.SupportedServers {
		supported[server.Name] = struct{}{}
	}

	now := helpers.NewUTC()

	for _, m := range stored {
		if _, found := supported[m.Name]; !found {
			continue
		}

		if !m.ExpiredAt.After(now) {
			continue
		}

		token, err := mcp_helpers.Decrypt(s.aead, m.EncryptedOAuthKey)
		if err != nil {
			continue
		}

		s.serverToCred[m.Name] = &cred{
			token:     token,
			endpoint:  m.TokenEndpoint,
			expiredAt: m.ExpiredAt,
		}
	}

	return nil
}

func validate(cfg input_itf.MCPServersConfig) (input_itf.MCPServersConfig, error) {
	if cfg.SupportedServers == nil {
		cfg.SupportedServers = map[string]*input_itf.MCPServerConfig{}
	}

	if cfg.ClientName == "" || cfg.CallbackPath == "" ||
		cfg.ChallengeMethod == "" || cfg.SupportedChallengeMethod == "" {
		return cfg, custom_error.Critical(
			"mcp client_name, callback_path, challenge_method and supported_challenge_method must be configured",
		)
	}

	if cfg.AuthTimeout <= 0 || cfg.ShutdownGrace <= 0 || cfg.DefaultTokenTTL <= 0 {
		return cfg, custom_error.Critical(
			"mcp auth_timeout, shutdown_grace and default_token_ttl must be positive durations",
		)
	}

	if cfg.MinVerifierBytes <= 0 || cfg.MinStateBytes <= 0 {
		return cfg, custom_error.Critical(
			"mcp min_verifier_bytes and min_state_bytes must be positive",
		)
	}

	if cfg.ChallengeMethod != cfg.SupportedChallengeMethod {
		return cfg, custom_error.Critical(
			"mcp challenge_method %q is not supported, only %s is implemented",
			cfg.ChallengeMethod,
			cfg.SupportedChallengeMethod,
		)
	}

	if cfg.VerifierBytes < cfg.MinVerifierBytes {
		return cfg, custom_error.Critical(
			"mcp verifier_bytes must be at least %d, got %d",
			cfg.MinVerifierBytes,
			cfg.VerifierBytes,
		)
	}

	if cfg.StateBytes < cfg.MinStateBytes {
		return cfg, custom_error.Critical(
			"mcp state_bytes must be at least %d, got %d",
			cfg.MinStateBytes,
			cfg.StateBytes,
		)
	}

	for key, server := range cfg.SupportedServers {
		if server == nil || server.Name == "" || server.URL == "" || server.AuthKeyName == "" {
			return cfg, custom_error.Critical(
				"mcp server %q must configure name, url and auth_key_name",
				key,
			)
		}

		if err := mcp_helpers.RejectAuthRequest(server.URL, ""); err != nil {
			return cfg, custom_error.Critical("mcp server %q has an invalid url: %v", key, err)
		}
	}

	return cfg, nil
}

func (s *v1) List() ([]*output_itf.MCPAuthInfo, error) {
	authenticatedList, err := s.db.ListAuthenticated()
	if err != nil {
		return nil, custom_error.TypedCritical(
			enums.ErrCannotGetAuthInfo,
			"cannot get mcp auth info",
		)
	}

	mappedAuthList := helpers.SliceToMap(authenticatedList, func(item *input_itf.MCPEntity) (string, *input_itf.MCPEntity) {
		return item.Name, item
	})

	resp := []*output_itf.MCPAuthInfo{}

	for _, m := range s.cfg.SupportedServers {

		item := &output_itf.MCPAuthInfo{
			ServerName:    m.Name,
			URL:           m.URL,
			Authenticated: false,
			InitializedAt: time.Time{},
		}

		info, found := mappedAuthList[m.Name]
		if found {
			item.Authenticated = info.ExpiredAt.After(helpers.NewUTC())
			item.InitializedAt = info.UpdatedAt
		}

		resp = append(resp, item)
	}

	return resp, nil
}

func (s *v1) Authorize(server string) error {
	mcp, found := s.cfg.SupportedServers[server]
	if !found {
		return custom_error.TypedCritical(enums.ErrMcpNotFound, "mcp %s not found", server)
	}

	target, err := mcp_helpers.Discover(s.httpCli, mcp.URL)
	if err != nil {
		return err
	}

	srv, redirectURI, callbacks, err := mcp_helpers.ListenLoopback(&s.cfg)
	if err != nil {
		return custom_error.TypedCritical(
			enums.ErrMcpAuthorizeFailed,
			"cannot start loopback listener: %v",
			err,
		)
	}

	defer mcp_helpers.ShutdownLoopback(&s.cfg, srv)

	reg, err := mcp_helpers.Register(s.httpCli, &s.cfg, target, redirectURI)
	if err != nil {
		return err
	}

	verifier, err := mcp_helpers.RandomURLSafe(s.cfg.VerifierBytes)
	if err != nil {
		return custom_error.TypedCritical(enums.ErrMcpAuthorizeFailed, "cannot generate verifier: %v", err)
	}

	state, err := mcp_helpers.RandomURLSafe(s.cfg.StateBytes)
	if err != nil {
		return custom_error.TypedCritical(enums.ErrMcpAuthorizeFailed, "cannot generate state: %v", err)
	}

	authURL := mcp_helpers.AuthorizeURL(&s.cfg, target, reg, redirectURI, state, mcp_helpers.PKCEChallenge(verifier))
	if err := openBrowser(authURL); err != nil {
		return custom_error.TypedCritical(enums.ErrMcpAuthorizeFailed, "cannot open browser: %v", err)
	}

	result := &mcp_helpers.CallbackResult{}

	select {
	case result = <-callbacks:
	case <-time.After(s.cfg.AuthTimeout):
		return custom_error.TypedCritical(
			enums.ErrMcpAuthorizeTimeout,
			"authorization for %s timed out after %s",
			server,
			s.cfg.AuthTimeout,
		)
	}

	if result.Err != nil {
		return result.Err
	}

	if subtle.ConstantTimeCompare([]byte(result.State), []byte(state)) != 1 {
		return custom_error.TypedCritical(enums.ErrMcpAuthorizeFailed, "state mismatch on %s callback", server)
	}

	if result.Code == "" {
		return custom_error.TypedCritical(enums.ErrMcpAuthorizeFailed, "no authorization code in %s callback", server)
	}

	token, err := mcp_helpers.ExchangeCode(s.httpCli, target, reg, redirectURI, result.Code, verifier)
	if err != nil {
		return err
	}

	return s.storeToken(mcp.Name, target, reg, token)
}

func (s *v1) storeToken(
	name string,
	target *mcp_helpers.AuthTarget,
	reg *mcp_helpers.ClientRegistration,
	token *mcp_helpers.TokenResponse,
) error {
	encryptedAccess, err := mcp_helpers.Encrypt(s.aead, token.AccessToken)
	if err != nil {
		return err
	}

	encryptedRefresh, err := mcp_helpers.Encrypt(s.aead, token.RefreshToken)
	if err != nil {
		return err
	}

	now := helpers.NewUTC()

	ttl := time.Duration(token.ExpiresIn) * time.Second
	if token.ExpiresIn <= 0 {
		ttl = s.cfg.DefaultTokenTTL
	}

	expiredAt := now.Add(ttl)

	if err := s.db.UpsertCredentials(&input_itf.MCPEntity{
		Name:                name,
		ClientID:            reg.ClientID,
		TokenEndpoint:       target.Meta.TokenEndpoint,
		EncryptedOAuthKey:   encryptedAccess,
		EncryptedRefreshKey: encryptedRefresh,
		ExpiredAt:           expiredAt,
		CreatedAt:           now,
		UpdatedAt:           now,
	}); err != nil {
		return custom_error.TypedCritical(
			enums.ErrMcpStoreCredentials,
			"cannot store credentials for %s: %v",
			name,
			err,
		)
	}

	s.cache(name, &cred{
		token:     token.AccessToken,
		endpoint:  target.Meta.TokenEndpoint,
		expiredAt: expiredAt,
	})

	return nil
}

func (s *v1) Request(server string, header http.Header, body io.Reader) (*output_itf.MCPResponse, error) {
	mcp, found := s.cfg.SupportedServers[server]
	if !found {
		return nil, custom_error.TypedCritical(enums.ErrMcpNotFound, "mcp %s not found", server)
	}

	cred, err := s.credentials(mcp.Name)
	if err != nil {
		return nil, err
	}

	if err := mcp_helpers.RejectAuthRequest(mcp.URL, cred.endpoint); err != nil {
		return nil, err
	}

	forwardBody, err := mcp_helpers.ForwardBody(body, mcp.AuthKeyName, cred.token)
	if err != nil {
		return nil, err
	}

	req := &input_itf.HttpRequest{
		Method: http.MethodGet,
		URL:    mcp.URL,
		Header: mcp_helpers.ForwardHeader(header, mcp.AuthKeyName, cred.token),
	}

	if forwardBody != nil {
		req.Method = http.MethodPost
		req.Body = bytes.NewReader(forwardBody)
	}

	res, err := s.httpCli.Stream(req)
	if err != nil {
		return nil, custom_error.TypedCritical(
			enums.ErrMcpRequestFailed,
			"cannot forward request to %s: %v",
			mcp.Name,
			err,
		)
	}

	return &output_itf.MCPResponse{
		StatusCode: res.StatusCode,
		Header:     res.Header,
		Body:       res.Body,
	}, nil
}

func (s *v1) credentials(name string) (*cred, error) {
	if cred := s.cached(name); cred != nil {
		return cred, nil
	}

	stored, err := s.db.GetCredentials(name)
	if err != nil {
		return nil, custom_error.TypedCritical(enums.ErrCannotGetAuthInfo, "cannot get credentials for %s: %v", name, err)
	}

	if stored == nil || stored.EncryptedOAuthKey == "" {
		return nil, custom_error.TypedCritical(enums.ErrMcpNotAuthenticated, "%s is not authenticated, authorize it first", name)
	}

	if !stored.ExpiredAt.After(helpers.NewUTC()) {
		return nil, custom_error.TypedCritical(enums.ErrMcpCredentialsExpired, "credentials for %s expired at %s, authorize it again", name, stored.ExpiredAt)
	}

	accessToken, err := mcp_helpers.Decrypt(s.aead, stored.EncryptedOAuthKey)
	if err != nil {
		return nil, err
	}

	cred := &cred{
		token:     accessToken,
		endpoint:  stored.TokenEndpoint,
		expiredAt: stored.ExpiredAt,
	}

	s.cache(name, cred)

	return cred, nil
}

func (s *v1) cached(name string) *cred {
	s.locker.RLock()
	cred, found := s.serverToCred[name]
	s.locker.RUnlock()

	if !found || !cred.expiredAt.After(helpers.NewUTC()) {
		return nil
	}

	return cred
}

func (s *v1) cache(name string, cred *cred) {
	s.locker.Lock()
	s.serverToCred[name] = cred
	s.locker.Unlock()
}
