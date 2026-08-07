package mcp_proxy

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"hexago/internal/helpers"
	mcp_helpers "hexago/internal/implementation/core/mcp_proxy/helpers"
	input_itf "hexago/internal/interface/input"
)

type fakeMCPStore struct {
	mu      sync.Mutex
	entries map[string]*input_itf.MCPEntity
}

func newFakeMCPStore() *fakeMCPStore {
	return &fakeMCPStore{entries: map[string]*input_itf.MCPEntity{}}
}

func (s *fakeMCPStore) ListAuthenticated() ([]*input_itf.MCPEntity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := make([]*input_itf.MCPEntity, 0, len(s.entries))
	for _, entry := range s.entries {
		list = append(list, entry)
	}

	return list, nil
}

func (s *fakeMCPStore) UpsertCredentials(mcp *input_itf.MCPEntity) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.entries[mcp.Name] = mcp

	return nil
}

func (s *fakeMCPStore) GetCredentials(name string) (*input_itf.MCPEntity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.entries[name], nil
}

func (s *fakeMCPStore) DeleteCredentials(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.entries, name)

	return nil
}

type fakeHttpCli struct {
	body       string
	statusCode int
	gotHeader  http.Header
	gotURL     string
}

func (c *fakeHttpCli) Reachable(url string) error { return nil }

func (c *fakeHttpCli) GetString(url string) (string, error) { return "", nil }

func (c *fakeHttpCli) GetJSON(url string, v any) error { return nil }

func (c *fakeHttpCli) PostForm(url string, form map[string]string, v any) error { return nil }

func (c *fakeHttpCli) PostJSON(url string, body any, v any) error { return nil }

func (c *fakeHttpCli) Download(url, path string, p *input_itf.DownloadParams) error { return nil }

func (c *fakeHttpCli) Stream(req *input_itf.HttpRequest) (*input_itf.HttpResponse, error) {
	c.gotURL = req.URL
	c.gotHeader = req.Header

	return &input_itf.HttpResponse{
		StatusCode: c.statusCode,
		Body:       io.NopCloser(strings.NewReader(c.body)),
	}, nil
}

func newTestProxy(t *testing.T, db input_itf.StorageMCP, httpCli input_itf.HttpCli) *v1 {
	t.Helper()

	cfg := &input_itf.MCPServersConfig{
		EncodeKey: "sk-test",
		SupportedServers: map[string]*input_itf.MCPServerConfig{
			"atlassian": {
				Name:     "atlassian",
				URL:      "https://mcp.atlassian.com/v1/mcp",
				AuthFlow: "dcr",
			},
		},
		DefaultTokenTTL: time.Hour,
	}

	proxy, err := InitV1(cfg, db, httpCli, nil, nil)
	if err != nil {
		t.Fatalf("init proxy: %v", err)
	}

	return proxy.(*v1)
}

func TestRevokeClearsStoredAndCachedCredentials(t *testing.T) {
	db := newFakeMCPStore()
	proxy := newTestProxy(t, db, &fakeHttpCli{})

	if err := db.UpsertCredentials(&input_itf.MCPEntity{
		Name:              "atlassian",
		EncryptedOAuthKey: "cipher",
		Account:           "rye@nexo.dev",
		ExpiredAt:         helpers.NewUTC().Add(time.Hour),
	}); err != nil {
		t.Fatalf("seed credentials: %v", err)
	}

	proxy.cache("atlassian", &cred{token: "secret", expiredAt: helpers.NewUTC().Add(time.Hour)})

	if err := proxy.Revoke("atlassian"); err != nil {
		t.Fatalf("revoke: %v", err)
	}

	stored, err := db.GetCredentials("atlassian")
	if err != nil {
		t.Fatalf("get credentials: %v", err)
	}

	if stored != nil {
		t.Fatalf("credentials survived the revoke: %+v", stored)
	}

	if cached := proxy.cached("atlassian"); cached != nil {
		t.Fatal("revoke left a usable token in the in-memory cache")
	}

	servers, err := proxy.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}

	if len(servers) != 1 {
		t.Fatalf("list returned %d servers, want 1", len(servers))
	}

	if servers[0].Authenticated {
		t.Fatal("server still reports as authorized after a revoke")
	}

	if servers[0].Account != "" {
		t.Fatalf("account = %q, want it cleared with the credential", servers[0].Account)
	}

	if err := proxy.Revoke("atlassian"); err != nil {
		t.Fatalf("a second revoke should be a no-op, got: %v", err)
	}
}

