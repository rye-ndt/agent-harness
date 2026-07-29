package core_itf

import (
	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

type AgentTask struct {
}

type AgentManager interface {
	SupportedAgents() ([]enums.AgentHarness, error)
	RequestInstance(model enums.ModelFamily) (uuid.UUID, error)
	DelegateTask(agent uuid.UUID, task *AgentTask, report func(rp *TaskReport) error)
	Harness(name enums.AgentHarness) (input_itf.AgentHarness, error)
}
