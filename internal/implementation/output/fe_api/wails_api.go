package wails_api

import (
	"context"
	"sort"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/google/uuid"

	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

const (
	installProgressEvent = "harness:install:progress"
	agentOutputEvent     = "agent:output"
	agentClosedEvent     = "agent:closed"
)

const outputFlushInterval = 100 * time.Millisecond

type API struct {
	ctx          context.Context
	agentManager core_itf.AgentManager
	mcpProxy     core_itf.MCPProxyServer
	approvals    core_itf.ApprovalBroker
	templates    core_itf.AgentTemplateManager
	sessions     core_itf.SessionManager
	coordinator  core_itf.Coordinator
	userConfig   output_itf.UserConfig
	drafts       input_itf.DraftStorage
	dataWarning  string
}

var _ output_itf.FEAPI = (*API)(nil)

type Deps struct {
	AgentManager core_itf.AgentManager
	MCPProxy     core_itf.MCPProxyServer
	Approvals    core_itf.ApprovalBroker
	Templates    core_itf.AgentTemplateManager
	Sessions     core_itf.SessionManager
	Coordinator  core_itf.Coordinator
	UserConfig   output_itf.UserConfig
	Drafts       input_itf.DraftStorage
	DataWarning  string
}

func New(deps *Deps) *API {
	return &API{
		agentManager: deps.AgentManager,
		mcpProxy:     deps.MCPProxy,
		approvals:    deps.Approvals,
		templates:    deps.Templates,
		sessions:     deps.Sessions,
		coordinator:  deps.Coordinator,
		userConfig:   deps.UserConfig,
		drafts:       deps.Drafts,
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
	if a.coordinator != nil {
		a.coordinator.Stop()
	}

	if a.sessions != nil {
		a.sessions.Stop()
	}

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

	go a.pumpOutput(id, agentID, out)

	return agentID, nil
}

func (a *API) pumpOutput(id string, agentID string, out <-chan string) {
	ticker := time.NewTicker(outputFlushInterval)
	defer ticker.Stop()

	batch := []string{}

	flush := func() {
		if len(batch) == 0 {
			return
		}

		runtime.EventsEmit(a.ctx, agentOutputEvent, id, agentID, batch)
		batch = []string{}
	}

	for {
		select {
		case line, open := <-out:
			if !open {
				flush()
				runtime.EventsEmit(a.ctx, agentClosedEvent, id, agentID)
				return
			}

			batch = append(batch, line)
		case <-ticker.C:
			flush()
		}
	}
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
			Type:        param.Type,
			Default:     param.Default,
			Options:     param.Options,
		}
	}

	saved, err := a.templates.Upsert(&core_itf.Template{
		ID:                   id,
		Name:                 template.Name,
		Role:                 template.Role,
		TaskLevel:            enums.TaskLevel(template.TaskLevel),
		Retryable:            template.Retryable,
		ManualAcceptRequired: template.ManualAcceptRequired,
		Params:               params,
		SystemPrompts:        template.SystemPrompts,
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
			Type:        param.Type,
			Default:     param.Default,
			Options:     param.Options,
		}
	}

	return &output_itf.TemplateInfo{
		ID:                   template.ID.String(),
		Name:                 template.Name,
		Role:                 template.Role,
		TaskLevel:            template.TaskLevel.String(),
		Retryable:            template.Retryable,
		ManualAcceptRequired: template.ManualAcceptRequired,
		Params:               params,
		SystemPrompts:        template.SystemPrompts,
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

func (a *API) RunSession(spec *output_itf.RunSessionSpec) (*output_itf.RunSessionResult, error) {
	if spec == nil || len(spec.Tasks) == 0 {
		return nil, custom_error.Critical("run session spec has no tasks")
	}

	sessionID, err := a.sessions.NewSession(&core_itf.InitSession{
		WorkingDirPath: spec.WorkingDirPath,
		ContextDirPath: spec.ContextDirPath,
	})
	if err != nil {
		return nil, err
	}

	autopilot := a.userConfig.Autopilot()

	clientToTask := map[string]uuid.UUID{}
	remaining := append([]*output_itf.RunTaskSpec{}, spec.Tasks...)

	for len(remaining) > 0 {
		next := make([]*output_itf.RunTaskSpec, 0, len(remaining))

		for _, task := range remaining {
			deps, resolved := resolveDeps(task.DependsOn, clientToTask)
			if !resolved {
				next = append(next, task)
				continue
			}

			taskID, err := a.addSessionTask(sessionID, task, deps, autopilot)
			if err != nil {
				return nil, err
			}

			clientToTask[task.ClientID] = taskID
		}

		if len(next) == len(remaining) {
			return nil, custom_error.Critical("task dependencies are unresolvable or cyclic")
		}

		remaining = next
	}

	if err := a.coordinator.Run(sessionID); err != nil {
		return nil, err
	}

	taskIDs := make(map[string]string, len(clientToTask))
	for clientID, taskID := range clientToTask {
		taskIDs[clientID] = taskID.String()
	}

	return &output_itf.RunSessionResult{
		SessionID: sessionID.String(),
		TaskIDs:   taskIDs,
	}, nil
}

func (a *API) ChooseDirectory(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                title,
		CanCreateDirectories: true,
	})
}

