package core_itf

import "github.com/google/uuid"

type Coordinator interface {
	Run(session uuid.UUID) error
	Stop()
}
