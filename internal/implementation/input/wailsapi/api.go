// Package wailsapi is the input implementation bound to the Wails frontend:
// its exported methods are callable from JavaScript.
package wailsapi

import (
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type API struct {
	cfg input_itf.Config
	log output_itf.Logger
}

func New(cfg input_itf.Config, log output_itf.Logger) *API {
	return &API{cfg: cfg, log: log}
}

// Greet returns a greeting for the given name.
func (a *API) Greet(name string) string {
	a.log.Info("greet called", "name", name)
	c := a.cfg.Read()
	return "Hello " + name + ", greetings from " + c.App.Name + " v" + c.Version
}
