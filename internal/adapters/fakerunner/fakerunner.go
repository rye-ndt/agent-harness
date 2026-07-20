package fakerunner

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"agent-harness/internal/core"
)

type Runner struct{}

func New() *Runner { return &Runner{} }

func (r *Runner) Name() string { return "fake" }

func (r *Runner) Capabilities() core.Capabilities {
	return core.Capabilities{Resume: true, MidSessionMsg: false, ToolAllowlist: true}
}

func (r *Runner) Start(ctx context.Context, req core.AgentRequest) (core.AgentSession, error) {
	sess := &session{ref: core.SessionRef("fake-1"), events: make(chan core.AgentEvent, 8), done: make(chan struct{})}
	go func() {
		defer close(sess.events)
		defer close(sess.done)
		sess.events <- core.AgentEvent{Kind: core.EventText, Text: "fake runner: starting task"}
		for _, rel := range req.ExpectedArtifacts {
			path := filepath.Join(req.WorkDir, rel)
			if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
				sess.err = err
				return
			}
			content := fmt.Sprintf("# Placeholder artifact\n\nProduced by the fake runner for prompt:\n\n> %s\n", req.Prompt)
			if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
				sess.err = err
				return
			}
			sess.events <- core.AgentEvent{Kind: core.EventToolActivity, Tool: "write", Target: rel}
		}
		sess.events <- core.AgentEvent{Kind: core.EventCompleted, Status: "ok"}
	}()
	return sess, nil
}

func (r *Runner) Resume(ctx context.Context, ref core.SessionRef, input string) (core.AgentSession, error) {
	sess := &session{ref: ref, events: make(chan core.AgentEvent, 2), done: make(chan struct{})}
	go func() {
		defer close(sess.events)
		defer close(sess.done)
		sess.events <- core.AgentEvent{Kind: core.EventText, Text: "fake runner: resumed with answer: " + input}
		sess.events <- core.AgentEvent{Kind: core.EventCompleted, Status: "ok"}
	}()
	return sess, nil
}

type session struct {
	ref    core.SessionRef
	events chan core.AgentEvent
	done   chan struct{}
	err    error
}

func (s *session) Events() <-chan core.AgentEvent { return s.events }
func (s *session) Ref() core.SessionRef           { return s.ref }
func (s *session) Wait() error {
	<-s.done
	return s.err
}
