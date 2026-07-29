package output_itf

import "github.com/google/uuid"

type MQEvent interface {
	Event() string
}

type MessageQ interface {
	Emit(qID uuid.UUID, event MQEvent, data any) error
	Subscribe(qID uuid.UUID, event MQEvent) (<-chan any, error)
	Unsubscribe(qID uuid.UUID, event MQEvent) (<-chan any, error)
}
