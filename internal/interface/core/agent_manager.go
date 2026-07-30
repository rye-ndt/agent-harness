package core_itf

import (
	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"
	"time"

	"github.com/google/uuid"
)

type AgentRequest struct {
	Name          enums.ModelName
	Role          string
	ThinkingLevel enums.ThinkingLevel
	SystemPrompts []string
}

type Agent struct {
	ID            uuid.UUID
	Name          enums.ModelName
	Role          string
	ThinkingLevel enums.ThinkingLevel
	HealthStatus  enums.AgentInstanceStatus
	SpawnedAt     time.Time
	TerminatedAt  time.Time
}

type AgentManager interface {
	SupportedAgents() (map[enums.AgentHarness][]enums.ModelName, error)
	Admin(name enums.AgentHarness) (input_itf.AgentAdmin, error)
	RequestInstance(specs *AgentRequest) (*Agent, error)
	Instance(agentID uuid.UUID) (*Agent, error)
	Send(agentID uuid.UUID, message string) error
	Listen(agentID uuid.UUID) (<-chan string, error)
	Kill(agentID uuid.UUID) error
	HeartBeat(agentID uuid.UUID) error
}
