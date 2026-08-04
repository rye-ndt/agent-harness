package mcp_proxy_helpers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"
)

type ProtectedResourceMetadata struct {
	Resource             string   `json:"resource"`
	AuthorizationServers []string `json:"authorization_servers"`
	ScopesSupported      []string `json:"scopes_supported"`
}

type AuthServerMetadata struct {
	Issuer                string   `json:"issuer"`
	AuthorizationEndpoint string   `json:"authorization_endpoint"`
	TokenEndpoint         string   `json:"token_endpoint"`
	RegistrationEndpoint  string   `json:"registration_endpoint"`
	ScopesSupported       []string `json:"scopes_supported"`
}

type ClientRegistration struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

type ClientRegistrationRequest struct {
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	ApplicationType         string   `json:"application_type"`
	Scope                   string   `json:"scope,omitempty"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	Scope        string `json:"scope"`
}

type AuthTarget struct {
	Meta     *AuthServerMetadata
	Resource string
	Scope    string
}

type CallbackResult struct {
	Code  string
	State string
	Err   error
}

// where do i authorize user, and how to trade code for token?
func Discover(httpCli input_itf.HttpCli, serverURL string) (*AuthTarget, error) {
	target := &AuthTarget{
		Resource: serverURL,
	}

	issuer := serverURL

	serverName := "oauth-protected-resource"

	for _, u := range URLStandards(serverURL, serverName) {
		prm := &ProtectedResourceMetadata{}

		if err := httpCli.GetJSON(u, prm); err != nil {
			continue
		}

		if len(prm.AuthorizationServers) == 0 {
			continue
		}

		issuer = prm.AuthorizationServers[0]

		if prm.Resource != "" {
			target.Resource = prm.Resource
		}

		target.Scope = strings.Join(prm.ScopesSupported, " ")

		break
	}

	authEndpoints := []string{
		"oauth-authorization-server",
		"openid-configuration",
	}

	for _, name := range authEndpoints {
		for _, u := range URLStandards(issuer, name) {
			meta := &AuthServerMetadata{}
			if err := httpCli.GetJSON(u, meta); err != nil {
				continue
			}
			if meta.AuthorizationEndpoint == "" || meta.TokenEndpoint == "" {
				continue
			}

			target.Meta = meta
			if target.Scope == "" {
				target.Scope = strings.Join(meta.ScopesSupported, " ")
			}

			return target, nil
		}
	}

	return nil, custom_error.TypedCritical(
		enums.ErrMcpDiscoveryFailed,
		"cannot discover oauth metadata for %s",
		serverURL,
	)
}

func URLStandards(raw, name string) []string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return nil
	}

	root := fmt.Sprintf("%s://%s", u.Scheme, u.Host)
	path := strings.Trim(u.Path, "/")

	if path == "" {
		return []string{fmt.Sprintf("%s/.well-known/%s", root, name)}
	}

	return []string{
		fmt.Sprintf("%s/.well-known/%s/%s", root, name, path),
		fmt.Sprintf("%s/%s/.well-known/%s", root, path, name),
		fmt.Sprintf("%s/.well-known/%s", root, name),
	}
}

func Register(
	httpCli input_itf.HttpCli,
	cfg *input_itf.MCPServersConfig,
	target *AuthTarget,
	redirectURI string,
) (*ClientRegistration, error) {
	if target.Meta.RegistrationEndpoint == "" {
		return nil, custom_error.TypedCritical(
			enums.ErrMcpRegistrationFailed,
			"%s does not support dynamic client registration",
			target.Meta.Issuer,
		)
	}

	body := &ClientRegistrationRequest{
		ClientName:              cfg.ClientName,
		RedirectURIs:            []string{redirectURI},
		GrantTypes:              []string{"authorization_code", "refresh_token"},
		ResponseTypes:           []string{"code"},
		TokenEndpointAuthMethod: "none",
		ApplicationType:         "native",
		Scope:                   target.Scope,
	}

	reg := &ClientRegistration{}

	if err := httpCli.PostJSON(target.Meta.RegistrationEndpoint, body, reg); err != nil {
		return nil, custom_error.TypedCritical(
			enums.ErrMcpRegistrationFailed,
			"cannot register client at %s: %v",
			target.Meta.RegistrationEndpoint,
			err,
		)
	}

	if reg.ClientID == "" {
		return nil, custom_error.TypedCritical(
			enums.ErrMcpRegistrationFailed,
			"registration at %s returned no client id",
			target.Meta.RegistrationEndpoint,
		)
	}

	return reg, nil
}

func ListenLoopback(cfg *input_itf.MCPServersConfig, host string) (*http.Server, string, <-chan *CallbackResult, error) {
	ln, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
	if err != nil {
		return nil, "", nil, err
	}

	addr, ok := ln.Addr().(*net.TCPAddr)
	if !ok {
		ln.Close()
		return nil, "", nil, custom_error.Critical("unexpected listener address %v", ln.Addr())
	}

	results := make(chan *CallbackResult, 1)

	srv := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != cfg.CallbackPath {
				http.NotFound(w, r)
				return
			}

			query := r.URL.Query()
			res := &CallbackResult{
				Code:  query.Get("code"),
				State: query.Get("state"),
			}

			if reason := query.Get("error"); reason != "" {
				res.Err = custom_error.TypedCritical(
					enums.ErrMcpAuthorizeFailed,
					"authorization rejected: %s %s",
					reason,
					query.Get("error_description"),
				)
			}

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			if res.Err != nil {
				w.Write([]byte(failurePage))
			} else {
				w.Write([]byte(successPage))
			}

			select {
			case results <- res:
			default:
			}
		}),
	}

	go srv.Serve(ln)

	redirectURI := fmt.Sprintf("http://%s%s", net.JoinHostPort(host, strconv.Itoa(addr.Port)), cfg.CallbackPath)

	return srv, redirectURI, results, nil
}

func ShutdownLoopback(cfg *input_itf.MCPServersConfig, srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownGrace)
	defer cancel()

	srv.Shutdown(ctx)
}

func AuthorizeURL(
	cfg *input_itf.MCPServersConfig,
	target *AuthTarget,
	reg *ClientRegistration,
	redirectURI, state, challenge string,
) string {
	query := url.Values{}
	query.Set("response_type", "code")
	query.Set("client_id", reg.ClientID)
	query.Set("redirect_uri", redirectURI)
	query.Set("state", state)
	query.Set("code_challenge", challenge)
	query.Set("code_challenge_method", cfg.ChallengeMethod)
	query.Set("resource", target.Resource)

	if target.Scope != "" {
		query.Set("scope", target.Scope)
	}

	separator := "?"
	if strings.Contains(target.Meta.AuthorizationEndpoint, "?") {
		separator = "&"
	}

	return target.Meta.AuthorizationEndpoint + separator + query.Encode()
}

func ExchangeCode(
	httpCli input_itf.HttpCli,
	target *AuthTarget,
	reg *ClientRegistration,
	redirectURI, code, verifier string,
) (*TokenResponse, error) {
	form := map[string]string{
		"grant_type":    "authorization_code",
		"code":          code,
		"redirect_uri":  redirectURI,
		"client_id":     reg.ClientID,
		"code_verifier": verifier,
		"resource":      target.Resource,
	}

	if reg.ClientSecret != "" {
		form["client_secret"] = reg.ClientSecret
	}

	token := &TokenResponse{}
	if err := httpCli.PostForm(target.Meta.TokenEndpoint, form, token); err != nil {
		return nil, custom_error.TypedCritical(
			enums.ErrMcpTokenExchange,
			"token exchange at %s failed: %v",
			target.Meta.TokenEndpoint,
			err,
		)
	}

	if token.AccessToken == "" {
		return nil, custom_error.TypedCritical(
			enums.ErrMcpTokenExchange,
			"token exchange at %s returned no access token",
			target.Meta.TokenEndpoint,
		)
	}

	return token, nil
}

func RandomURLSafe(size int) (string, error) {
	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}

func PKCEChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))

	return base64.RawURLEncoding.EncodeToString(sum[:])
}

const successPage = `<!doctype html><meta charset="utf-8"><title>Authorized</title>
<body style="font-family:system-ui;background:#1B2636;color:#e8eef7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Authorization complete</h2><p>You can close this tab and return to the app.</p></div>`

const failurePage = `<!doctype html><meta charset="utf-8"><title>Authorization failed</title>
<body style="font-family:system-ui;background:#1B2636;color:#e8eef7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Authorization failed</h2><p>You can close this tab and try again from the app.</p></div>`
