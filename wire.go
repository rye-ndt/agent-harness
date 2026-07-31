package main

import (
	"os"
	"path/filepath"
	"time"

	"hexago/internal/implementation/core/agent_manager"
	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/implementation/core/manual_approval_broker"
	"hexago/internal/implementation/core/mcp_proxy"
	"hexago/internal/implementation/core/wal_sync"
	viper "hexago/internal/implementation/input/config"
	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/input/storage"
	"hexago/internal/implementation/input/wal"
	wails "hexago/internal/implementation/output/app_builder"
	wails_api "hexago/internal/implementation/output/fe_api"
	slogger "hexago/internal/implementation/output/logger"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type App struct {
	Config         input_itf.Config
	Logger         output_itf.Logger
	AppBuilder     output_itf.AppBuilder
	HttpFetcher    input_itf.HttpCli
	Storage        input_itf.HarnessStorage
	TaskStore      input_itf.TaskStorage
	TaskWAL        input_itf.TaskWAL
	AgentManager   core_itf.AgentManager
	MCPProxy       core_itf.MCPProxyServer
	ApprovalBroker core_itf.ApprovalBroker
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

	taskWAL, err := wal.New(filepath.Join(base, cfg.Read().App.Name, "task.wal"))
	if err != nil {
		return nil, err
	}

	taskStore := store.TaskStore()

	dataWarning := ""
	if err := wal_sync.Run(taskWAL, taskStore); err != nil {
		logger.Error("wal sync", "err", err)
		dataWarning = "Task history from the previous session is corrupted or could not be saved. The app will continue without it."
	}

	mcpCfg := cfg.Read().MCPServers
	if mcpCfg == nil {
		return nil, custom_error.Critical("mcp server config not found")
	}

	approvalBroker, err := manual_approval_broker.InitV1(cfg.Read().ApprovalBroker)
	if err != nil {
		return nil, err
	}

	mcpProxy, err := mcp_proxy.InitV1(mcpCfg, store.MCPStore(), httpCli, approvalBroker)
	if err != nil {
		return nil, err
	}

	mcpGateway, err := mcpProxy.Serve()
	if err != nil {
		return nil, err
	}

	agentManager, err := agent_manager.InitV1(cfg, httpCli, store, mcpGateway, approvalBroker)
	if err != nil {
		mcpProxy.Close()
		return nil, err
	}

	feAPI := wails_api.New(agentManager, mcpProxy, approvalBroker, dataWarning)

	appBuilder := wails.New(cfg, feAPI)

	return &App{
		Config:         cfg,
		Logger:         logger,
		AppBuilder:     appBuilder,
		HttpFetcher:    httpCli,
		Storage:        store,
		TaskStore:      taskStore,
		TaskWAL:        taskWAL,
		AgentManager:   agentManager,
		MCPProxy:       mcpProxy,
		ApprovalBroker: approvalBroker,
	}, nil
}
