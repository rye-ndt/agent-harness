package input_itf

import "time"

type AppConfig struct {
	Name string `mapstructure:"name"`
	W    int    `mapstructure:"w"`
	H    int    `mapstructure:"h"`
	Bg   string `mapstructure:"bg"`
}

type HarnessConfig struct {
	Name         string        `mapstructure:"name"`
	BinName      string        `mapstructure:"bin_name"`
	ReleaseBase  string        `mapstructure:"release_base"`
	LoginTimeout time.Duration `mapstructure:"login_timeout"`
	TokenRegex   string        `mapstructure:"token_regex"`
	AnsiRegex    string        `mapstructure:"ansi_regex"`
}

type ConfigStruct struct {
	App          *AppConfig       `mapstructure:"app"`
	Version      string           `mapstructure:"version"`
	LogLevel     string           `mapstructure:"log_level"`
	AgentHarness []*HarnessConfig `mapstructure:"agent_harness"`
}

func (c *ConfigStruct) Harness(name string) *HarnessConfig {
	for _, h := range c.AgentHarness {
		if h.Name == name {
			return h
		}
	}
	return nil
}

type Config interface {
	Read() *ConfigStruct
}
