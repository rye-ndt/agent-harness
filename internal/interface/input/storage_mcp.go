package input_itf

import "time"

type MCPEntity struct {
	Name                string
	ClientID            string
	TokenEndpoint       string
	EncryptedOAuthKey   string
	EncryptedRefreshKey string
	Account             string
	ExpiredAt           time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type StorageMCP interface {
	ListAuthenticated() ([]*MCPEntity, error)
	UpsertCredentials(mcp *MCPEntity) error
	GetCredentials(name string) (*MCPEntity, error)
	DeleteCredentials(name string) error
}
