package wails_api

import (
	"context"
	"sort"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/google/uuid"

	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

const (
	installProgressEvent = "harness:install:progress"
	agentOutputEvent     = "agent:output"
	agentClosedEvent     = "agent:closed"
)

type API struct {
	ctx          context.Context
	agentManager core_itf.AgentManager
	mcpProxy     core_itf.MCPProxyServer
	approvals    core_itf.ApprovalBroker
	templates    core_itf.AgentTemplateManager
	dataWarning  string
}

var _ output_itf.FEAPI = (*API)(nil)

type Deps struct {
	AgentManager core_itf.AgentManager
	MCPProxy     core_itf.MCPProxyServer
	Approvals    core_itf.ApprovalBroker
	Templates    core_itf.AgentTemplateManager
	DataWarning  string
}

func New(deps *Deps) *API {
	return &API{
		agentManager: deps.AgentManager,
		mcpProxy:     deps.MCPProxy,
		approvals:    deps.Approvals,
		templates:    deps.Templates,
		dataWarning:  deps.DataWarning,
	}
}

// Startup is wired to Wails OnStartup; it is not meant to be called from JS.
func (a *API) Startup(ctx context.Context) {
	a.ctx = ctx

	if a.dataWarning != "" {
		go func() {
			_, _ = runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
				Type:    runtime.WarningDialog,
				Title:   "Data corrupted",
				Message: a.dataWarning,
			})
		}()
	}
}

// Shutdown is wired to Wails OnShutdown; it is not meant to be called from JS.
func (a *API) Shutdown(ctx context.Context) {
	if a.approvals != nil {
		a.approvals.Stop()
	}

	agents, err := a.agentManager.SupportedAgents()
	if err != nil {
		return
	}

	for agent := range agents {
		h, err := a.agentManager.Admin(agent)
		if err != nil {
			continue
		}
		h.Shutdown()
	}

	a.mcpProxy.Close()
}

func (a *API) admin(id string) (input_itf.AgentAdmin, error) {
	return a.agentManager.Admin(enums.AgentHarness(id))
}

func agentUUID(agentID string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(agentID)
	if err != nil {
		return uuid.Nil, custom_error.Critical("invalid agent id %s: %v", agentID, err)
	}

	return parsed, nil
}

func (a *API) AgentStatuses() ([]output_itf.AgentInfo, error) {
	agents, err := a.agentManager.SupportedAgents()
	if err != nil {
		return nil, err
	}

	infos := make([]output_itf.AgentInfo, 0, len(agents))
	for agent := range agents {
		h, err := a.agentManager.Admin(agent)
		if err != nil {
			return nil, err
		}

		status, err := h.Status()
		if err != nil {
			return nil, err
		}

		infos = append(infos, output_itf.AgentInfo{ID: agent.String(), Status: status})
	}

	sort.Slice(infos, func(i, j int) bool { return infos[i].ID < infos[j].ID })

	return infos, nil
}

func (a *API) InstallAgent(id string) error {
	h, err := a.admin(id)
	if err != nil {
		return err
	}

	return h.Install(func(p input_itf.InstallProgress) {
		runtime.EventsEmit(a.ctx, installProgressEvent, id, p)
	})
}

func (a *API) AuthAgent(id string) (string, error) {
	h, err := a.admin(id)
	if err != nil {
		return "", err
	}

	return h.Auth()
}

func (a *API) SubmitAuthCode(id string, code string) error {
	h, err := a.admin(id)
	if err != nil {
		return err
	}

	return h.SubmitAuthCode(code)
}

func (a *API) SpawnAgent(id string) (string, error) {
	h, err := a.admin(id)
	if err != nil {
		return "", err
	}

	models := h.SupportedModels()
	if len(models) == 0 {
		return "", custom_error.Critical("harness %s has no enabled model", id)
	}

	agent, err := a.agentManager.RequestInstance(&core_itf.AgentRequest{
		Name:          models[0],
		ThinkingLevel: enums.MedThinking,
	})
	if err != nil {
		return "", err
	}

	out, err := a.agentManager.Listen(agent.ID)
	if err != nil {
		return "", err
	}

	agentID := agent.ID.String()

	go func() {
		for line := range out {
			runtime.EventsEmit(a.ctx, agentOutputEvent, id, agentID, line)
		}
		runtime.EventsEmit(a.ctx, agentClosedEvent, id, agentID)
	}()

	return agentID, nil
}

func (a *API) SendToAgent(id string, agentID string, message string) error {
	parsed, err := agentUUID(agentID)
	if err != nil {
		return err
	}

	return a.agentManager.Send(parsed, message)
}

func (a *API) AgentContextUsage(agentID string) (*input_itf.ContextUsage, error) {
	parsed, err := agentUUID(agentID)
	if err != nil {
		return nil, err
	}

	return a.agentManager.ContextUsage(parsed)
}

