package output_itf

import (
	"hexago/internal/implementation/helpers/enums"
)

type AgentManager interface {
	SupportedAgents() ([]enums.AgentHarness, error)
}
