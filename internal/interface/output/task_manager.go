package output_itf

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
type TaskEventData struct {
	AgentID     uuid.UUID
	Status      enums.TaskStatus
	RetryCount  int
	Report      *TaskReport
	FileChanges []*FileChange
}
type TaskEvent struct {
	ChannelID uuid.UUID
	QueueID   uuid.UUID
	TaskID    uuid.UUID
	Event     enums.TaskQueueEvent
	Data      *TaskEventData
	EmittedAt time.Time
}
type QueueEventData struct {
	TotalTasks  int
	TotalRetry  int
	StartedAt   time.Time
	CompletedAt time.Time
}
type QueueEvent struct {
	ChannelID uuid.UUID
	QueueID   uuid.UUID
	Event     enums.TaskQueueEvent
	Data      *QueueEventData
	EmittedAt time.Time
}
type TaskManager interface {
	Add(task *AddTask) error
	Assign(agentID, taskID uuid.UUID) error
	Report(
		agentID, taskID uuid.UUID,
		report *TaskReport,
		fileChanges []*FileChange,
	) error
	HeartBeat(agentID, taskID uuid.UUID)
	SubscribeTaskEvent(taskID uuid.UUID) (channelID uuid.UUID, channel <-chan *TaskEvent)
	SubscribeQueueEvent(queueID uuid.UUID) (channelID uuid.UUID, channel <-chan *QueueEvent)
	Unsubscribe(channelID uuid.UUID)
}
