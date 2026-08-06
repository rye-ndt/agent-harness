package input_itf

import (
	"hexago/internal/helpers/enums"
	"time"

	"github.com/google/uuid"
)

type TemplateParamEntity struct {
	Description string   `json:"description"`
	Required    bool     `json:"required"`
	Type        string   `json:"type,omitempty"`
	Default     string   `json:"default,omitempty"`
	Options     []string `json:"options,omitempty"`
}

type TemplateEntity struct {
	ID                   uuid.UUID
	Name                 string `validate:"required"`
	Role                 string
	TaskLevel            enums.TaskLevel `validate:"required,task_level"`
	Retryable            bool
	ManualAcceptRequired bool
	Params               map[string]*TemplateParamEntity `validate:"dive,keys,required,endkeys,required"`
	SystemPrompts        map[string]string               `validate:"required,gt=0,dive,keys,required,endkeys,required"`
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

type TemplateStorage interface {
	Upsert(template *TemplateEntity) error
	List() ([]*TemplateEntity, error)
	Find(id uuid.UUID) (*TemplateEntity, error)
	Remove(id uuid.UUID) error
}
