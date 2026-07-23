package output_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type TaskInfo struct {
	ID                 uuid.UUID           `json:"id"`
	Name               string              `json:"name"`
	AgentRole          string              `json:"role"`
	FileWriteAllowance enums.FileAllowance `json:"file_write_allowance"`
	AllowedFilePaths   []string            `json:"allowed_file_paths"`
	TemplateFilePaths  []string            `json:"template_file_paths"`
	ExtraGuidance      string              `json:"extra_guidance"`
}

type TaskNode struct {
	Info     *TaskInfo   `json:"task_info"`
	State    *TaskState  `json:"task_state"`
	Next     *TaskNode   `json:"next_task"`
	Prev     *TaskNode   `json:"prev_task"`
	Children []*TaskNode `json:"chilren_tasks"`
}

type TaskState struct {
	ID                  uuid.UUID                 `json:"id"`
	TaskID              uuid.UUID                 `json:"task_id"`
	Status              enums.TaskStatus          `json:"task_status"`
	AgentInstanceID     uuid.UUID                 `json:"agent_instance_id"`
	AgentInstanceStatus enums.AgentInstanceStatus `json:"agent_instance_status"`
	FilesWrote          []string                  `json:"files_wrote"`
	LastHeartbeatCheck  time.Time                 `json:"last_heartbeat_check"`
	StartedAt           time.Time                 `json:"started_at"`
	CompletedAt         time.Time                 `json:"completed_at"`
}

type QueueReport struct {
	ID        uuid.UUID             `json:"id"`
	Status    enums.TaskQueueStatus `json:"task_queue_status"`
	Tasks     []*TaskInfo
	CreatedAt time.Time `json:"created_at"`
}

type TaskQueue interface {
	Add(task *TaskNode) error
	Take(agentID, taskID uuid.UUID) error
	ReportTask(taskID uuid.UUID) *TaskState
	WaitTask(taskID uuid.UUID) *TaskState
	ReportQueue(queueID uuid.UUID)
}
