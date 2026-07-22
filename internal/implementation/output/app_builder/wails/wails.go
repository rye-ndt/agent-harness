package wails

import (
	"embed"
	"hexago/internal/implementation/helpers"
	"hexago/internal/implementation/input/wailsapi"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

var assets embed.FS

type wailsInstance struct {
	config       input_itf.Config
	logger       output_itf.Logger
	agentManager output_itf.AgentManager
}

func New(
	config input_itf.Config,
	logger output_itf.Logger,
	agentManager output_itf.AgentManager,
) output_itf.AppBuilder {
	return &wailsInstance{
		config:       config,
		logger:       logger,
		agentManager: agentManager,
	}
}

func (w *wailsInstance) Run() error {
	app := w.config.Read().App

	api := wailsapi.New(w.config, w.logger, w.agentManager)

	return wails.Run(&options.App{
		Title:            app.Name,
		Width:            app.W,
		Height:           app.H,
		Assets:           assets,
		BackgroundColour: helpers.HexColour(app.Bg),
		OnStartup:        api.Startup,
		Bind: []any{
			api,
		},
	})
}
