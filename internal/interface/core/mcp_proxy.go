package core_itf

import (
	"io"
	"net/http"
	"time"
)

type MCPAuthInfo struct {
	ServerName    string
	Kind          string
	URL           string
	Authenticated bool
	InitializedAt time.Time
}

type MCPResponse struct {
	StatusCode int
	Header     http.Header
	Body       io.ReadCloser
}

type MCPGatewayServer struct {
	Name        string
	AuthKeyName string
}

type MCPGateway struct {
	BaseURL     string
	Token       string
	TokenHeader string
	Servers     []MCPGatewayServer
}

type MCPProxyServer interface {
	List() ([]*MCPAuthInfo, error)
	Authorize(server string) error // rfc 8252
	SetCredential(server, secret string) error
	Request(server string, header http.Header, body io.Reader) (*MCPResponse, error)
	Serve() (*MCPGateway, error)
	Close() error
}
