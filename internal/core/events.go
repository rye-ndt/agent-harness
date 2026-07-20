package core

import (
	"encoding/json"
	"time"
)

type AgentEventKind string

const (
	EventText         AgentEventKind = "text"
	EventToolActivity AgentEventKind = "tool_activity"
	EventQuestion     AgentEventKind = "question"
	EventCompleted    AgentEventKind = "completed"
	EventError        AgentEventKind = "error"
)

// AgentEvent is the canonical vocabulary every runner adapter normalizes
// its native output into. Raw carries the provider payload untouched.
type AgentEvent struct {
	Kind   AgentEventKind  `json:"kind"`
	Text   string          `json:"text,omitempty"`
	Tool   string          `json:"tool,omitempty"`
	Target string          `json:"target,omitempty"`
	Status string          `json:"status,omitempty"`
	Raw    json.RawMessage `json:"raw,omitempty"`
}

type RunEvent struct {
	Time time.Time      `json:"time"`
	Kind string         `json:"kind"`
	Node string         `json:"node,omitempty"`
	Data map[string]any `json:"data,omitempty"`
}

const (
	RunStarted       = "run_started"
	RunCompleted     = "run_completed"
	RunFailed        = "run_failed"
	NodeStarted      = "node_started"
	NodeCompleted    = "node_completed"
	NodeFailed       = "node_failed"
	QuestionAsked    = "question_asked"
	QuestionAnswered = "question_answered"
	GateDecided      = "gate_decided"
)
