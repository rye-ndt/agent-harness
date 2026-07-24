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

type TaskWALKind string

const (
	WALTaskCreated       TaskWALKind = "task_created"
	WALTaskStatusChanged TaskWALKind = "task_status_changed"
	WALTaskReported      TaskWALKind = "task_reported"
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
