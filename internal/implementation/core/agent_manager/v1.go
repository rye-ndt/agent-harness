package agent_manager

import (
	"sync"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/implementation/input/harness"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"

	mapstructure "github.com/go-viper/mapstructure/v2"
	"github.com/google/uuid"
)

type connectivity struct {
	CheckedAt time.Time
	Err       error
}

type agentManagerV1 struct {
	locker         sync.Mutex
	cfg            *input_itf.AgentManagerConfig
	httpCli        input_itf.HttpCli
	harnessTool    map[enums.AgentHarness]input_itf.AgentHarness
	instances      map[enums.ModelName][]*core_itf.Agent
	heartBeats     map[uuid.UUID]int64
	approvalBroker core_itf.ApprovalBroker
	online         connectivity
}

func InitV1(
	cfg input_itf.Config,
	httpCli input_itf.HttpCli,
	store input_itf.HarnessStorage,
	mcpGateway *core_itf.MCPGateway,
	approvalBroker core_itf.ApprovalBroker,
) (core_itf.AgentManager, error) {
	managerCfg := cfg.Read().AgentManager
	if managerCfg == nil {
		return nil, custom_error.Critical("agent manager config not found")
	}

	supportedAgents := cfg.Read().AgentHarness

	list := map[enums.AgentHarness]input_itf.AgentHarness{}

	for name, config := range supportedAgents {
		switch name {
		case enums.ClaudeCode:
			claudeCfg, err := decodeAgentCfg[harness.ClaudeCodeCfg](config)
			if err != nil {
				return nil, err
			}

			claudeManager, err := harness.NewClaudeCode(cfg, httpCli, store, mcpGateway, claudeCfg)
			if err != nil {
				return nil, err
			}

			list[enums.ClaudeCode] = claudeManager

		case enums.OpenCode:
			openCodeCfg, err := decodeAgentCfg[harness.OpenCodeCfg](config)
			if err != nil {
				return nil, err
			}

			openCodeManager, err := harness.NewOpenCode(cfg, httpCli, store, mcpGateway, openCodeCfg)
			if err != nil {
				return nil, err
			}

			list[enums.OpenCode] = openCodeManager

		default:
			return nil, custom_error.Critical("agent harness %s has no initializer", name)
		}
	}

	return &agentManagerV1{
		locker:         sync.Mutex{},
		cfg:            managerCfg,
		httpCli:        httpCli,
		harnessTool:    list,
		instances:      map[enums.ModelName][]*core_itf.Agent{},
		heartBeats:     map[uuid.UUID]int64{},
		approvalBroker: approvalBroker,
	}, nil
}

func (m *agentManagerV1) HeartBeat(agentID uuid.UUID) error {
	if agentID == uuid.Nil {
		return custom_error.Critical("heartbeat needs an agent id")
	}

	var err error
	var instance *core_itf.Agent
	var model enums.ModelName

	m.raceSafe(func() {
		instance, model = m.findInstance(agentID)
		if instance == nil {
			err = custom_error.Critical("agent %v not found", agentID)
			return
		}

		if instance.HealthStatus == enums.Terminated {
			err = custom_error.Critical("agent %v is already terminated", agentID)
			return
		}

		m.heartBeats[agentID] = helpers.NewUTCUnix()
	})

	if err != nil {
		return err
	}

	tool, found := m.harnessFor(model)
	if !found {
		return custom_error.Critical("no harness client support model %s", model)
	}

	lastOut, err := tool.Alive(agentID.String())
	if err != nil {
		m.raceSafe(func() {
			instance.HealthStatus = enums.Terminated
			instance.TerminatedAt = helpers.NewUTC()
		})

		return custom_error.Critical("session of agent %v is gone: %v", agentID, err)
	}

	if m.approvalBroker.Awaiting(agentID) {
		m.raceSafe(func() {
			m.heartBeats[agentID] = helpers.NewUTCUnix()

			instance.HealthStatus = enums.AwaitingHuman
		})

		return nil
	}

	if frozenFor := time.Since(lastOut); frozenFor > m.cfg.FreezeTimeout {
		m.raceSafe(func() {
			instance.HealthStatus = enums.NotResponding
		})

		return custom_error.Critical("session of agent %v is frozen, silent for %v", agentID, frozenFor)
	}

	if err := m.checkConnectivity(); err != nil {
		return custom_error.Critical("session of agent %v is offline: %v", agentID, err)
	}

	m.raceSafe(func() {
		m.heartBeats[agentID] = helpers.NewUTCUnix()

		instance.HealthStatus = enums.Healthy
	})

	return nil
}

func (m *agentManagerV1) checkConnectivity() error {
	var probe bool

	m.raceSafe(func() {
		probe = time.Since(m.online.CheckedAt) > m.cfg.ConnectivityCacheTTL
	})

	if !probe {
		var cached error
		m.raceSafe(func() { cached = m.online.Err })

		return cached
	}

	_, err := m.httpCli.GetString(m.cfg.ConnectivityProbeURL)

	m.raceSafe(func() {
		m.online = connectivity{
			CheckedAt: helpers.NewUTC(),
			Err:       err,
		}
	})

	return err
}

