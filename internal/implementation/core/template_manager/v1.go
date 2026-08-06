package template_manager

import (
	"strings"

	"hexago/internal/helpers"
	"hexago/internal/helpers/custom_error"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

type v1 struct {
	store input_itf.TemplateStorage
}

func InitV1(store input_itf.TemplateStorage) (core_itf.AgentTemplateManager, error) {
	if store == nil {
		return nil, custom_error.Critical("template storage is not initialized")
	}

	return &v1{
		store: store,
	}, nil
}

func (m *v1) Upsert(template *core_itf.Template) (uuid.UUID, error) {
	if template == nil {
		return uuid.Nil, custom_error.Critical("template is empty")
	}

	id := template.ID

	if id == uuid.Nil {
		uid, err := uuid.NewV7()
		if err != nil {
			return uuid.Nil, custom_error.Critical("cannot create uuid: %v", err)
		}

		id = uid
	}

	now := helpers.NewUTC()

	entity := &input_itf.TemplateEntity{
		ID:                   id,
		Name:                 strings.TrimSpace(template.Name),
		Role:                 strings.TrimSpace(template.Role),
		TaskLevel:            template.TaskLevel,
		Retryable:            template.Retryable,
		ManualAcceptRequired: template.ManualAcceptRequired,
		Params:               paramEntities(template.Params),
		SystemPrompts:        prompts(template.SystemPrompts),
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := helpers.ValidateStruct(entity); err != nil {
		return uuid.Nil, custom_error.Critical("invalid template %q: %v", entity.Name, err)
	}

	if err := m.store.Upsert(entity); err != nil {
		return uuid.Nil, custom_error.Critical("cannot save template %q: %v", entity.Name, err)
	}

	return id, nil
}

func (m *v1) List() ([]*core_itf.Template, error) {
	stored, err := m.store.List()
	if err != nil {
		return nil, custom_error.Critical("cannot list templates: %v", err)
	}

	templates := make([]*core_itf.Template, 0, len(stored))

	for _, entity := range stored {
		templates = append(templates, template(entity))
	}

	return templates, nil
}

func (m *v1) Get(id uuid.UUID) (*core_itf.Template, error) {
	stored, err := m.find(id)
	if err != nil {
		return nil, err
	}

	return template(stored), nil
}

func (m *v1) Remove(id uuid.UUID) error {
	if _, err := m.find(id); err != nil {
		return err
	}

	if err := m.store.Remove(id); err != nil {
		return custom_error.Critical("cannot remove template %v: %v", id, err)
	}

	return nil
}

func (m *v1) find(id uuid.UUID) (*input_itf.TemplateEntity, error) {
	if id == uuid.Nil {
		return nil, custom_error.Critical("template id is empty")
	}

	stored, err := m.store.Find(id)
	if err != nil {
		return nil, custom_error.Critical("cannot get template %v: %v", id, err)
	}

	if stored == nil {
		return nil, custom_error.Critical("template %v not found", id)
	}

	return stored, nil
}

func paramEntities(params map[string]*core_itf.TemplateParams) map[string]*input_itf.TemplateParamEntity {
	entities := map[string]*input_itf.TemplateParamEntity{}

	for key, param := range params {
		if param == nil {
			entities[strings.TrimSpace(key)] = nil
			continue
		}

		entities[strings.TrimSpace(key)] = &input_itf.TemplateParamEntity{
			Description: param.Description,
			Required:    param.Required,
			Type:        param.Type,
			Default:     param.Default,
			Options:     param.Options,
		}
	}

	return entities
}

func prompts(systemPrompts map[string]string) map[string]string {
	cloned := map[string]string{}

	for key, prompt := range systemPrompts {
		cloned[strings.TrimSpace(key)] = strings.TrimSpace(prompt)
	}

	return cloned
}

func template(entity *input_itf.TemplateEntity) *core_itf.Template {
	params := map[string]*core_itf.TemplateParams{}

	for key, param := range entity.Params {
		params[key] = &core_itf.TemplateParams{
			Description: param.Description,
			Required:    param.Required,
			Type:        param.Type,
			Default:     param.Default,
			Options:     param.Options,
		}
	}

	return &core_itf.Template{
		ID:                   entity.ID,
		Name:                 entity.Name,
		Role:                 entity.Role,
		TaskLevel:            entity.TaskLevel,
		Retryable:            entity.Retryable,
		ManualAcceptRequired: entity.ManualAcceptRequired,
		Params:               params,
		SystemPrompts:        prompts(entity.SystemPrompts),
	}
}
