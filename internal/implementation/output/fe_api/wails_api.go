package wails_api

import (
	"context"
	"sort"

	"github.com/wailsapp/wails/v2/pkg/runtime"

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

type API struct {
	ctx          context.Context
	agentManager core_itf.AgentManager
}

var _ output_itf.FEAPI = (*API)(nil)

func New(agentManager core_itf.AgentManager) *API {
	return &API{agentManager: agentManager}
}

// Startup is wired to Wails OnStartup; it is not meant to be called from JS.
func (a *API) Startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *API) harness(id string) (input_itf.AgentHarness, error) {
	return a.agentManager.Harness(enums.AgentHarness(id))
}

func (a *API) AgentStatuses() ([]output_itf.AgentInfo, error) {
	agents, err := a.agentManager.SupportedAgents()
	if err != nil {
		return nil, err
	}

	infos := make([]output_itf.AgentInfo, 0, len(agents))
	for _, agent := range agents {
		h, err := a.agentManager.Harness(agent)
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
	h, err := a.harness(id)
	if err != nil {
		return err
	}

	return h.Install(func(p input_itf.InstallProgress) {
		runtime.EventsEmit(a.ctx, installProgressEvent, id, p)
	})
}

func (a *API) SpawnAgent(id string) (string, error) {
	h, err := a.harness(id)
	if err != nil {
		return "", err
	}

	agent, err := h.Spawn()
	if err != nil {
		return "", err
	}

	out, err := h.Listen(agent.ID)
	if err != nil {
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
	h, err := a.harness(id)
	if err != nil {
		return err
	}

	return h.Send(agentID, message)
}

func (a *API) KillAgent(id string, agentID string) error {
	h, err := a.harness(id)
	if err != nil {
		return err
	}

	return h.Kill(agentID)
}

func (a *API) UninstallAgent(id string) error {
	h, err := a.harness(id)
	if err != nil {
		return err
	}

	return h.Uninstall()
}
