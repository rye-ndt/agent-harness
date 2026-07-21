package main

import (
	"log"
)

func main() {
	app, err := wire()
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
