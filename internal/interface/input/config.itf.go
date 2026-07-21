package input_itf

type AppConfig struct {
	Name string `mapstructure:"name"`
	W    int    `mapstructure:"w"`
	H    int    `mapstructure:"h"`
	Bg   string `mapstructure:"bg"`
}

type ConfigStruct struct {
	App      *AppConfig `mapstructure:"app"`
	Version  string     `mapstructure:"version"`
	LogLevel string     `mapstructure:"log_level"`
}

type Config interface {
	Read() *ConfigStruct
}
