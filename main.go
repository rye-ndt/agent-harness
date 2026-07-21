package main

import (
	"embed"
	"log"

	output_itf "hexago/internal/interface/output"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app, err := wire()
	if err != nil {
		log.Fatalf("wire: %v", err)
	}

	cfg := app.Config.Read()

	if cfg == nil {
		log.Fatalf("config not found")
	}

	if err := app.AppBuilder.Run(&output_itf.AppBuilderOption{
		Title:            cfg.App.Name,
		Width:            cfg.App.W,
		Height:           cfg.App.H,
		Assets:           assets,
		BackgroundColour: cfg.App.Bg,
		Bind: []any{
			app.API,
		},
	}); err != nil {
		app.Logger.Error("app run", "err", err)
	}
}
