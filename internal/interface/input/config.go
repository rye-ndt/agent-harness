package input_itf

import (
	"time"

	"hexago/internal/helpers/enums"
)

type AppConfig struct {
	Name string `mapstructure:"name"`
	W    int    `mapstructure:"w"`
	H    int    `mapstructure:"h"`
	Bg   string `mapstructure:"bg"`
}

type TaskQueueConfig struct {
	HeartbeatTimeout      time.Duration `mapstructure:"heartbeat_timeout"`
	HeartbeatScanInterval time.Duration `mapstructure:"heartbeat_scan_interval"`
}

type MCPServerConfig struct {
	Name        string `mapstructure:"name"`
	AuthKeyName string `mapstructure:"auth_key_name"`
	URL         string `mapstructure:"url"`
}

type MCPServersConfig struct {
	SupportedServers         map[string]*MCPServerConfig `mapstructure:"supported_servers"`
	EncodeKey                string                      `mapstructure:"encode_key"`
	AuthTimeout              time.Duration               `mapstructure:"auth_timeout"`
	ClientName               string                      `mapstructure:"client_name"`
	CallbackPath             string                      `mapstructure:"callback_path"`
	ShutdownGrace            time.Duration               `mapstructure:"shutdown_grace"`
	VerifierBytes            int                         `mapstructure:"verifier_bytes"`
	StateBytes               int                         `mapstructure:"state_bytes"`
	MinVerifierBytes         int                         `mapstructure:"min_verifier_bytes"`
	MinStateBytes            int                         `mapstructure:"min_state_bytes"`
	DefaultTokenTTL          time.Duration               `mapstructure:"default_token_ttl"`
	ChallengeMethod          string                      `mapstructure:"challenge_method"`
	SupportedChallengeMethod string                      `mapstructure:"supported_challenge_method"`
}

type ConfigStruct struct {
	App          *AppConfig                            `mapstructure:"app"`
	Version      string                                `mapstructure:"version"`
	LogLevel     string                                `mapstructure:"log_level"`
	TaskQueue    *TaskQueueConfig                      `mapstructure:"task_queue"`
	MCPServers   *MCPServersConfig                     `mapstructure:"mcp_servers"`
	AgentHarness map[enums.AgentHarness]map[string]any `mapstructure:"agent_harness"`
}

type Config interface {
	Read() *ConfigStruct
}
