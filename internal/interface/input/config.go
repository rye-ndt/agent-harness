package input_itf

import "hexago/internal/implementation/helpers/enums"

type AppConfig struct {
	Name string `mapstructure:"name"`
	W    int    `mapstructure:"w"`
	H    int    `mapstructure:"h"`
	Bg   string `mapstructure:"bg"`
}

type ConfigStruct struct {
	App          *AppConfig                            `mapstructure:"app"`
	Version      string                                `mapstructure:"version"`
	LogLevel     string                                `mapstructure:"log_level"`
	AgentHarness map[enums.AgentHarness]map[string]any `mapstructure:"agent_harness"`
}

type Config interface {
	Read() *ConfigStruct
}
