package enums

type TaskStatus string

const (
	TaskNotTaken   TaskStatus = "not_taken"
	TaskProcessing TaskStatus = "processing"
	TaskCompleted  TaskStatus = "completed"
	TaskCancelled  TaskStatus = "cancelled"
	TaskOrphaned   TaskStatus = "orphaned"
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
