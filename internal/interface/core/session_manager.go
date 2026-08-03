package core_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type AddTask struct {
	Name               string
	AutoRetry          bool
	FileWriteAllowance enums.FileAllowance
	AllowedFilePaths   []string
	TemplateFilePaths  []string
	ExtraGuidance      string
	DependsOn          []uuid.UUID
	AgentSpecs         *AgentRequest
}

type TaskSpec struct {
	TaskID             uuid.UUID
	SessionID          uuid.UUID
	Name               string
	Status             enums.TaskStatus
	RetryCount         int
	AutoRetry          bool
	FileWriteAllowance enums.FileAllowance
	AllowedFilePaths   []string
	ExtraGuidance      string
	DependsOn          []uuid.UUID
	AgentSpecs         *AgentRequest
}

type FileChange struct {
	Path        string
	OldPath     string
	ChangeType  enums.FileChangeType
	Additions   int
	Deletions   int
	UnifiedDiff string
}

type HandoverDoc struct {
	Task              string
	Outcome           string
	Blockers          map[string]string
	ApprovedDecisions map[string]string
	RejectedDecisions map[string]string
	CurrentBehaviors  map[string]string
	ChangedBehaviors  map[string]string
	MustAvoid         map[string]string
	Nuances           map[string]string
	KnownGaps         map[string]string
}

type TaskReport struct {
	TaskID       uuid.UUID
	Status       enums.TaskStatus
	FileChanges  []*FileChange
	HandoverDocs []*HandoverDoc
}

type SessionProgress struct {
	SessionID   uuid.UUID
	TaskID      uuid.UUID
	AgentID     uuid.UUID
	Event       enums.SessionEvent
	Status      enums.TaskStatus
	RetryCount  int
	Report      *TaskReport
	TotalTasks  int
	TotalRetry  int
	StartedAt   time.Time
	CompletedAt time.Time
	EmittedAt   time.Time
}

type SessionStatus struct {
	ID             uuid.UUID
	Status         enums.SessionStatus
	WorkingDirPath string
	ContextDirPath string
	Tasks          map[uuid.UUID]*TaskReport
}

type InitSession struct {
	WorkingDirPath string
	ContextDirPath string
}

type TaskReporter interface {
	Report(agentID uuid.UUID, status enums.TaskStatus, docs []*HandoverDoc) error
}

type SessionManager interface {
	TaskReporter
	NewSession(p *InitSession) (uuid.UUID, error)
	AddTask(session uuid.UUID, task *AddTask) (uuid.UUID, error)
	ReadyTasks(session uuid.UUID) ([]*TaskSpec, error)
	Assign(taskID, agentID uuid.UUID) error
	Execute(session uuid.UUID) (<-chan *SessionProgress, error)
	RetryTask(taskID uuid.UUID) error
	Status(id uuid.UUID) (*SessionStatus, error)
	HeartBeat(agentID uuid.UUID) error
	Stop()
}
