package message_queue

import (
	"sync"

	"hexago/internal/implementation/core/custom_error"
	output_itf "hexago/internal/interface/output"

	"github.com/google/uuid"
)

const eventBufferSize = 16

type subscription struct {
	qID   uuid.UUID
	event string
}

type v1 struct {
	locker  sync.Mutex
	streams map[subscription]chan any
}

func InitMQV1() output_itf.MessageQ {
	return &v1{
		locker:  sync.Mutex{},
		streams: map[subscription]chan any{},
	}
}

func (q *v1) Emit(qID uuid.UUID, event output_itf.MQEvent, data any) error {
	key, err := newSubscription(qID, event)
	if err != nil {
		return err
	}

	var emitErr error

	q.raceSafe(func() {
		stream, found := q.streams[key]
		if !found {
			return
		}

		select {
		case stream <- data:
		default:
			emitErr = custom_error.Bypass(
				"event %s of queue %v dropped, channel is full",
				key.event, qID,
			)
		}
	})

	return emitErr
}

func (q *v1) Subscribe(qID uuid.UUID, event output_itf.MQEvent) (<-chan any, error) {
	key, err := newSubscription(qID, event)
	if err != nil {
		return nil, err
	}

	stream := make(chan any, eventBufferSize)

	q.raceSafe(func() {
		if _, found := q.streams[key]; found {
			err = custom_error.Critical("event %s of queue %v is already subscribed", key.event, qID)
			return
		}

		q.streams[key] = stream
	})

	if err != nil {
		return nil, err
	}

	return stream, nil
}

func (q *v1) Unsubscribe(qID uuid.UUID, event output_itf.MQEvent) (<-chan any, error) {
	key, err := newSubscription(qID, event)
	if err != nil {
		return nil, err
	}

	var stream chan any

	q.raceSafe(func() {
		found := false

		stream, found = q.streams[key]
		if !found {
			err = custom_error.Critical("event %s of queue %v is not subscribed", key.event, qID)
			return
		}

		delete(q.streams, key)
		close(stream)
	})

	if err != nil {
		return nil, err
	}

	return stream, nil
}

func newSubscription(qID uuid.UUID, event output_itf.MQEvent) (subscription, error) {
	if qID == uuid.Nil {
		return subscription{}, custom_error.Critical("queue id is empty")
	}

	if event == nil || event.Event() == "" {
		return subscription{}, custom_error.Critical("event of queue %v is empty", qID)
	}

	return subscription{
		qID:   qID,
		event: event.Event(),
	}, nil
}

func (q *v1) raceSafe(exec func()) {
	q.locker.Lock()
	defer q.locker.Unlock()
	exec()
}
