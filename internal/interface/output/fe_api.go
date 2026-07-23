package output_itf

import (
	"context"

	input_itf "hexago/internal/interface/input"
)

type AgentInfo struct {
	ID     string                 `json:"id"`
	Status *input_itf.AgentStatus `json:"status"`
}

type FEAPI interface {
	Startup(ctx context.Context)
	Shutdown(ctx context.Context)
	AgentStatuses() ([]AgentInfo, error)
	InstallAgent(id string) error
	AuthAgent(id string) (string, error)
	SubmitAuthCode(id string, code string) error
	SpawnAgent(id string) (string, error)
	SendToAgent(id string, agentID string, message string) error
	KillAgent(id string, agentID string) error
	UninstallAgent(id string) error
}
