package core_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type ApprovalOption struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

type ApprovalRequest struct {
	ID          uuid.UUID          `json:"id"`
	AgentID     uuid.UUID          `json:"agent_id"`
	TaskID      uuid.UUID          `json:"task_id"`
	Kind        enums.ApprovalKind `json:"kind"`
	Question    string             `json:"question"`
	Detail      string             `json:"detail"`
	Options     []*ApprovalOption  `json:"options"`
	MultiSelect bool               `json:"multi_select"`
	RequestedAt time.Time          `json:"requested_at"`
}

type ApprovalAnswer struct {
	RequestID  uuid.UUID `json:"request_id"`
	Approved   bool      `json:"approved"`
	OptionIDs  []string  `json:"option_ids"`
	Guidance   string    `json:"guidance"`
	AnsweredAt time.Time `json:"answered_at"`
}

type ApprovalBroker interface {
	Request(req *ApprovalRequest) (*ApprovalAnswer, error)
	Pending() []*ApprovalRequest
	Answer(answer *ApprovalAnswer) error
	Awaiting(agentID uuid.UUID) bool
	Stop()
}
