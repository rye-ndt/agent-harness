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

type TemplateParamInfo struct {
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

type TemplateInfo struct {
	ID            string                        `json:"id"`
	Name          string                        `json:"name"`
	Role          string                        `json:"role"`
	TaskLevel     string                        `json:"task_level"`
	Retryable     bool                          `json:"retryable"`
	Params        map[string]*TemplateParamInfo `json:"params"`
	SystemPrompts map[string]string             `json:"system_prompts"`
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
	Templates() ([]*TemplateInfo, error)
	Template(id string) (*TemplateInfo, error)
	UpsertTemplate(template *TemplateInfo) (string, error)
	RemoveTemplate(id string) error
	KillAgent(id string, agentID string) error
	UninstallAgent(id string) error
}
