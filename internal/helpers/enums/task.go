package enums

import "slices"

type TaskStatus string

const (
	TaskNotTaken   TaskStatus = "not_taken"
	TaskProcessing TaskStatus = "processing"
	TaskCompleted  TaskStatus = "completed"
	TaskCancelled  TaskStatus = "cancelled"
	TaskFailed     TaskStatus = "failed"
)

var takeable = []TaskStatus{
	TaskNotTaken,
	TaskCancelled,
	TaskFailed,
}

var removable = []TaskStatus{
	TaskCompleted,
	TaskCancelled,
}

func (s TaskStatus) Takeable() bool {
	for _, t := range takeable {
		if s == t {
			return true
		}
	}

	return false
}

func (s TaskStatus) Removable() bool {
	for _, t := range removable {
		if s == t {
			return true
		}
	}

	return false
}

type SessionEvent string

const (
	SessionCreated           SessionEvent = "session_created"
	SessionDrained           SessionEvent = "session_drained"
	SessionTaskCreated       SessionEvent = "task_created"
	SessionTaskStatusChanged SessionEvent = "task_status_changed"
	SessionTaskReported      SessionEvent = "task_reported"
	SessionTaskDropped       SessionEvent = "task_dropped"
)

var sessionEvents = []SessionEvent{
	SessionCreated,
	SessionDrained,
	SessionTaskCreated,
	SessionTaskStatusChanged,
	SessionTaskReported,
	SessionTaskDropped,
}

func SessionEvents() []SessionEvent {
	return slices.Clone(sessionEvents)
}

func (se SessionEvent) Event() string {
	return string(se)
}

type SessionStatus string

const (
	SessionInit       SessionStatus = "init"
	SessionProcessing SessionStatus = "processing"
	SessionCompleted  SessionStatus = "completed"
)

type FileAllowance string

const (
	FileAllowAll FileAllowance = "all"
	Restricted   FileAllowance = "restricted"
)

type FileChangeType string

const (
	FileAdded    FileChangeType = "added"
	FileModified FileChangeType = "modified"
	FileDeleted  FileChangeType = "deleted"
	FileRenamed  FileChangeType = "renamed"
)

func (f FileChangeType) String() string {
	return string(f)
}

type TaskLevel string

const (
	MaximumEffortTask TaskLevel = "maximum_effort_task"
	HeavyTask         TaskLevel = "heavy_task"
	DailyTask         TaskLevel = "daily_task"
	LightweightTask   TaskLevel = "lightweight_task"
)

func (l TaskLevel) Valid() bool {
	switch l {
	case MaximumEffortTask, HeavyTask, DailyTask, LightweightTask:
		return true
	default:
		return false
	}
}

func (l TaskLevel) String() string {
	return string(l)
}
