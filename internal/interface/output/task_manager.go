package output_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type AddTask struct {
	Name               string
	AgentRole          string
	FileWriteAllowance enums.FileAllowance
	AllowedFilePaths   []string
	TemplateFilePaths  []string
	ExtraGuidance      string
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
	AttemptStatus enums.TaskStatus
	HandoverDoc   *HandoverDoc
	StartedAt     time.Time
	CompletedAt   time.Time
}

type QueueReport struct {
	ID     uuid.UUID
	Status enums.TaskQueueStatus
	Tasks  []*AddTask
}

type TaskQueue interface {
	Add(task *AddTask) error
	Assign(agentID, taskID uuid.UUID) error
	Report(
		agentID, taskID uuid.UUID,
		report *TaskReport,
		fileChanges []*FileChange,
	) error
	HeartBeat(agentID, taskID uuid.UUID)
}
