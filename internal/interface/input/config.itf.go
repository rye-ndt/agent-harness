package input_itf

import "time"

type AppConfig struct {
	Name string `mapstructure:"name"`
	W    int    `mapstructure:"w"`
	H    int    `mapstructure:"h"`
	Bg   string `mapstructure:"bg"`
}

type ClaudeCodeConfig struct {
	BinName      string        `mapstructure:"bin_name"`
	ReleaseBase  string        `mapstructure:"release_base"`
	LoginTimeout time.Duration `mapstructure:"login_timeout"`
	TokenRegex   string        `mapstructure:"token_regex"`
	AnsiRegex    string        `mapstructure:"ansi_regex"`
}

type AgentHarnessConfig struct {
	ClaudeCode *ClaudeCodeConfig `mapstructure:"claude_code"`
}

type ConfigStruct struct {
	App          *AppConfig          `mapstructure:"app"`
	Version      string              `mapstructure:"version"`
	LogLevel     string              `mapstructure:"log_level"`
	AgentHarness *AgentHarnessConfig `mapstructure:"agent_harness"`
}

type Config interface {
	Read() *ConfigStruct
}
