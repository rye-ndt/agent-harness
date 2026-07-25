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

type ConfigStruct struct {
	App          *AppConfig                            `mapstructure:"app"`
	Version      string                                `mapstructure:"version"`
	LogLevel     string                                `mapstructure:"log_level"`
	TaskQueue    *TaskQueueConfig                      `mapstructure:"task_queue"`
	AgentHarness map[enums.AgentHarness]map[string]any `mapstructure:"agent_harness"`
}

type Config interface {
	Read() *ConfigStruct
}
