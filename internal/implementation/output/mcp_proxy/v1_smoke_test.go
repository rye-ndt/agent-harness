package mcp_proxy

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"
	"time"

	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/input/storage"
	mcp_helpers "hexago/internal/implementation/output/mcp_proxy/helpers"
	input_itf "hexago/internal/interface/input"
)

const (
	testClientID     = "test-client"
	testAccessToken  = "access-token-value"
	testRefreshToken = "refresh-token-value"
)

func testConfig() input_itf.MCPServersConfig {
	return input_itf.MCPServersConfig{
		EncodeKey:                "test-encode-key",
		AuthTimeout:              10 * time.Second,
		ClientName:               "master_harness",
		CallbackPath:             "/callback",
		ShutdownGrace:            2 * time.Second,
		VerifierBytes:            32,
		StateBytes:               16,
		MinVerifierBytes:         32,
		MinStateBytes:            16,
		DefaultTokenTTL:          time.Hour,
		ChallengeMethod:          "S256",
		SupportedChallengeMethod: "S256",
	}
}

func fakeAuthServer(t *testing.T) (*httptest.Server, *string) {
	t.Helper()

	challenge := ""
	mux := http.NewServeMux()
	srv := httptest.NewServer(mux)

	mux.HandleFunc("/.well-known/oauth-protected-resource", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"resource":              srv.URL,
			"authorization_servers": []string{srv.URL},
			"scopes_supported":      []string{"read", "write"},
		})
	})

	mux.HandleFunc("/.well-known/oauth-authorization-server", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"issuer":                 srv.URL,
			"authorization_endpoint": srv.URL + "/authorize",
			"token_endpoint":         srv.URL + "/token",
			"registration_endpoint":  srv.URL + "/register",
		})
	})

	mux.HandleFunc("/register", func(w http.ResponseWriter, r *http.Request) {
		body := map[string]any{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if body["token_endpoint_auth_method"] != "none" {
			http.Error(w, "expected a public client", http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"client_id": testClientID})
	})

	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if r.Form.Get("client_id") != testClientID {
			http.Error(w, "wrong client id", http.StatusBadRequest)
			return
		}
		if mcp_helpers.PKCEChallenge(r.Form.Get("code_verifier")) != challenge {
			http.Error(w, "pkce verification failed", http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{
			"access_token":  testAccessToken,
			"refresh_token": testRefreshToken,
			"token_type":    "Bearer",
			"expires_in":    3600,
		})
	})

	t.Cleanup(srv.Close)

	return srv, &challenge
}

func TestAuthorizeStoresEncryptedCredentials(t *testing.T) {
	srv, challenge := fakeAuthServer(t)

	store, err := storage.New(filepath.Join(t.TempDir(), "harness.db"))
	if err != nil {
		t.Fatalf("storage: %v", err)
	}

	cfg := testConfig()
	cfg.SupportedServers = map[string]*input_itf.MCPServerConfig{
		"atlassian": {Name: "atlassian", AuthKeyName: "ATLASSIAN_TOKEN", URL: srv.URL},
	}

	proxy, err := InitV1(
		&cfg,
		store.MCPStore(),
		http_cli.New(&http_cli.BasicHttpCliCfg{Timeout: 10 * time.Second}),
	)
	if err != nil {
		t.Fatalf("init: %v", err)
	}

	original := openBrowser
	t.Cleanup(func() { openBrowser = original })

	openBrowser = func(raw string) error {
		u, err := url.Parse(raw)
		if err != nil {
			return err
		}

		q := u.Query()
		*challenge = q.Get("code_challenge")

		if q.Get("code_challenge_method") != cfg.ChallengeMethod {
			t.Errorf("code_challenge_method = %q, want %q", q.Get("code_challenge_method"), cfg.ChallengeMethod)
		}
		if q.Get("resource") != srv.URL {
			t.Errorf("resource = %q, want %q", q.Get("resource"), srv.URL)
		}

		callback := q.Get("redirect_uri") + "?code=auth-code&state=" + url.QueryEscape(q.Get("state"))

		go func() {
			res, err := http.Get(callback)
			if err == nil {
				res.Body.Close()
			}
		}()

		return nil
	}

	if err := proxy.Authorize("atlassian"); err != nil {
		t.Fatalf("authorize: %v", err)
	}

	saved, err := store.MCPStore().GetCredentials("atlassian")
	if err != nil || saved == nil {
		t.Fatalf("get credentials: %v %v", saved, err)
	}

	if saved.ClientID != testClientID {
		t.Errorf("client id = %q, want %q", saved.ClientID, testClientID)
	}
	if saved.EncryptedOAuthKey == testAccessToken {
		t.Fatal("access token was stored in plaintext")
	}

	impl, ok := proxy.(*v1)
	if !ok {
		t.Fatal("unexpected proxy implementation")
	}

	decrypted, err := mcp_helpers.Decrypt(impl.aead, saved.EncryptedOAuthKey)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if decrypted != testAccessToken {
		t.Errorf("decrypted access token = %q, want %q", decrypted, testAccessToken)
	}

	refresh, err := mcp_helpers.Decrypt(impl.aead, saved.EncryptedRefreshKey)
	if err != nil {
		t.Fatalf("decrypt refresh: %v", err)
	}
	if refresh != testRefreshToken {
		t.Errorf("decrypted refresh token = %q, want %q", refresh, testRefreshToken)
	}

	list, err := proxy.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 || !list[0].Authenticated {
		t.Fatalf("list = %+v, want one authenticated entry", list)
	}
}

func TestAuthorizeUnknownServer(t *testing.T) {
	store, err := storage.New(filepath.Join(t.TempDir(), "harness.db"))
	if err != nil {
		t.Fatalf("storage: %v", err)
	}

	cfg := testConfig()

	proxy, err := InitV1(
		&cfg,
		store.MCPStore(),
		http_cli.New(&http_cli.BasicHttpCliCfg{Timeout: time.Second}),
	)
	if err != nil {
		t.Fatalf("init: %v", err)
	}

	if err := proxy.Authorize("nope"); err == nil {
		t.Fatal("expected an error for an unsupported server")
	}
}

func TestValidateConfig(t *testing.T) {
	valid, err := validate(testConfig())
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if valid.SupportedServers == nil {
		t.Error("supported servers map was not initialised")
	}

	cases := map[string]func(*input_itf.MCPServersConfig){
		"empty client name":     func(c *input_itf.MCPServersConfig) { c.ClientName = "" },
		"empty callback path":   func(c *input_itf.MCPServersConfig) { c.CallbackPath = "" },
		"missing auth timeout":  func(c *input_itf.MCPServersConfig) { c.AuthTimeout = 0 },
		"missing token ttl":     func(c *input_itf.MCPServersConfig) { c.DefaultTokenTTL = 0 },
		"missing minimums":      func(c *input_itf.MCPServersConfig) { c.MinVerifierBytes = 0 },
		"unsupported challenge": func(c *input_itf.MCPServersConfig) { c.ChallengeMethod = "plain" },
		"short verifier":        func(c *input_itf.MCPServersConfig) { c.VerifierBytes = 8 },
		"short state":           func(c *input_itf.MCPServersConfig) { c.StateBytes = 4 },
	}

	for name, mutate := range cases {
		cfg := testConfig()
		mutate(&cfg)

		if _, err := validate(cfg); err == nil {
			t.Errorf("expected %s to be rejected", name)
		}
	}
}
