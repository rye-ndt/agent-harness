package user_config

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	output_itf "hexago/internal/interface/output"
)

type file struct {
	AgentDefaults map[enums.TaskLevel]*output_itf.AgentDefault `json:"agent_defaults"`
}

type v1 struct {
	path string
	mu   sync.RWMutex
	cfg  *file
}

var seedAgentDefaults = map[enums.TaskLevel]*output_itf.AgentDefault{
	enums.LightweightTask:   {Model: enums.Haiku, ThinkingLevel: enums.LowThinking},
	enums.DailyTask:         {Model: enums.Sonnet, ThinkingLevel: enums.MedThinking},
	enums.HeavyTask:         {Model: enums.Opus, ThinkingLevel: enums.HighThinking},
	enums.MaximumEffortTask: {Model: enums.Fable, ThinkingLevel: enums.MaxThinking},
}

func InitV1(path string) (output_itf.UserConfig, error) {
	if path == "" {
		return nil, custom_error.Critical("user config path is empty")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, custom_error.Critical("cannot create user config dir: %v", err)
	}

	cfg, err := read(path)
	if err != nil {
		return nil, err
	}

	c := &v1{path: path, cfg: cfg}

	if err := c.write(); err != nil {
		return nil, err
	}

	return c, nil
}

func read(path string) (*file, error) {
	cfg := &file{AgentDefaults: map[enums.TaskLevel]*output_itf.AgentDefault{}}

	raw, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, custom_error.Critical("cannot read user config %s: %v", path, err)
	}

	if len(raw) > 0 {
		if err := json.Unmarshal(raw, cfg); err != nil {
			return nil, custom_error.Critical("cannot decode user config %s: %v", path, err)
		}
	}

	if cfg.AgentDefaults == nil {
		cfg.AgentDefaults = map[enums.TaskLevel]*output_itf.AgentDefault{}
	}

	for _, level := range enums.TaskLevels() {
		stored := cfg.AgentDefaults[level]
		if stored != nil && helpers.ValidateStruct(stored) == nil {
			continue
		}

		seed := seedAgentDefaults[level]
		cfg.AgentDefaults[level] = &output_itf.AgentDefault{Model: seed.Model, ThinkingLevel: seed.ThinkingLevel}
	}

	for level := range cfg.AgentDefaults {
		if !level.Valid() {
			delete(cfg.AgentDefaults, level)
		}
	}

	return cfg, nil
}

func (c *v1) AgentDefaults() map[enums.TaskLevel]*output_itf.AgentDefault {
	c.mu.RLock()
	defer c.mu.RUnlock()

	defaults := make(map[enums.TaskLevel]*output_itf.AgentDefault, len(c.cfg.AgentDefaults))

	for level, stored := range c.cfg.AgentDefaults {
		defaults[level] = &output_itf.AgentDefault{Model: stored.Model, ThinkingLevel: stored.ThinkingLevel}
	}

	return defaults
}

func (c *v1) AgentDefault(level enums.TaskLevel) (*output_itf.AgentDefault, error) {
	if !level.Valid() {
		return nil, custom_error.Critical("unknown task level %q", level.String())
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	stored := c.cfg.AgentDefaults[level]
	if stored == nil {
		return nil, custom_error.Critical("task level %q has no agent default", level.String())
	}

	return &output_itf.AgentDefault{Model: stored.Model, ThinkingLevel: stored.ThinkingLevel}, nil
}

func (c *v1) SetAgentDefault(level enums.TaskLevel, agentDefault *output_itf.AgentDefault) error {
	if !level.Valid() {
		return custom_error.Critical("unknown task level %q", level.String())
	}

	if agentDefault == nil {
		return custom_error.Critical("agent default for %q is empty", level.String())
	}

	if err := helpers.ValidateStruct(agentDefault); err != nil {
		return custom_error.Critical("invalid agent default for %q: %v", level.String(), err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	previous := c.cfg.AgentDefaults[level]
	c.cfg.AgentDefaults[level] = &output_itf.AgentDefault{
		Model:         agentDefault.Model,
		ThinkingLevel: agentDefault.ThinkingLevel,
	}

	if err := c.write(); err != nil {
		c.cfg.AgentDefaults[level] = previous
		return err
	}

	return nil
}

func (c *v1) write() error {
	raw, err := json.MarshalIndent(c.cfg, "", "  ")
	if err != nil {
		return custom_error.Critical("cannot encode user config: %v", err)
	}

	tmp := c.path + ".tmp"

	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return custom_error.Critical("cannot write user config %s: %v", filepath.Base(c.path), err)
	}

	if err := os.Rename(tmp, c.path); err != nil {
		os.Remove(tmp)
		return custom_error.Critical("cannot save user config %s: %v", filepath.Base(c.path), err)
	}

	return nil
}
