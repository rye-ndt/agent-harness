package app_builder

import (
	"io/fs"

	"hexago/internal/helpers"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

type wailsInstance struct {
	config input_itf.Config
	api    output_itf.FEAPI
	assets fs.FS
}

func New(
	config input_itf.Config,
	api output_itf.FEAPI,
	assets fs.FS,
) output_itf.AppBuilder {
	return &wailsInstance{
		config: config,
		api:    api,
		assets: assets,
	}
}

func (w *wailsInstance) Run() error {
	app := w.config.Read().App

	return wails.Run(&options.App{
		Title:             app.Name,
		Width:             app.W,
		Height:            app.H,
		Assets:            w.assets,
		BackgroundColour:  helpers.HexColour(app.Bg),
		HideWindowOnClose: true,
		Menu: menu.NewMenuFromItems(
			menu.AppMenu(),
			menu.EditMenu(),
			menu.WindowMenu(),
		),
		Mac:        &mac.Options{},
		OnStartup:  w.api.Startup,
		OnShutdown: w.api.Shutdown,
		Bind: []any{
			w.api,
		},
	})
}