func (m *agentManagerV1) findInstance(agentID uuid.UUID) (*core_itf.Agent, enums.ModelName) {
	for model, agents := range m.instances {
		for _, agent := range agents {
			if agent.ID == agentID {
				return agent, model
			}
		}
	}

	return nil, enums.ModelUnknown
}

func (m *agentManagerV1) harnessFor(model enums.ModelName) (input_itf.AgentHarness, bool) {
	for _, tool := range m.harnessTool {
		if tool.Support(model) {
			return tool, true
		}
	}

	return nil, false
}

func (m *agentManagerV1) raceSafe(exec func()) {
	m.locker.Lock()
	defer m.locker.Unlock()
	exec()
}

func (m *agentManagerV1) Admin(name enums.AgentHarness) (input_itf.AgentAdmin, error) {
	tool, found := m.harnessTool[name]
	if !found {
		return nil, custom_error.Critical("no configured harness named %s", name)
	}

	return tool, nil
}

func (m *agentManagerV1) RequestInstance(specs *core_itf.AgentRequest) (*core_itf.Agent, error) {
	tool, found := m.harnessFor(specs.Name)
	if !found {
		return nil, custom_error.Critical("no harness client support model %s", specs.Name)
	}

	agentID, err := tool.Spawn(specs.Name, specs.ThinkingLevel, specs.SystemPrompts)
	if err != nil {
		return nil, err
	}

	info := &core_itf.Agent{
		ID:            agentID,
		Name:          specs.Name,
		Role:          specs.Role,
		ThinkingLevel: specs.ThinkingLevel,
		HealthStatus:  enums.Healthy,
		SpawnedAt:     helpers.NewUTC(),
	}

	clone := *info

	m.raceSafe(func() {
		m.instances[specs.Name] = append(m.instances[specs.Name], info)
		m.heartBeats[agentID] = helpers.NewUTCUnix()
	})

	return &clone, nil
}

func (m *agentManagerV1) Instance(agentID uuid.UUID) (*core_itf.Agent, error) {
	var instance *core_itf.Agent

	m.raceSafe(func() {
		instance, _ = m.findInstance(agentID)
		if instance == nil {
			return
		}
	})

	if instance == nil {
		return nil, custom_error.Critical("agent %v not found", agentID)
	}

	return instance, nil
}

func (m *agentManagerV1) Kill(agentID uuid.UUID) error {
	var instance *core_itf.Agent
	var model enums.ModelName

	m.raceSafe(func() {
		instance, model = m.findInstance(agentID)
	})

	if instance == nil {
		return custom_error.Critical("agent %v not found", agentID)
	}

	tool, found := m.harnessFor(model)
	if !found {
		return custom_error.Critical("no harness client support model %s", model)
	}

	killErr := tool.Kill(agentID.String())

	m.raceSafe(func() {
		instance.HealthStatus = enums.Terminated
		instance.TerminatedAt = helpers.NewUTC()
		delete(m.heartBeats, agentID)
	})

	return killErr
}

func (m *agentManagerV1) SupportedAgents() (map[enums.AgentHarness][]enums.ModelName, error) {
	if m == nil {
		return nil, custom_error.Critical("agent manager is not initialized")
	}

	supported := map[enums.AgentHarness][]enums.ModelName{}

	for name, tool := range m.harnessTool {
		supported[name] = tool.SupportedModels()
	}

	return supported, nil
}

func (m *agentManagerV1) Send(agentID uuid.UUID, message string) error {
	tool, err := m.toolForAgent(agentID)
	if err != nil {
		return err
	}

	return tool.Send(agentID.String(), message)
}

func (m *agentManagerV1) Listen(agentID uuid.UUID) (<-chan string, error) {
	tool, err := m.toolForAgent(agentID)
	if err != nil {
		return nil, err
	}

	return tool.Listen(agentID.String())
}

func (m *agentManagerV1) ContextUsage(agentID uuid.UUID) (*input_itf.ContextUsage, error) {
	tool, err := m.toolForAgent(agentID)
	if err != nil {
		return nil, err
	}

	return tool.Usage(agentID.String())
}

func (m *agentManagerV1) toolForAgent(agentID uuid.UUID) (input_itf.AgentHarness, error) {
	var model enums.ModelName
	var agent *core_itf.Agent

	m.raceSafe(func() {
		agent, model = m.findInstance(agentID)
	})

	if agent == nil {
		return nil, custom_error.Critical("agent %v not found", agentID)
	}

	tool, found := m.harnessFor(model)
	if !found {
		return nil, custom_error.Critical("no harness client support model %s", model)
	}

	return tool, nil
}

func decodeAgentCfg[T any](raw map[string]any) (*T, error) {
	out := new(T)

	dec, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		DecodeHook: mapstructure.StringToTimeDurationHookFunc(),
		Result:     out,
	})
	if err != nil {
		return nil, err
	}

	if err := dec.Decode(raw); err != nil {
		return nil, err
	}

	if err := helpers.ValidateStruct(out); err != nil {
		return nil, custom_error.Critical("invalid agent harness config: %v", err)
	}

	return out, nil
}
