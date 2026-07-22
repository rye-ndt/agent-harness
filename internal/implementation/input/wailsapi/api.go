// Package wailsapi is the input implementation bound to the Wails frontend:
// its exported methods are callable from JavaScript.
package wailsapi

import (
	"context"
	"sort"

	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

const installProgressEvent = "harness:install:progress"

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
