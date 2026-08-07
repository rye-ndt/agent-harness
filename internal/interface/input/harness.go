package input_itf

import (
	"time"

	"hexago/internal/helpers/enums"

	"github.com/google/uuid"
)

type InstallProgress struct {
	Stage      enums.InstallationStage `json:"stage"`
	Downloaded int64                   `json:"downloaded"`
	Total      int64                   `json:"total"`
}

type AgentStatus struct {
	Name          string `json:"name"`
	Installed     bool   `json:"installed"`
	InstanceCount int    `json:"instance_count"`
	LoggedIn      bool   `json:"logged_in"`
	Version       string `json:"version"`
}

type ContextUsage struct {
	Total      int       `json:"total"`
	Used       int       `json:"used"`
	Input      int       `json:"input"`
	Output     int       `json:"output"`
	CacheRead  int       `json:"cache_read"`
	CacheWrite int       `json:"cache_write"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Activity struct {
	Seq  int       `json:"seq"`
	At   time.Time `json:"at"`
	Text string    `json:"text"`
}

type AgentAdmin interface {
	Auth() (string, error)
	SubmitAuthCode(code string) error
	Status() (*AgentStatus, error)
	SupportedModels() []enums.ModelName
	Install(onProgress func(InstallProgress)) error
	Uninstall() error
	Shutdown()
}

type AgentHarness interface {
	AgentAdmin
	Support(name enums.ModelName) bool
	Spawn(
		name enums.ModelName,
		thinkingLevel enums.ThinkingLevel,
		systemPrompts []string,
		workdir string,
	) (uuid.UUID, error)
	Send(id string, message string) error
	Listen(id string) (<-chan string, error)
	Alive(id string) (time.Time, error)
	Usage(id string) (*ContextUsage, error)
	Activity(id string) ([]Activity, error)
	Kill(id string) error
}
