package enums

import "slices"

type ModelName string

const (
	Fable          ModelName = "fable"
	Opus           ModelName = "opus"
	Sonnet         ModelName = "sonnet"
	Haiku          ModelName = "haiku"
	Deepseek4Flash ModelName = "opencode/deepseek-v4-flash-free"
	ModelUnknown   ModelName = "unknown"
)

var modelNames = []ModelName{
	Fable,
	Opus,
	Sonnet,
	Haiku,
	Deepseek4Flash,
}

func ModelNames() []ModelName {
	return slices.Clone(modelNames)
}

func (m ModelName) String() string {
	return string(m)
}

func (m ModelName) Valid() bool {
	switch m {
	case Fable, Opus, Sonnet, Haiku, Deepseek4Flash:
		return true
	default:
		return false
	}
}

func (m ModelName) DisplayName() string {
	switch m {
	case Fable:
		return "Claude Fable"
	case Opus:
		return "Claude Opus"
	case Sonnet:
		return "Claude Sonnet"
	case Haiku:
		return "Claude Haiku"
	case Deepseek4Flash:
		return "Deepseek V4 Flash"
	default:
		return "Unknown Model"
	}
}

func (m ModelName) HarnessTool() AgentHarness {
	switch m {
	case Deepseek4Flash:
		return OpenCode
	default:
		return ClaudeCode
	}
}

type AgentHarness string

const (
	ClaudeCode AgentHarness = "claude_code"
	Codex      AgentHarness = "codex"
	OpenCode   AgentHarness = "open_code"
)

type ThinkingLevel string

const (
	LowThinking   ThinkingLevel = "low"
	MedThinking   ThinkingLevel = "medium"
	HighThinking  ThinkingLevel = "high"
	XHighThinking ThinkingLevel = "xhigh"
	MaxThinking   ThinkingLevel = "max"
)

var thinkingLevels = []ThinkingLevel{
	LowThinking,
	MedThinking,
	HighThinking,
	XHighThinking,
	MaxThinking,
}

func ThinkingLevels() []ThinkingLevel {
	return slices.Clone(thinkingLevels)
}

func (t ThinkingLevel) Valid() bool {
	return slices.Contains(thinkingLevels, t)
}

func (t ThinkingLevel) String() string {
	return string(t)
}

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
	AwaitingHuman AgentInstanceStatus = "awaiting_human"
	NotResponding AgentInstanceStatus = "not_responding"
	Terminated    AgentInstanceStatus = "terminated"
)
