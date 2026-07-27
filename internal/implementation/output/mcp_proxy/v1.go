package mcp_proxy

import (
	"crypto/cipher"
	"crypto/subtle"
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

type v1 struct {
	locker  sync.RWMutex
	aead    cipher.AEAD
	cfg     input_itf.MCPServersConfig
	creds   map[string]string
	httpCli input_itf.HttpCli
	db      input_itf.StorageMCP
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

	return &v1{
		locker:  sync.RWMutex{},
		aead:    aead,
		cfg:     validated,
		creds:   map[string]string{},
		httpCli: httpCli,
		db:      db,
	}, nil
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

	if err := s.db.UpsertCredentials(&input_itf.MCPEntity{
		Name:                name,
		ClientID:            reg.ClientID,
		TokenEndpoint:       target.Meta.TokenEndpoint,
		EncryptedOAuthKey:   encryptedAccess,
		EncryptedRefreshKey: encryptedRefresh,
		ExpiredAt:           now.Add(ttl),
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

	s.locker.Lock()
	s.creds[name] = token.AccessToken
	s.locker.Unlock()

	return nil
}

func (s *v1) Request() {}
