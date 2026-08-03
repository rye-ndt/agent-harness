package input_itf

import (
	"time"

	"github.com/google/uuid"
)

type SessionDraftEntity struct {
	ID        uuid.UUID
	Doc       string
	UpdatedAt time.Time
}

type DraftStorage interface {
	List() ([]*SessionDraftEntity, error)
	Save(draft *SessionDraftEntity) error
	Delete(id uuid.UUID) error
}
