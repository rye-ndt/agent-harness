package enums

type ModelFamily string

const (
	Claude   ModelFamily = "claude"
	GPT      ModelFamily = "gpt"
	Gwen     ModelFamily = "gwen"
	Deepseek ModelFamily = "deepseek"
)

type AgentHarness string

const (
	ClaudeCode AgentHarness = "claude_code"
	Codex      AgentHarness = "codex"
	OpenCode   AgentHarness = "open_code"
)

func (a AgentHarness) String() string {
	return string(a)
}

type InstallationStage string

const (
	InstallStageResolve  InstallationStage = "resolve"
	InstallStageDownload InstallationStage = "download"
	InstallStageExtract  InstallationStage = "extract"
	InstallStageDone     InstallationStage = "done"
)

func (s InstallationStage) String() string {
	return string(s)
}

type AgentInstanceStatus string

const (
	Healthy       AgentInstanceStatus = "healthy"
	NotResponding AgentInstanceStatus = "not_responding"
	Terminated    AgentInstanceStatus = "terminated"
)
