package agent_manager

import (
	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/implementation/helpers/enums"
	"hexago/internal/implementation/input/harness"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	mapstructure "github.com/go-viper/mapstructure/v2"
)

type agentManagerV1 struct {
	agentList map[enums.AgentHarness]input_itf.AgentHarness
}

func InitAgentManagerV1(
	cfg input_itf.Config,
	httpCli input_itf.HttpCli,
	store output_itf.HarnessStorage,
) (output_itf.AgentManager, error) {
	supportedAgents := cfg.Read().AgentHarness

	list := map[enums.AgentHarness]input_itf.AgentHarness{}

	for name, config := range supportedAgents {
		switch name {
		case enums.ClaudeCode:
			claudeCfg, err := decodeAgentCfg[harness.ClaudeCodeCfg](config)
			if err != nil {
				return nil, err
			}

			p := &harness.ClaudeManagerParams{
				GlobalCfg:     cfg,
				ClaudeCodeCfg: claudeCfg,
				HttpCli:       httpCli,
				Storage:       store,
			}

			claudeManager, err := harness.NewClaudeCode(p)
			if err != nil {
				return nil, err
			}

			list[enums.ClaudeCode] = claudeManager

		case enums.OpenCode:
			openCodeCfg, err := decodeAgentCfg[harness.OpenCodeCfg](config)
			if err != nil {
				return nil, err
			}

			p := &harness.OpenCodeManagerParams{
				GlobalCfg:   cfg,
				OpenCodeCfg: openCodeCfg,
				HttpCli:     httpCli,
				Storage:     store,
			}

			openCodeManager, err := harness.NewOpenCode(p)
			if err != nil {
				return nil, err
			}

			list[enums.OpenCode] = openCodeManager
		}
	}

	return &agentManagerV1{
		agentList: list,
	}, nil
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

	return out, nil
}

func (m *agentManagerV1) SupportedAgents() ([]enums.AgentHarness, error) {
	if m == nil {
		return nil, custom_error.Critical("agent manager is not initialized")
	}

	result := []enums.AgentHarness{}

	for k := range m.agentList {
		result = append(result, k)
	}

	return result, nil
}
