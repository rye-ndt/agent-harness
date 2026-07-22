package main

import (
	"os"
	"path/filepath"
	"time"

	viper "hexago/internal/implementation/input/config/viper"
	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/output/agent_manager"
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
	AgentManager output_itf.AgentManager
}

func wire() (*App, error) {
	cfg, err := viper.New("config.yaml")
	if err != nil {
		return nil, err
	}

	logger := slogger.New(cfg)

	httpCli := http_cli.New(&http_cli.BasicHttpCliCfg{Timeout: 30 * time.Second})

	base, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	store, err := storage.New(filepath.Join(base, cfg.Read().App.Name, "harness.db"))
	if err != nil {
		return nil, err
	}

	agentManager, err := agent_manager.InitAgentManagerV1(cfg, httpCli, store)
	if err != nil {
		return nil, err
	}

	appBuilder := wails.New(cfg, logger, agentManager)

	return &App{
		Config:       cfg,
		Logger:       logger,
		AppBuilder:   appBuilder,
		HttpFetcher:  httpCli,
		Storage:      store,
		AgentManager: agentManager,
	}, nil
}
