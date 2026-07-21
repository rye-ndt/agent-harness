package main

import (
	viper "hexago/internal/implementation/input/config/viper"
	"hexago/internal/implementation/input/wailsapi"
	"hexago/internal/implementation/output/app_builder/wails"
	slogger "hexago/internal/implementation/output/logger/slog"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type App struct {
	Config     input_itf.Config
	Logger     output_itf.Logger
	AppBuilder output_itf.AppBuilder
	API        *wailsapi.API
}

// wire builds every implementation and connects it to its interface.
func wire() (*App, error) {
	cfg, err := viper.New("config.yaml")
	if err != nil {
		return nil, err
	}

	logger := slogger.New(cfg)

	appBuilder := wails.New(cfg, logger)

	return &App{
		Config:     cfg,
		Logger:     logger,
		AppBuilder: appBuilder,
		API:        wailsapi.New(cfg, logger),
	}, nil
}
