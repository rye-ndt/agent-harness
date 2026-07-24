package input_itf

import (
	"hexago/internal/helpers/enums"

	"github.com/google/uuid"
)

type TaskWALRecord struct {
	Kind        enums.TaskWALKind   `json:"kind"`
	Task        *TaskEntity         `json:"task,omitempty"`
	TaskID      uuid.UUID           `json:"task_id,omitempty"`
	AgentID     uuid.UUID           `json:"agent_id,omitempty"`
	Status      enums.TaskStatus    `json:"status,omitempty"`
	Report      *TaskReportEntity   `json:"report,omitempty"`
	FileChanges []*FileChangeEntity `json:"file_changes,omitempty"`
}

type TaskWAL interface {
	Append(record *TaskWALRecord) error
	Replay() ([]*TaskWALRecord, error)
	Reset() error
	Close() error
}
