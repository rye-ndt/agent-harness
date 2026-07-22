package input_itf

type Agent struct {
	ID string
}

const (
	InstallStageResolve  = "resolve"
	InstallStageDownload = "download"
	InstallStageExtract  = "extract"
	InstallStageDone     = "done"
)

type InstallProgress struct {
	Stage      string `json:"stage"`
	Downloaded int64  `json:"downloaded"`
	Total      int64  `json:"total"`
}

type AgentHarness interface {
	Auth() error
	Install(onProgress func(InstallProgress)) error
	Uninstall() error
	Spawn() (*Agent, error)
	Send(id string, message string) error
	Listen(id string) (<-chan string, error)
	Kill(id string) error
}