func (a *API) AgentDefaults() ([]*output_itf.AgentDefaultInfo, error) {
	stored := a.userConfig.AgentDefaults()

	infos := make([]*output_itf.AgentDefaultInfo, 0, len(stored))

	for _, level := range enums.TaskLevels() {
		agentDefault := stored[level]
		if agentDefault == nil {
			continue
		}

		infos = append(infos, &output_itf.AgentDefaultInfo{
			TaskLevel:     level.String(),
			Model:         agentDefault.Model.String(),
			ModelLabel:    agentDefault.Model.DisplayName(),
			ThinkingLevel: agentDefault.ThinkingLevel.String(),
		})
	}

	return infos, nil
}

func (a *API) SetAgentDefault(taskLevel string, model string, thinkingLevel string) error {
	return a.userConfig.SetAgentDefault(enums.TaskLevel(taskLevel), &output_itf.AgentDefault{
		Model:         enums.ModelName(model),
		ThinkingLevel: enums.ThinkingLevel(thinkingLevel),
	})
}

func (a *API) Onboarded() bool {
	return a.userConfig.Onboarded()
}

func (a *API) CompleteOnboarding() error {
	return a.userConfig.CompleteOnboarding()
}

func (a *API) Autopilot() bool {
	return a.userConfig.Autopilot()
}

func (a *API) SetAutopilot(on bool) error {
	return a.userConfig.SetAutopilot(on)
}

func (a *API) AgentDefaultOptions() (*output_itf.AgentDefaultOptionsInfo, error) {
	levels := enums.TaskLevels()
	taskLevels := make([]string, 0, len(levels))

	for _, level := range levels {
		taskLevels = append(taskLevels, level.String())
	}

	names := enums.ModelNames()
	models := make([]*output_itf.ModelOptionInfo, 0, len(names))

	for _, name := range names {
		models = append(models, &output_itf.ModelOptionInfo{
			Model:   name.String(),
			Label:   name.DisplayName(),
			Harness: name.HarnessTool().String(),
		})
	}

	levelsOfThinking := enums.ThinkingLevels()
	thinkingLevels := make([]string, 0, len(levelsOfThinking))

	for _, level := range levelsOfThinking {
		thinkingLevels = append(thinkingLevels, level.String())
	}

	return &output_itf.AgentDefaultOptionsInfo{
		TaskLevels:     taskLevels,
		Models:         models,
		ThinkingLevels: thinkingLevels,
	}, nil
}

func (a *API) addSessionTask(sessionID uuid.UUID, task *output_itf.RunTaskSpec, deps []uuid.UUID, autopilot bool) (uuid.UUID, error) {
	agentDefault, err := a.userConfig.AgentDefault(enums.TaskLevel(task.TaskLevel))
	if err != nil {
		return uuid.Nil, err
	}

	return a.sessions.AddTask(sessionID, &core_itf.AddTask{
		Name:                 task.Name,
		AutoRetry:            task.AutoRetry,
		ManualAcceptRequired: task.ManualAcceptRequired && !autopilot,
		FileWriteAllowance:   enums.FileAllowAll,
		ExtraGuidance:        task.Prompt,
		DependsOn:            deps,
		AgentSpecs: &core_itf.AgentRequest{
			Name:          agentDefault.Model,
			Role:          task.Role,
			ThinkingLevel: agentDefault.ThinkingLevel,
			SystemPrompts: task.SystemPrompts,
		},
	})
}

func resolveDeps(dependsOn []string, clientToTask map[string]uuid.UUID) ([]uuid.UUID, bool) {
	deps := make([]uuid.UUID, 0, len(dependsOn))

	for _, clientID := range dependsOn {
		taskID, found := clientToTask[clientID]
		if !found {
			return nil, false
		}

		deps = append(deps, taskID)
	}

	return deps, true
}

func (a *API) SessionStatus(sessionID string) (*output_itf.SessionStatusInfo, error) {
	parsed, err := sessionUUID(sessionID)
	if err != nil {
		return nil, err
	}

	status, err := a.sessions.Status(parsed)
	if err != nil {
		return nil, err
	}

	return sessionStatusInfo(status), nil
}

func (a *API) CancelSession(sessionID string) error {
	parsed, err := sessionUUID(sessionID)
	if err != nil {
		return err
	}

	return a.coordinator.Cancel(parsed)
}

func (a *API) RetrySessionTask(taskID string) error {
	parsed, err := uuid.Parse(taskID)
	if err != nil {
		return custom_error.Critical("invalid task id %s: %v", taskID, err)
	}

	return a.sessions.RetryTask(parsed)
}

func (a *API) AnswerTaskAcceptance(taskID string, accepted bool) error {
	parsed, err := uuid.Parse(taskID)
	if err != nil {
		return custom_error.Critical("invalid task id %s: %v", taskID, err)
	}

	return a.sessions.AnswerAcceptance(parsed, accepted)
}

