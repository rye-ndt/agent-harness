package input_itf

import (
	"hexago/internal/helpers/enums"
)

type HarnessInfo struct {
	Name     string
	Version  string
	Platform enums.OS
	Path     string
}

type HarnessStorage interface {
	Save(info *HarnessInfo) error
	Find(name string) (*HarnessInfo, error)
}
