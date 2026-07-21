package main

import (
	"time"

	viper "hexago/internal/implementation/input/config/viper"
	"hexago/internal/implementation/input/harness"
	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/output/app_builder/wails"
	slogger "hexago/internal/implementation/output/logger/slog"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type App struct {
	Config       input_itf.Config
	Logger       output_itf.Logger
	AppBuilder   output_itf.AppBuilder
	HttpFetcher  input_itf.HttpCli
	HarnessAgent input_itf.HarnessAgent
}

// wire builds every implementation and connects it to its interface.
func wire() (*App, error) {
	cfg, err := viper.New("config.yaml")
	if err != nil {
		return nil, err
	}

	logger := slogger.New(cfg)

	appBuilder := wails.New(cfg, logger)

	httpCli := http_cli.New(&http_cli.BasicHttpCliCfg{Timeout: 30 * time.Second})

	harnessAgent, err := harness.New(cfg, cfg.Read().AgentHarness.ClaudeCode, logger, httpCli)
	if err != nil {
		return nil, err
	}

	return &App{
		Config:       cfg,
		Logger:       logger,
		AppBuilder:   appBuilder,
		HttpFetcher:  httpCli,
		HarnessAgent: harnessAgent,
	}, nil
}
