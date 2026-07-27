package output_itf

import (
	"io"
	"net/http"
	"time"
)

type MCPAuthInfo struct {
	ServerName    string
	URL           string
	Authenticated bool
	InitializedAt time.Time
}

type MCPResponse struct {
	StatusCode int
	Header     http.Header
	Body       io.ReadCloser
}

type MCPProxyServer interface {
	List() ([]*MCPAuthInfo, error)
	Authorize(server string) error // rfc 8252
	Request(server string, header http.Header, body io.Reader) (*MCPResponse, error)
}
