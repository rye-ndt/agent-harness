package input_itf

import (
	"time"

	"hexago/internal/helpers/enums"
)

type AppConfig struct {
	Name string `mapstructure:"name" validate:"required"`
	W    int    `mapstructure:"w" validate:"gt=0"`
	H    int    `mapstructure:"h" validate:"gt=0"`
	Bg   string `mapstructure:"bg" validate:"required,hexcolor"`
}

type SessionConfig struct {
	HeartbeatTimeout      time.Duration `mapstructure:"heartbeat_timeout" validate:"gt=0"`
	HeartbeatScanInterval time.Duration `mapstructure:"heartbeat_scan_interval" validate:"gt=0,ltefield=HeartbeatTimeout"`
}

type MCPServerConfig struct {
	Name        string `mapstructure:"name" validate:"required"`
	AuthKeyName string `mapstructure:"auth_key_name" validate:"required"`
	URL         string `mapstructure:"url" validate:"required,http_url"`
}

type MCPServersConfig struct {
	SupportedServers         map[string]*MCPServerConfig `mapstructure:"supported_servers" validate:"dive,required"`
	EncodeKey                string                      `mapstructure:"encode_key" validate:"required"`
	AuthTimeout              time.Duration               `mapstructure:"auth_timeout" validate:"gt=0"`
	ClientName               string                      `mapstructure:"client_name" validate:"required"`
	CallbackPath             string                      `mapstructure:"callback_path" validate:"required,startswith=/"`
	ShutdownGrace            time.Duration               `mapstructure:"shutdown_grace" validate:"gt=0"`
	VerifierBytes            int                         `mapstructure:"verifier_bytes" validate:"gtefield=MinVerifierBytes"`
	StateBytes               int                         `mapstructure:"state_bytes" validate:"gtefield=MinStateBytes"`
	MinVerifierBytes         int                         `mapstructure:"min_verifier_bytes" validate:"gt=0"`
	MinStateBytes            int                         `mapstructure:"min_state_bytes" validate:"gt=0"`
	DefaultTokenTTL          time.Duration               `mapstructure:"default_token_ttl" validate:"gt=0"`
	ChallengeMethod          string                      `mapstructure:"challenge_method" validate:"required,eqfield=SupportedChallengeMethod"`
	SupportedChallengeMethod string                      `mapstructure:"supported_challenge_method" validate:"required"`
}

type ConfigStruct struct {
	App          *AppConfig                            `mapstructure:"app" validate:"required"`
	Version      string                                `mapstructure:"version" validate:"required"`
	LogLevel     string                                `mapstructure:"log_level" validate:"required,oneof=debug info warn error"`
	Session      *SessionConfig                        `mapstructure:"session" validate:"required"`
	MCPServers   *MCPServersConfig                     `mapstructure:"mcp_servers" validate:"required"`
	AgentHarness map[enums.AgentHarness]map[string]any `mapstructure:"agent_harness" validate:"required,gt=0"`
}

type Config interface {
	Read() *ConfigStruct
}
