package output_itf

import "hexago/internal/helpers/enums"

type AgentDefault struct {
	Model         enums.ModelName     `json:"model" validate:"required,model_name"`
	ThinkingLevel enums.ThinkingLevel `json:"thinking_level" validate:"required,thinking_level"`
}

type UserConfig interface {
	AgentDefaults() map[enums.TaskLevel]*AgentDefault
	AgentDefault(level enums.TaskLevel) (*AgentDefault, error)
	SetAgentDefault(level enums.TaskLevel, agentDefault *AgentDefault) error
	Onboarded() bool
	CompleteOnboarding() error
}
