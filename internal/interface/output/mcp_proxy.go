package output_itf

import "time"

type MCPAuthInfo struct {
	ServerName    string
	URL           string
	Authenticated bool
	InitializedAt time.Time
}

type MCPProxyServer interface {
	List() ([]*MCPAuthInfo, error)
	Authorize(server string) error // rfc 8252
	Request()                      //block method authorize of agent, to avoid agent-cached credentials
}
