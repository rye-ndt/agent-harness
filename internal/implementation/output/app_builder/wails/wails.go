package wails

import (
	"hexago/internal/implementation/helpers"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

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

func (w *wailsInstance) Run(config *output_itf.AppBuilderOption) error {
	return wails.Run(&options.App{
		Title:  config.Title,
		Width:  config.Width,
		Height: config.Height,
		AssetServer: &assetserver.Options{
			Assets: config.Assets,
		},
		BackgroundColour: helpers.HexColour(config.BackgroundColour),
		Bind:             config.Bind,
	})
}
