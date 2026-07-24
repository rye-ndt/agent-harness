package input_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type FileChangeEntity struct {
	ID          uuid.UUID
	ReportID    uuid.UUID
	Path        string
	OldPath     string
	ChangeType  enums.FileChangeType
	Additions   int
	Deletions   int
	UnifiedDiff string
}

type HandoverDocEntity struct {
	Task              string            `json:"task_name"`
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

type TaskReportEntity struct {
	ID            uuid.UUID
	TaskID        uuid.UUID
	AgentID       uuid.UUID
	AttemptStatus enums.TaskStatus
	HandoverDoc   *HandoverDocEntity
	StartedAt     time.Time
	CompletedAt   time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type TaskEntity struct {
	ID                 uuid.UUID
	QueueID            uuid.UUID
	Name               string
	AgentRole          string
	FileWriteAllowance enums.FileAllowance
	AllowedFilePaths   []string
	TemplateFilePaths  []string
	ExtraGuidance      string
	Age                int
	Status             enums.TaskStatus
	PrevTaskID         uuid.UUID
	NextTaskID         uuid.UUID
	ChildrenTaskIDs    uuid.UUIDs
	LastReportID       uuid.UUID
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type TaskStorage interface {
	Create(task *TaskEntity) error
	CreateImplementRecord(implement *TaskReportEntity) error // only when done or being cancelled
	Find(taskID uuid.UUID) (*TaskEntity, error)
	FindLastImplementRecord(taskID uuid.UUID) *TaskReportEntity
}
