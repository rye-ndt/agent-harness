package mcp_proxy

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/input/storage"
	mcp_helpers "hexago/internal/implementation/output/mcp_proxy/helpers"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

const (
	testClientID     = "test-client"
	testAccessToken  = "access-token-value"
	testRefreshToken = "refresh-token-value"
	testAuthKeyName  = "ThisIsTheKey"
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

	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+testAccessToken {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}
		if strings.Contains(string(body), testAuthKeyName) {
			http.Error(w, "placeholder reached the upstream server", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte("data: " + string(body) + "\n\n"))
	})

	t.Cleanup(srv.Close)

	return srv, &challenge
}

func stubBrowser(t *testing.T, challenge *string, inspect func(url.Values)) {
	t.Helper()

	original := openBrowser
	t.Cleanup(func() { openBrowser = original })

	openBrowser = func(raw string) error {
		u, err := url.Parse(raw)
		if err != nil {
			return err
		}

		q := u.Query()
		*challenge = q.Get("code_challenge")

		if inspect != nil {
			inspect(q)
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

	stubBrowser(t, challenge, func(q url.Values) {
		if q.Get("code_challenge_method") != cfg.ChallengeMethod {
			t.Errorf("code_challenge_method = %q, want %q", q.Get("code_challenge_method"), cfg.ChallengeMethod)
		}
		if q.Get("resource") != srv.URL {
			t.Errorf("resource = %q, want %q", q.Get("resource"), srv.URL)
		}
	})

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

func newProxy(t *testing.T, mcpURL string) (output_itf.MCPProxyServer, input_itf.StorageMCP) {
	t.Helper()

	store, err := storage.New(filepath.Join(t.TempDir(), "harness.db"))
	if err != nil {
		t.Fatalf("storage: %v", err)
	}

	return newProxyOn(t, mcpURL, store.MCPStore()), store.MCPStore()
}

func newProxyOn(t *testing.T, mcpURL string, store input_itf.StorageMCP) output_itf.MCPProxyServer {
	t.Helper()

	cfg := testConfig()
	cfg.SupportedServers = map[string]*input_itf.MCPServerConfig{
		"atlassian": {Name: "atlassian", AuthKeyName: testAuthKeyName, URL: mcpURL},
	}

	proxy, err := InitV1(
		&cfg,
		store,
		http_cli.New(&http_cli.BasicHttpCliCfg{Timeout: 10 * time.Second}),
	)
	if err != nil {
		t.Fatalf("init: %v", err)
	}

	return proxy
}

func TestRequestSubstitutesCredentials(t *testing.T) {
	srv, challenge := fakeAuthServer(t)

	proxy, _ := newProxy(t, srv.URL+"/mcp")

	stubBrowser(t, challenge, nil)

	if err := proxy.Authorize("atlassian"); err != nil {
		t.Fatalf("authorize: %v", err)
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+testAuthKeyName)
	header.Set("Content-Length", "999")
	header.Set("Connection", "close")

	res, err := proxy.Request(
		"atlassian",
		header,
		strings.NewReader(`{"method":"tools/list","secret":"`+testAuthKeyName+`"}`),
	)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusAccepted)
	}
	if got := res.Header.Get("Content-Type"); got != "text/event-stream" {
		t.Errorf("content type = %q, want text/event-stream", got)
	}

	payload, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if !strings.Contains(string(payload), testAccessToken) {
		t.Errorf("body %q does not contain the substituted token", payload)
	}
	if strings.Contains(string(payload), testAuthKeyName) {
		t.Errorf("body %q still contains the placeholder", payload)
	}
}

func TestRequestUsesCachedCredentials(t *testing.T) {
	srv, challenge := fakeAuthServer(t)

	proxy, store := newProxy(t, srv.URL+"/mcp")

	stubBrowser(t, challenge, nil)

	if err := proxy.Authorize("atlassian"); err != nil {
		t.Fatalf("authorize: %v", err)
	}

	saved, err := store.GetCredentials("atlassian")
	if err != nil {
		t.Fatalf("get credentials: %v", err)
	}

	saved.EncryptedOAuthKey = ""
	if err := store.UpsertCredentials(saved); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+testAuthKeyName)

	res, err := proxy.Request("atlassian", header, strings.NewReader(`{"method":"tools/list"}`))
	if err != nil {
		t.Fatalf("request after the stored token was cleared: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusAccepted)
	}
}

func TestInitLoadsStoredCredentials(t *testing.T) {
	srv, challenge := fakeAuthServer(t)

	proxy, store := newProxy(t, srv.URL+"/mcp")

	stubBrowser(t, challenge, nil)

	if err := proxy.Authorize("atlassian"); err != nil {
		t.Fatalf("authorize: %v", err)
	}

	restarted := newProxyOn(t, srv.URL+"/mcp", store)

	saved, err := store.GetCredentials("atlassian")
	if err != nil {
		t.Fatalf("get credentials: %v", err)
	}

	saved.EncryptedOAuthKey = ""
	if err := store.UpsertCredentials(saved); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+testAuthKeyName)

	res, err := restarted.Request("atlassian", header, strings.NewReader(`{"method":"tools/list"}`))
	if err != nil {
		t.Fatalf("request on a restarted proxy: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusAccepted)
	}
}

func TestRequestWithoutCredentials(t *testing.T) {
	srv, _ := fakeAuthServer(t)

	proxy, _ := newProxy(t, srv.URL+"/mcp")

	if _, err := proxy.Request("atlassian", http.Header{}, nil); err == nil {
		t.Fatal("expected an error for an unauthenticated server")
	}

	if _, err := proxy.Request("nope", http.Header{}, nil); err == nil {
		t.Fatal("expected an error for an unsupported server")
	}
}

func TestRejectAuthRequest(t *testing.T) {
	blocked := []string{
		"https://mcp.example.com/.well-known/oauth-protected-resource",
		"https://mcp.example.com/oauth/token",
		"https://mcp.example.com/authorize",
		"https://mcp.example.com/v1/register",
		"not a url",
	}

	for _, raw := range blocked {
		if err := mcp_helpers.RejectAuthRequest(raw, ""); err == nil {
			t.Errorf("expected %s to be rejected", raw)
		}
	}

	if err := mcp_helpers.RejectAuthRequest("https://mcp.example.com/mcp", ""); err != nil {
		t.Errorf("expected the mcp endpoint to be allowed: %v", err)
	}

	if err := mcp_helpers.RejectAuthRequest(
		"https://mcp.example.com/mcp",
		"https://mcp.example.com/mcp/",
	); err == nil {
		t.Error("expected the token endpoint to be rejected")
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
		"missing auth key name": func(c *input_itf.MCPServersConfig) {
			c.SupportedServers = map[string]*input_itf.MCPServerConfig{
				"atlassian": {Name: "atlassian", URL: "https://mcp.example.com/mcp"},
			}
		},
		"auth endpoint url": func(c *input_itf.MCPServersConfig) {
			c.SupportedServers = map[string]*input_itf.MCPServerConfig{
				"atlassian": {Name: "atlassian", AuthKeyName: testAuthKeyName, URL: "https://mcp.example.com/oauth/token"},
			}
		},
	}

	for name, mutate := range cases {
		cfg := testConfig()
		mutate(&cfg)

		if _, err := validate(cfg); err == nil {
			t.Errorf("expected %s to be rejected", name)
		}
	}
}
