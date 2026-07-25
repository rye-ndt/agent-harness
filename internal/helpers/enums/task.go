package enums

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

type TaskQueueEvent string

const (
	EventQueueCreated      TaskQueueEvent = "queue_created"
	EventQueueDrained      TaskQueueEvent = "queue_drained"
	EventTaskCreated       TaskQueueEvent = "task_created"
	EventTaskStatusChanged TaskQueueEvent = "task_status_changed"
	EventTaskReported      TaskQueueEvent = "task_reported"
	EventTaskDropped       TaskQueueEvent = "task_dropped"
)

type TaskQueueStatus string

const (
	TaskQueueInit      TaskQueueStatus = "init"
	TaskQueueCompleted TaskQueueStatus = "completed"
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