func (a *API) SessionDrafts() ([]*output_itf.SessionDraftInfo, error) {
	stored, err := a.drafts.List()
	if err != nil {
		return nil, err
	}

	infos := make([]*output_itf.SessionDraftInfo, 0, len(stored))

	for _, draft := range stored {
		infos = append(infos, &output_itf.SessionDraftInfo{
			ID:        draft.ID.String(),
			Doc:       draft.Doc,
			UpdatedAt: draft.UpdatedAt.Format(time.RFC3339),
		})
	}

	return infos, nil
}

func (a *API) SaveSessionDraft(id string, doc string) error {
	parsed, err := draftUUID(id)
	if err != nil {
		return err
	}

	return a.drafts.Save(&input_itf.SessionDraftEntity{
		ID:        parsed,
		Doc:       doc,
		UpdatedAt: time.Now(),
	})
}

func (a *API) DeleteSessionDraft(id string) error {
	parsed, err := draftUUID(id)
	if err != nil {
		return err
	}

	return a.drafts.Delete(parsed)
}

func draftUUID(id string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, custom_error.Critical("invalid session draft id %s: %v", id, err)
	}

	return parsed, nil
}

func (a *API) MCPServers() ([]*output_itf.MCPServerInfo, error) {
	servers, err := a.mcpProxy.List()
	if err != nil {
		return nil, err
	}

	infos := make([]*output_itf.MCPServerInfo, 0, len(servers))

	for _, server := range servers {
		authorizedAt := ""
		if !server.InitializedAt.IsZero() {
			authorizedAt = server.InitializedAt.Format(time.RFC3339)
		}

		infos = append(infos, &output_itf.MCPServerInfo{
			Name:         server.ServerName,
			URL:          server.URL,
			Authorized:   server.Authenticated,
			AuthorizedAt: authorizedAt,
			Kind:         server.Kind,
		})
	}

	sort.Slice(infos, func(i, j int) bool { return infos[i].Name < infos[j].Name })

	return infos, nil
}

func (a *API) AuthorizeMCPServer(name string) error {
	return a.mcpProxy.Authorize(name)
}

func (a *API) SetMCPCredential(name, secret string) error {
	return a.mcpProxy.SetCredential(name, secret)
}

func sessionUUID(id string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, custom_error.Critical("invalid session id %s: %v", id, err)
	}

	return parsed, nil
}

func sessionStatusInfo(status *core_itf.SessionStatus) *output_itf.SessionStatusInfo {
	if status == nil {
		return nil
	}

	tasks := make([]*output_itf.SessionTaskInfo, 0, len(status.Tasks))

	for taskID, report := range status.Tasks {
		tasks = append(tasks, sessionTaskInfo(taskID, report))
	}

	sort.Slice(tasks, func(i, j int) bool { return tasks[i].TaskID < tasks[j].TaskID })

	return &output_itf.SessionStatusInfo{
		SessionID: status.ID.String(),
		Status:    string(status.Status),
		Tasks:     tasks,
	}
}

func sessionTaskInfo(taskID uuid.UUID, report *core_itf.TaskReport) *output_itf.SessionTaskInfo {
	info := &output_itf.SessionTaskInfo{
		TaskID:       taskID.String(),
		FileChanges:  []*output_itf.FileChangeInfo{},
		HandoverDocs: []*output_itf.HandoverDocInfo{},
	}

	if report == nil {
		return info
	}

	info.Status = string(report.Status)

	for _, change := range report.FileChanges {
		info.FileChanges = append(info.FileChanges, fileChangeInfo(change))
	}

	for _, doc := range report.HandoverDocs {
		info.HandoverDocs = append(info.HandoverDocs, handoverDocInfo(doc))
	}

	return info
}

func fileChangeInfo(change *core_itf.FileChange) *output_itf.FileChangeInfo {
	if change == nil {
		return nil
	}

	return &output_itf.FileChangeInfo{
		Path:        change.Path,
		OldPath:     change.OldPath,
		ChangeType:  change.ChangeType.String(),
		Additions:   change.Additions,
		Deletions:   change.Deletions,
		UnifiedDiff: change.UnifiedDiff,
	}
}

func handoverDocInfo(doc *core_itf.HandoverDoc) *output_itf.HandoverDocInfo {
	if doc == nil {
		return nil
	}

	return &output_itf.HandoverDocInfo{
		Task:              doc.Task,
		Outcome:           doc.Outcome,
		Blockers:          doc.Blockers,
		ApprovedDecisions: doc.ApprovedDecisions,
		RejectedDecisions: doc.RejectedDecisions,
		CurrentBehaviors:  doc.CurrentBehaviors,
		ChangedBehaviors:  doc.ChangedBehaviors,
		MustAvoid:         doc.MustAvoid,
		Nuances:           doc.Nuances,
		KnownGaps:         doc.KnownGaps,
	}
}
