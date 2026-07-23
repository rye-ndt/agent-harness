package wails

import (
	"embed"
	"hexago/internal/helpers"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

var assets embed.FS

type wailsInstance struct {
	config input_itf.Config
	api    output_itf.FEAPI
}

func New(
	config input_itf.Config,
	api output_itf.FEAPI,
) output_itf.AppBuilder {
	return &wailsInstance{
		config: config,
		api:    api,
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
		OnStartup:        w.api.Startup,
		Bind: []any{
			w.api,
		},
	})
}
