package core_itf

import (
	"hexago/internal/helpers/enums"

	"github.com/google/uuid"
)

type TemplateParams struct {
	Description string
	Required    bool
	Type        string
	Default     string
	Options     []string
}

type Template struct {
	ID                   uuid.UUID
	Name                 string
	Role                 string
	TaskLevel            enums.TaskLevel
	Retryable            bool
	ManualAcceptRequired bool
	Params               map[string]*TemplateParams
	SystemPrompts        map[string]string
}

type AgentTemplateManager interface {
	Upsert(template *Template) (uuid.UUID, error)
	List() ([]*Template, error)
	Remove(id uuid.UUID) error
	Get(id uuid.UUID) (*Template, error)
}
