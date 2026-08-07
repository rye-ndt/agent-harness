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
	Description string   `json:"description"`
	Required    bool     `json:"required"`
	Type        string   `json:"type"`
	Default     string   `json:"default"`
	Options     []string `json:"options"`
}

type TemplateInfo struct {
	ID                   string                        `json:"id"`
	Name                 string                        `json:"name"`
	Role                 string                        `json:"role"`
	TaskLevel            string                        `json:"task_level"`
	Retryable            bool                          `json:"retryable"`
	ManualAcceptRequired bool                          `json:"manual_accept_required"`
	Params               map[string]*TemplateParamInfo `json:"params"`
	SystemPrompts        map[string]string             `json:"system_prompts"`
}

type RunTaskSpec struct {
	ClientID             string   `json:"client_id"`
	Name                 string   `json:"name"`
	Prompt               string   `json:"prompt"`
	Role                 string   `json:"role"`
	TaskLevel            string   `json:"task_level"`
	SystemPrompts        []string `json:"system_prompts"`
	DependsOn            []string `json:"depends_on"`
	AutoRetry            bool     `json:"auto_retry"`
	ManualAcceptRequired bool     `json:"manual_accept_required"`
}

type RunSessionSpec struct {
	WorkingDirPath string         `json:"working_dir_path"`
	ContextDirPath string         `json:"context_dir_path"`
	Tasks          []*RunTaskSpec `json:"tasks"`
}

type RunSessionResult struct {
	SessionID string            `json:"session_id"`
	TaskIDs   map[string]string `json:"task_ids"`
}

type HandoverDocInfo struct {
	Task              string            `json:"task"`
	TLDR              string            `json:"tldr"`
	Outcome           string            `json:"outcome"`
	Blockers          map[string]string `json:"blockers"`
	ApprovedDecisions map[string]string `json:"approved_decisions"`
	RejectedDecisions map[string]string `json:"rejected_decisions"`
	CurrentBehaviors  map[string]string `json:"current_behaviors"`
	ChangedBehaviors  map[string]string `json:"changed_behaviors"`
	MustAvoid         map[string]string `json:"must_avoid"`
	Nuances           map[string]string `json:"nuances"`
	KnownGaps         map[string]string `json:"known_gaps"`
}

type FileChangeInfo struct {
	Path        string `json:"path"`
	OldPath     string `json:"old_path"`
	ChangeType  string `json:"change_type"`
	Additions   int    `json:"additions"`
	Deletions   int    `json:"deletions"`
	UnifiedDiff string `json:"unified_diff"`
}

type TaskActivityInfo struct {
	Seq  int    `json:"seq"`
	At   string `json:"at"`
	Text string `json:"text"`
}

type SessionTaskInfo struct {
	TaskID       string                  `json:"task_id"`
	Status       string                  `json:"status"`
	FileChanges  []*FileChangeInfo       `json:"file_changes"`
	HandoverDocs []*HandoverDocInfo      `json:"handover_docs"`
	ContextUsage *input_itf.ContextUsage `json:"context_usage"`
	Activity     []*TaskActivityInfo     `json:"activity"`
}

type SessionStatusInfo struct {
	SessionID string             `json:"session_id"`
	Status    string             `json:"status"`
	Tasks     []*SessionTaskInfo `json:"tasks"`
}

type AgentDefaultInfo struct {
	TaskLevel     string `json:"task_level"`
	Model         string `json:"model"`
	ModelLabel    string `json:"model_label"`
	ThinkingLevel string `json:"thinking_level"`
}

type ModelOptionInfo struct {
	Model   string `json:"model"`
	Label   string `json:"label"`
	Harness string `json:"harness"`
}

type SessionDraftInfo struct {
	ID        string `json:"id"`
	Doc       string `json:"doc"`
	UpdatedAt string `json:"updated_at"`
}

type MCPServerInfo struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	Authorized   bool   `json:"authorized"`
	AuthorizedAt string `json:"authorized_at"`
	Account      string `json:"account"`
	Kind         string `json:"kind"`
}

type AgentDefaultOptionsInfo struct {
	TaskLevels     []string           `json:"task_levels"`
	Models         []*ModelOptionInfo `json:"models"`
	ThinkingLevels []string           `json:"thinking_levels"`
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
	ChooseDirectory(title string) (string, error)
	AgentDefaults() ([]*AgentDefaultInfo, error)
	SetAgentDefault(taskLevel string, model string, thinkingLevel string) error
	AgentDefaultOptions() (*AgentDefaultOptionsInfo, error)
	Onboarded() bool
	CompleteOnboarding() error
	Autopilot() bool
	SetAutopilot(on bool) error
	RunSession(spec *RunSessionSpec) (*RunSessionResult, error)
	SessionStatus(sessionID string) (*SessionStatusInfo, error)
	CancelSession(sessionID string) error
	RetrySessionTask(taskID string) error
	AnswerTaskAcceptance(taskID string, accepted bool) error
	SessionDrafts() ([]*SessionDraftInfo, error)
	SaveSessionDraft(id string, doc string) error
	DeleteSessionDraft(id string) error
	MCPServers() ([]*MCPServerInfo, error)
	AuthorizeMCPServer(name string) error
	SetMCPCredential(name string, secret string) error
	RevokeMCPServer(name string) error
}
