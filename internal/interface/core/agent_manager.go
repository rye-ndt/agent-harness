package core_itf

import (
	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"
)

type AgentManager interface {
	SupportedAgents() ([]enums.AgentHarness, error)
	Harness(name enums.AgentHarness) (input_itf.AgentHarness, error)
}
