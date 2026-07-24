package input_itf

import (
	"hexago/internal/helpers/enums"
)

type HarnessEntity struct {
	Name     string
	Version  string
	Platform enums.OS
	Path     string
}

type HarnessStorage interface {
	Save(info *HarnessEntity) error
	Find(name string) (*HarnessEntity, error)
}
