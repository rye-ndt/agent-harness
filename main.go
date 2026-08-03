package main

import (
	"embed"
	"log"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app, err := wire(assets)
	if err != nil {
		log.Fatalf("wire: %v", err)
	}

	cfg := app.Config.Read()

	if cfg == nil {
		log.Fatalf("config not found")
	}

	if err := app.AppBuilder.Run(); err != nil {
		app.Logger.Error("app run", "err", err)
	}
}
