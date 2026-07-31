package output_itf

import (
	"context"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
)

type AgentInfo struct {
	ID     string                 `json:"id"`
	Status *input_itf.AgentStatus `json:"status"`
}

type ApprovalInfo struct {
	ID          string                     `json:"id"`
	AgentID     string                     `json:"agent_id"`
	TaskID      string                     `json:"task_id"`
	Kind        string                     `json:"kind"`
	Question    string                     `json:"question"`
	Detail      string                     `json:"detail"`
	Options     []*core_itf.ApprovalOption `json:"options"`
	MultiSelect bool                       `json:"multi_select"`
	RequestedAt string                     `json:"requested_at"`
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
	AgentContextUsage(agentID string) (*input_itf.ContextUsage, error)
	PendingApprovals() ([]*ApprovalInfo, error)
	AnswerApproval(requestID string, approved bool, optionIDs []string, guidance string) error
	KillAgent(id string, agentID string) error
	UninstallAgent(id string) error
}
