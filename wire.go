package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/agent_manager"
	"hexago/internal/implementation/core/coordinator"
	"hexago/internal/implementation/core/manual_approval_broker"
	"hexago/internal/implementation/core/mcp_proxy"
	"hexago/internal/implementation/core/session_manager"
	"hexago/internal/implementation/core/template_manager"
	"hexago/internal/implementation/core/wal_sync"
	"hexago/internal/implementation/input/config"
	"hexago/internal/implementation/input/harness/claude_code"
	"hexago/internal/implementation/input/harness/open_code"
	"hexago/internal/implementation/input/http_cli"
	"hexago/internal/implementation/input/storage"
	"hexago/internal/implementation/input/wal"
	"hexago/internal/implementation/output/app_builder"
	wails_api "hexago/internal/implementation/output/fe_api"
	"hexago/internal/implementation/output/logger"
	"hexago/internal/implementation/output/message_queue"
	"hexago/internal/implementation/output/user_config"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type App struct {
	Config          input_itf.Config
	Logger          output_itf.Logger
	AppBuilder      output_itf.AppBuilder
	HttpFetcher     input_itf.HttpCli
	Storage         input_itf.HarnessStorage
	TaskStore       input_itf.TaskStorage
	TaskWAL         input_itf.TaskWAL
	AgentManager    core_itf.AgentManager
	TemplateManager core_itf.AgentTemplateManager
	MCPProxy        core_itf.MCPProxyServer
	ApprovalBroker  core_itf.ApprovalBroker
	SessionManager  core_itf.SessionManager
	Coordinator     core_itf.Coordinator
	UserConfig      output_itf.UserConfig
}

func wire(assets fs.FS) (*App, error) {
	cfg, err := config.New("config.yaml")
	if err != nil {
		return nil, err
	}

	appLogger := logger.New(cfg)

	httpCli := http_cli.New(&http_cli.BasicHttpCliCfg{Timeout: 30 * time.Second})

	base, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	store, err := storage.New(filepath.Join(base, cfg.Read().App.DataDir,"harness.db"))
	if err != nil {
		return nil, err
	}

	taskWAL, err := wal.New(filepath.Join(base, cfg.Read().App.DataDir,"task.wal"))
	if err != nil {
		return nil, err
	}

	userCfg, err := user_config.InitV1(filepath.Join(base, cfg.Read().App.DataDir,"user_config.json"))
	if err != nil {
		return nil, err
	}

	taskStore := store.TaskStore()

	dataWarning := ""
	if err := wal_sync.Run(taskWAL, taskStore); err != nil {
		appLogger.Error("wal sync", "err", err)
		dataWarning = "Task history from the previous session is corrupted or could not be saved. The app will continue without it."
	}

	mq := message_queue.InitV1()

	sessionCfg := cfg.Read().Session
	if sessionCfg == nil {
		return nil, custom_error.Critical("session config not found")
	}

	sessionManager, err := session_manager.InitV1(sessionCfg, taskWAL, mq)
	if err != nil {
		return nil, err
	}

	mcpCfg := cfg.Read().MCPServers
	if mcpCfg == nil {
		return nil, custom_error.Critical("mcp server config not found")
	}

	approvalBroker, err := manual_approval_broker.InitV1(cfg.Read().ApprovalBroker)
	if err != nil {
		return nil, err
	}

	mcpProxy, err := mcp_proxy.InitV1(mcpCfg, store.MCPStore(), httpCli, approvalBroker, sessionManager)
	if err != nil {
		return nil, err
	}

	mcpGateway, err := mcpProxy.Serve()
	if err != nil {
		return nil, err
	}

	managerCfg := cfg.Read().AgentManager
	if managerCfg == nil {
		mcpProxy.Close()
		return nil, custom_error.Critical("agent manager config not found")
	}

	harnesses := map[enums.AgentHarness]input_itf.AgentHarness{}

	for name, raw := range cfg.Read().AgentHarness {
		switch name {
		case enums.ClaudeCode:
			claudeHarness, err := claude_code.New(cfg, httpCli, store, mcpGateway, raw)
			if err != nil {
				mcpProxy.Close()
				return nil, err
			}

			harnesses[enums.ClaudeCode] = claudeHarness

		case enums.OpenCode:
			openCodeHarness, err := open_code.New(cfg, httpCli, store, mcpGateway, raw)
			if err != nil {
				mcpProxy.Close()
				return nil, err
			}

			harnesses[enums.OpenCode] = openCodeHarness

		default:
			mcpProxy.Close()
			return nil, custom_error.Critical("agent harness %s has no initializer", name)
		}
	}

	agentManager, err := agent_manager.InitV1(managerCfg, httpCli, harnesses, approvalBroker)
	if err != nil {
		mcpProxy.Close()
		return nil, err
	}

	sessionManager.TrackLiveAgents(agentManager)

	sessionCoordinator, err := coordinator.InitV1(sessionCfg, sessionManager, agentManager)
	if err != nil {
		mcpProxy.Close()
		return nil, err
	}

	templateManager, err := template_manager.InitV1(store.TemplateStore())
	if err != nil {
		mcpProxy.Close()
		return nil, err
	}

	feAPI := wails_api.New(&wails_api.Deps{
		AgentManager: agentManager,
		MCPProxy:     mcpProxy,
		Approvals:    approvalBroker,
		Templates:    templateManager,
		Sessions:     sessionManager,
		Coordinator:  sessionCoordinator,
		UserConfig:   userCfg,
		Drafts:       store.DraftStore(),
		DataWarning:  dataWarning,
	})

	appBuilder := app_builder.New(cfg, feAPI, assets)

	return &App{
		Config:          cfg,
		Logger:          appLogger,
		AppBuilder:      appBuilder,
		HttpFetcher:     httpCli,
		Storage:         store,
		TaskStore:       taskStore,
		TaskWAL:         taskWAL,
		AgentManager:    agentManager,
		TemplateManager: templateManager,
		MCPProxy:        mcpProxy,
		ApprovalBroker:  approvalBroker,
		SessionManager:  sessionManager,
		Coordinator:     sessionCoordinator,
		UserConfig:      userCfg,
	}, nil
}
