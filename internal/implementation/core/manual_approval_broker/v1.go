package manual_approval_broker

import (
	"slices"
	"sync"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

type pending struct {
	req    *core_itf.ApprovalRequest
	answer chan *core_itf.ApprovalAnswer
}

type v1 struct {
	locker  sync.Mutex
	cfg     *input_itf.ApprovalBrokerConfig
	waiting map[uuid.UUID]*pending
	stop    chan struct{}
	stopped bool
}

func InitV1(cfg *input_itf.ApprovalBrokerConfig) (core_itf.ApprovalBroker, error) {
	if err := helpers.ValidateStruct(cfg); err != nil {
		return nil, custom_error.Critical("invalid approval config: %v", err)
	}

	return &v1{
		locker:  sync.Mutex{},
		cfg:     cfg,
		waiting: map[uuid.UUID]*pending{},
		stop:    make(chan struct{}),
	}, nil
}

func (b *v1) Request(req *core_itf.ApprovalRequest) (*core_itf.ApprovalAnswer, error) {
	if err := validRequest(req); err != nil {
		return nil, err
	}

	uid, err := uuid.NewV7()
	if err != nil {
		return nil, custom_error.Critical("cannot create uuid: %v", err)
	}

	req.ID = uid
	req.RequestedAt = helpers.NewUTC()

	waiter := &pending{
		req:    req,
		answer: make(chan *core_itf.ApprovalAnswer, 1),
	}

	b.raceSafe(func() {
		b.waiting[uid] = waiter
	})

	defer func() {
		b.raceSafe(func() {
			delete(b.waiting, uid)
		})
	}()

	select {
	case answer := <-waiter.answer:
		return answer, nil
	case <-time.After(b.cfg.Timeout):
		return nil, custom_error.Critical("approval %q timed out after %s with no answer", req.Question, b.cfg.Timeout)
	case <-b.stop:
		return nil, custom_error.Critical("approval %q was abandoned, the app is shutting down", req.Question)
	}
}

func validRequest(req *core_itf.ApprovalRequest) error {
	if req.Question == "" {
		return custom_error.Critical("approval request has no question")
	}

	if len(req.Options) == 0 {
		return custom_error.Critical("approval request %q has no options", req.Question)
	}

	for _, option := range req.Options {
		if option == nil || option.ID == "" || option.Label == "" {
			return custom_error.Critical("approval request %q has an option without an id or label", req.Question)
		}
	}

	if !req.Kind.Valid() {
		req.Kind = enums.ApproveDecision
	}

	return nil
}

func (b *v1) Answer(answer *core_itf.ApprovalAnswer) error {
	var err error

	b.raceSafe(func() {
		waiter, found := b.waiting[answer.RequestID]
		if !found {
			err = custom_error.Critical("approval %v is not waiting for an answer", answer.RequestID)
			return
		}

		if err = validAnswer(waiter.req, answer); err != nil {
			return
		}

		delete(b.waiting, answer.RequestID)

		answer.AnsweredAt = helpers.NewUTC()
		waiter.answer <- answer
	})

	return err
}

func validAnswer(req *core_itf.ApprovalRequest, answer *core_itf.ApprovalAnswer) error {
	if answer == nil {
		return custom_error.Critical("empty answer")
	}

	if !answer.Approved {
		if len(answer.OptionIDs) > 0 {
			return custom_error.Critical("approval %v was rejected, it cannot also pick an option", req.ID)
		}

		return nil
	}

	if len(answer.OptionIDs) == 0 {
		return custom_error.Critical("approval %v was approved with no option", req.ID)
	}

	if !req.MultiSelect && len(answer.OptionIDs) > 1 {
		return custom_error.Critical("approval %v accepts a single option only", req.ID)
	}

	for _, picked := range answer.OptionIDs {
		known := slices.ContainsFunc(req.Options, func(option *core_itf.ApprovalOption) bool {
			return option.ID == picked
		})

		if !known {
			return custom_error.Critical("approval %v has no option %q", req.ID, picked)
		}
	}

	return nil
}

func (b *v1) Pending() []*core_itf.ApprovalRequest {
	requests := []*core_itf.ApprovalRequest{}

	b.raceSafe(func() {
		for _, waiter := range b.waiting {
			requests = append(requests, snapshot(waiter.req))
		}
	})

	slices.SortFunc(requests, func(a, b *core_itf.ApprovalRequest) int {
		return a.RequestedAt.Compare(b.RequestedAt)
	})

	return requests
}

func (b *v1) Awaiting(agentID uuid.UUID) bool {
	if agentID == uuid.Nil {
		return false
	}

	awaiting := false

	b.raceSafe(func() {
		for _, waiter := range b.waiting {
			if waiter.req.AgentID == agentID {
				awaiting = true
				return
			}
		}
	})

	return awaiting
}

func (b *v1) Stop() {
	b.raceSafe(func() {
		if b.stopped {
			return
		}

		b.stopped = true
		close(b.stop)
	})
}

func snapshot(req *core_itf.ApprovalRequest) *core_itf.ApprovalRequest {
	clone := *req
	clone.Options = make([]*core_itf.ApprovalOption, 0, len(req.Options))

	for _, option := range req.Options {
		copied := *option
		clone.Options = append(clone.Options, &copied)
	}

	return &clone
}

func (b *v1) raceSafe(exec func()) {
	b.locker.Lock()
	defer b.locker.Unlock()
	exec()
}