func TestRevokeRejectsUnknownServer(t *testing.T) {
	proxy := newTestProxy(t, newFakeMCPStore(), &fakeHttpCli{})

	if err := proxy.Revoke("nope"); err == nil {
		t.Fatal("revoking a server that is not in config.yaml should fail")
	}
}

func TestListReportsTheAccountOfAnAuthorizedServer(t *testing.T) {
	db := newFakeMCPStore()
	proxy := newTestProxy(t, db, &fakeHttpCli{})

	if err := db.UpsertCredentials(&input_itf.MCPEntity{
		Name:              "atlassian",
		EncryptedOAuthKey: "cipher",
		Account:           "rye@nexo.dev",
		ExpiredAt:         helpers.NewUTC().Add(time.Hour),
	}); err != nil {
		t.Fatalf("seed credentials: %v", err)
	}

	servers, err := proxy.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}

	if !servers[0].Authenticated || servers[0].Account != "rye@nexo.dev" {
		t.Fatalf("list returned %+v, want an authorized server owned by rye@nexo.dev", servers[0])
	}
}

func TestListHidesTheAccountOfAnExpiredCredential(t *testing.T) {
	db := newFakeMCPStore()
	proxy := newTestProxy(t, db, &fakeHttpCli{})

	if err := db.UpsertCredentials(&input_itf.MCPEntity{
		Name:              "atlassian",
		EncryptedOAuthKey: "cipher",
		Account:           "rye@nexo.dev",
		ExpiredAt:         helpers.NewUTC().Add(-time.Hour),
	}); err != nil {
		t.Fatalf("seed credentials: %v", err)
	}

	servers, err := proxy.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}

	if servers[0].Authenticated {
		t.Fatal("an expired credential should not read as authorized")
	}

	if servers[0].Account != "" {
		t.Fatalf("account = %q, want nothing for an expired credential", servers[0].Account)
	}
}

func TestFetchAccountReadsTheFirstFieldThatIsPresent(t *testing.T) {
	httpCli := &fakeHttpCli{statusCode: http.StatusOK, body: `{"email":"","name":"Rye Nakamura"}`}

	account := mcp_helpers.FetchAccount(httpCli, &input_itf.MCPAccountConfig{
		URL:    "https://api.atlassian.com/me",
		Header: "Authorization",
		Scheme: "Bearer",
		Fields: []string{"email", "name"},
	}, "token-123")

	if account != "Rye Nakamura" {
		t.Fatalf("account = %q, want the name once email came back empty", account)
	}

	if got := httpCli.gotHeader.Get("Authorization"); got != "Bearer token-123" {
		t.Fatalf("Authorization = %q, want the scheme joined to the token", got)
	}
}

func TestFetchAccountSendsABareTokenWhenNoSchemeIsConfigured(t *testing.T) {
	httpCli := &fakeHttpCli{statusCode: http.StatusOK, body: `{"handle":"rye"}`}

	account := mcp_helpers.FetchAccount(httpCli, &input_itf.MCPAccountConfig{
		URL:    "https://api.figma.com/v1/me",
		Header: "X-Figma-Token",
		Fields: []string{"email", "handle"},
	}, "figd_abc")

	if account != "rye" {
		t.Fatalf("account = %q, want rye", account)
	}

	if got := httpCli.gotHeader.Get("X-Figma-Token"); got != "figd_abc" {
		t.Fatalf("X-Figma-Token = %q, want the bare token", got)
	}
}

func TestFetchAccountStaysEmptyWhenTheLookupFails(t *testing.T) {
	cfg := &input_itf.MCPAccountConfig{
		URL:    "https://api.github.com/user",
		Header: "Authorization",
		Scheme: "Bearer",
		Fields: []string{"login"},
	}

	forbidden := &fakeHttpCli{statusCode: http.StatusForbidden, body: `{"message":"Bad credentials"}`}
	if account := mcp_helpers.FetchAccount(forbidden, cfg, "token"); account != "" {
		t.Fatalf("account = %q, want nothing when the endpoint rejects the token", account)
	}

	garbage := &fakeHttpCli{statusCode: http.StatusOK, body: `<html>not json</html>`}
	if account := mcp_helpers.FetchAccount(garbage, cfg, "token"); account != "" {
		t.Fatalf("account = %q, want nothing when the body is not json", account)
	}

	if account := mcp_helpers.FetchAccount(garbage, nil, "token"); account != "" {
		t.Fatalf("account = %q, want nothing when the server configures no lookup", account)
	}
}
