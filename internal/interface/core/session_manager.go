package core_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type AddTask struct {
	Name                 string
	AgentRole            string
	PreferredModelFamily enums.ModelFamily
	FileWriteAllowance   enums.FileAllowance
	AllowedFilePaths     []string
	TemplateFilePaths    []string
	ExtraGuidance        string
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

type TaskEventData struct {
	AgentID     uuid.UUID
	Status      enums.TaskStatus
	RetryCount  int
	Report      *TaskReport
	FileChanges []*FileChange
}

type TaskEvent struct {
	SessionID uuid.UUID
	TaskID    uuid.UUID
	Event     enums.SessionEvent
	Data      *TaskEventData
	EmittedAt time.Time
}

type SessionEventData struct {
	TotalTasks  int
	TotalRetry  int
	StartedAt   time.Time
	CompletedAt time.Time
}

type SessionEvent struct {
	SessionID uuid.UUID
	Event     enums.SessionEvent
	Data      *SessionEventData
	EmittedAt time.Time
}

type SessionStatus struct {
	ID     uuid.UUID
	Status enums.SessionStatus
	Tasks  map[uuid.UUID]*TaskReport
}

type SessionManager interface {
	NewSession() (uuid.UUID, error)
	AddTask(session uuid.UUID, task *AddTask) error
	Execute(session uuid.UUID) error
	Status(id uuid.UUID) (*SessionStatus, error)
	HeartBeat(agentID, taskID uuid.UUID) error
	Stop()
}
