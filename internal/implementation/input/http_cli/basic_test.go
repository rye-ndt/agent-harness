package http_cli

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestReachableAcceptsNonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	cli := New(&BasicHttpCliCfg{Timeout: 5 * time.Second})

	if err := cli.Reachable(server.URL); err != nil {
		t.Fatalf("a 404 means the host answered, want nil, got %v", err)
	}
}

func TestReachableFailsWhenHostIsDown(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := server.URL
	server.Close()

	cli := New(&BasicHttpCliCfg{Timeout: 5 * time.Second})

	if err := cli.Reachable(url); err == nil {
		t.Fatal("want an error when nothing is listening")
	}
}
