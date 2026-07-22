// Package wailsapi is the input implementation bound to the Wails frontend:
// its exported methods are callable from JavaScript.
package wailsapi

import (
	"context"
	"sort"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"hexago/internal/implementation/helpers/enums"
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
	cfg          input_itf.Config
	log          output_itf.Logger
	agentManager output_itf.AgentManager
}

func New(cfg input_itf.Config, log output_itf.Logger, agentManager output_itf.AgentManager) *API {
	return &API{cfg: cfg, log: log, agentManager: agentManager}
}

// Startup is wired to Wails OnStartup; it is not meant to be called from JS.
func (a *API) Startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name.
func (a *API) Greet(name string) string {
	a.log.Info("greet called", "name", name)
	c := a.cfg.Read()
	return "Hello " + name + ", greetings from " + c.App.Name + " v" + c.Version
}

// SupportedAgents returns the names of the configured agent harnesses.
func (a *API) SupportedAgents() ([]string, error) {
	agents, err := a.agentManager.SupportedAgents()
	if err != nil {
		a.log.Error("supported agents", "err", err)
		return nil, err
	}

	names := make([]string, 0, len(agents))
	for _, agent := range agents {
		names = append(names, agent.String())
	}

	sort.Strings(names)

	return names, nil
}

type AgentInfo struct {
	ID     string                 `json:"id"`
	Status *input_itf.AgentStatus `json:"status"`
}

func (a *API) AgentStatuses() ([]AgentInfo, error) {
	agents, err := a.agentManager.SupportedAgents()
	if err != nil {
		a.log.Error("agent statuses", "err", err)
		return nil, err
	}

	infos := make([]AgentInfo, 0, len(agents))
	for _, agent := range agents {
		h, err := a.agentManager.Harness(agent)
		if err != nil {
			a.log.Error("agent statuses", "agent", agent, "err", err)
			return nil, err
		}

		status, err := h.Status()
		if err != nil {
			a.log.Error("agent statuses", "agent", agent, "err", err)
			return nil, err
		}

		infos = append(infos, AgentInfo{ID: agent.String(), Status: status})
	}

	sort.Slice(infos, func(i, j int) bool { return infos[i].ID < infos[j].ID })

	return infos, nil
}

func (a *API) InstallAgent(id string) error {
	h, err := a.agentManager.Harness(enums.AgentHarness(id))
	if err != nil {
		a.log.Error("install agent", "agent", id, "err", err)
		return err
	}

	if err := h.Install(func(p input_itf.InstallProgress) {
		runtime.EventsEmit(a.ctx, installProgressEvent, id, p)
	}); err != nil {
		a.log.Error("install agent", "agent", id, "err", err)
		return err
	}

	return nil
}

func (a *API) SpawnAgent(id string) (string, error) {
	h, err := a.agentManager.Harness(enums.AgentHarness(id))
	if err != nil {
		a.log.Error("spawn agent", "agent", id, "err", err)
		return "", err
	}

	agent, err := h.Spawn()
	if err != nil {
		a.log.Error("spawn agent", "agent", id, "err", err)
		return "", err
	}

	out, err := h.Listen(agent.ID)
	if err != nil {
		a.log.Error("listen agent", "agent", id, "instance", agent.ID, "err", err)
		return "", err
	}

	go func() {
		for line := range out {
			runtime.EventsEmit(a.ctx, agentOutputEvent, id, agent.ID, line)
		}
		runtime.EventsEmit(a.ctx, agentClosedEvent, id, agent.ID)
	}()

	return agent.ID, nil
}

func (a *API) SendToAgent(id string, agentID string, message string) error {
	h, err := a.agentManager.Harness(enums.AgentHarness(id))
	if err != nil {
		a.log.Error("send to agent", "agent", id, "instance", agentID, "err", err)
		return err
	}

	if err := h.Send(agentID, message); err != nil {
		a.log.Error("send to agent", "agent", id, "instance", agentID, "err", err)
		return err
	}

	return nil
}

func (a *API) KillAgent(id string, agentID string) error {
	h, err := a.agentManager.Harness(enums.AgentHarness(id))
	if err != nil {
		a.log.Error("kill agent", "agent", id, "instance", agentID, "err", err)
		return err
	}

	if err := h.Kill(agentID); err != nil {
		a.log.Error("kill agent", "agent", id, "instance", agentID, "err", err)
		return err
	}

	return nil
}

func (a *API) UninstallAgent(id string) error {
	h, err := a.agentManager.Harness(enums.AgentHarness(id))
	if err != nil {
		a.log.Error("uninstall agent", "agent", id, "err", err)
		return err
	}

	if err := h.Uninstall(); err != nil {
		a.log.Error("uninstall agent", "agent", id, "err", err)
		return err
	}

	return nil
}
