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
	config input_itf.Config
	logger output_itf.Logger
}

func New(
	config input_itf.Config,
	logger output_itf.Logger,
) output_itf.AppBuilder {
	return &wailsInstance{
		config: config,
		logger: logger,
	}
}

func (w *wailsInstance) Run() error {
	app := w.config.Read().App

	return wails.Run(&options.App{
		Title:            app.Name,
		Width:            app.W,
		Height:           app.H,
		Assets:           assets,
		BackgroundColour: helpers.HexColour(app.Bg),
		Bind: []any{
			wailsapi.New(w.config, w.logger),
		},
	})
}
