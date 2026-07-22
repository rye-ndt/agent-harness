package main

import (
	"os"
	"path/filepath"
	"time"

	"hexago/internal/implementation/core/custom_error"
	viper "hexago/internal/implementation/input/config/viper"
	"hexago/internal/implementation/input/harness"
	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/output/app_builder/wails"
	slogger "hexago/internal/implementation/output/logger/slog"
	"hexago/internal/implementation/output/storage"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type App struct {
	Config       input_itf.Config
	Logger       output_itf.Logger
	AppBuilder   output_itf.AppBuilder
	HttpFetcher  input_itf.HttpCli
	Storage      output_itf.HarnessStorage
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

	base, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	store, err := storage.New(filepath.Join(base, cfg.Read().App.Name, "harness.db"))
	if err != nil {
		return nil, err
	}

	claudeCodeCfg := cfg.Read().Harness("claude_code")
	if claudeCodeCfg == nil {
		return nil, custom_error.Critical("no agent_harness entry named claude_code in config")
	}

	harnessAgent, err := harness.New(cfg, claudeCodeCfg, httpCli, store)
	if err != nil {
		return nil, err
	}

	return &App{
		Config:       cfg,
		Logger:       logger,
		AppBuilder:   appBuilder,
		HttpFetcher:  httpCli,
		Storage:      store,
		HarnessAgent: harnessAgent,
	}, nil
}
