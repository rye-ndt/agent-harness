package input_itf

type Agent struct {
	ID string
}

type HarnessAgent interface {
	Auth() error
	Install() error
	Spawn() (*Agent, error)
	Kill(id string) error
}