func (a *API) PendingApprovals() ([]*output_itf.ApprovalInfo, error) {
	pending := a.approvals.Pending()

	infos := make([]*output_itf.ApprovalInfo, 0, len(pending))

	for _, request := range pending {
		item := approvalInfo(request)
		infos = append(infos, item)
	}

	return infos, nil
}

func approvalInfo(request *core_itf.ApprovalRequest) *output_itf.ApprovalInfo {
	if request == nil {
		return nil
	}

	return &output_itf.ApprovalInfo{
		ID:          request.ID.String(),
		AgentID:     request.AgentID.String(),
		TaskID:      request.TaskID.String(),
		Kind:        request.Kind.String(),
		Question:    request.Question,
		Detail:      request.Detail,
		Options:     request.Options,
		MultiSelect: request.MultiSelect,
		RequestedAt: request.RequestedAt.Format(time.RFC3339),
	}
}

func (a *API) AnswerApproval(requestID string, approved bool, optionIDs []string, guidance string) error {
	parsed, err := uuid.Parse(requestID)
	if err != nil {
		return custom_error.Critical("invalid approval id %s: %v", requestID, err)
	}

	agentID := uuid.Nil
	for _, request := range a.approvals.Pending() {
		if request.ID == parsed {
			agentID = request.AgentID
			break
		}
	}

	if err := a.approvals.Answer(&core_itf.ApprovalAnswer{
		RequestID: parsed,
		Approved:  approved,
		OptionIDs: optionIDs,
		Guidance:  guidance,
	}); err != nil {
		return err
	}

	if approved || guidance == "" {
		return nil
	}

	if agentID == uuid.Nil {
		return custom_error.Critical("approval %s has no agent to send the guidance to", requestID)
	}

	return a.agentManager.Send(agentID, guidance)
}

func (a *API) Templates() ([]*output_itf.TemplateInfo, error) {
	stored, err := a.templates.List()
	if err != nil {
		return nil, err
	}

	infos := make([]*output_itf.TemplateInfo, 0, len(stored))

	for _, template := range stored {
		infos = append(infos, templateInfo(template))
	}

	return infos, nil
}

func (a *API) Template(id string) (*output_itf.TemplateInfo, error) {
	parsed, err := templateUUID(id)
	if err != nil {
		return nil, err
	}

	template, err := a.templates.Get(parsed)
	if err != nil {
		return nil, err
	}

	return templateInfo(template), nil
}

func (a *API) UpsertTemplate(template *output_itf.TemplateInfo) (string, error) {
	if template == nil {
		return "", custom_error.Critical("template is empty")
	}

	id := uuid.Nil

	if template.ID != "" {
		parsed, err := templateUUID(template.ID)
		if err != nil {
			return "", err
		}

		id = parsed
	}

	params := map[string]*core_itf.TemplateParams{}

	for key, param := range template.Params {
		if param == nil {
			params[key] = nil
			continue
		}

		params[key] = &core_itf.TemplateParams{
			Description: param.Description,
			Required:    param.Required,
		}
	}

	saved, err := a.templates.Upsert(&core_itf.Template{
		ID:            id,
		Name:          template.Name,
		Role:          template.Role,
		TaskLevel:     enums.TaskLevel(template.TaskLevel),
		Retryable:     template.Retryable,
		Params:        params,
		SystemPrompts: template.SystemPrompts,
	})
	if err != nil {
		return "", err
	}

	return saved.String(), nil
}

func (a *API) RemoveTemplate(id string) error {
	parsed, err := templateUUID(id)
	if err != nil {
		return err
	}

	return a.templates.Remove(parsed)
}

func templateUUID(id string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, custom_error.Critical("invalid template id %s: %v", id, err)
	}

	return parsed, nil
}

func templateInfo(template *core_itf.Template) *output_itf.TemplateInfo {
	if template == nil {
		return nil
	}

	params := map[string]*output_itf.TemplateParamInfo{}

	for key, param := range template.Params {
		params[key] = &output_itf.TemplateParamInfo{
			Description: param.Description,
			Required:    param.Required,
		}
	}

	return &output_itf.TemplateInfo{
		ID:            template.ID.String(),
		Name:          template.Name,
		Role:          template.Role,
		TaskLevel:     template.TaskLevel.String(),
		Retryable:     template.Retryable,
		Params:        params,
		SystemPrompts: template.SystemPrompts,
	}
}

func (a *API) KillAgent(id string, agentID string) error {
	parsed, err := agentUUID(agentID)
	if err != nil {
		return err
	}

	return a.agentManager.Kill(parsed)
}

func (a *API) UninstallAgent(id string) error {
	h, err := a.admin(id)
	if err != nil {
		return err
	}

	return h.Uninstall()
}
