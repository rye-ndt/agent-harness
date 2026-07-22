package enums

type AgentHarness string

const (
	ClaudeCode AgentHarness = "claude_code"
	Codex      AgentHarness = "codex"
	OpenCode   AgentHarness = "open_code"
)

func (a AgentHarness) String() string {
	return string(a)
}
