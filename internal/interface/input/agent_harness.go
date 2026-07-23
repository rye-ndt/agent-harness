package input_itf

import "hexago/internal/helpers/enums"

type Agent struct {
	ID string
}

type InstallProgress struct {
	Stage      enums.InstallationStage `json:"stage"`
	Downloaded int64                   `json:"downloaded"`
	Total      int64                   `json:"total"`
}

type AgentStatus struct {
	Name          string `json:"name"`
	Installed     bool   `json:"installed"`
	InstanceCount int    `json:"instance_count"`
	Version       string `json:"version"`
}

type AgentHarness interface {
	Auth() error
	Status() (*AgentStatus, error)
	Install(onProgress func(InstallProgress)) error
	Uninstall() error
	Spawn() (*Agent, error)
	Send(id string, message string) error
	Listen(id string) (<-chan string, error)
	Kill(id string) error
}
