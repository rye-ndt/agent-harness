package main

import (
	"os"
	"path/filepath"
	"time"

	"hexago/internal/implementation/core/agent_manager"
	viper "hexago/internal/implementation/input/config"
	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/input/storage"
	wails "hexago/internal/implementation/output/app_builder"
	wails_api "hexago/internal/implementation/output/fe_api"
	slogger "hexago/internal/implementation/output/logger"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type App struct {
	Config       input_itf.Config
	Logger       output_itf.Logger
	AppBuilder   output_itf.AppBuilder
	HttpFetcher  input_itf.HttpCli
	Storage      input_itf.HarnessStorage
	AgentManager core_itf.AgentManager
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

	agentManager, err := agent_manager.InitV1(cfg, httpCli, store)
	if err != nil {
		return nil, err
	}

	feAPI := wails_api.New(agentManager)

	appBuilder := wails.New(cfg, feAPI)

	return &App{
		Config:       cfg,
		Logger:       logger,
		AppBuilder:   appBuilder,
		HttpFetcher:  httpCli,
		Storage:      store,
		AgentManager: agentManager,
	}, nil
}
