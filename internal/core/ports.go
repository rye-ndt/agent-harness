package core

import "context"

type Capabilities struct {
	Resume        bool
	MidSessionMsg bool
	ToolAllowlist bool
}

type PermissionSpec struct {
	Read    bool
	Write   bool
	Execute bool
	Network bool
}

type AgentRequest struct {
	WorkDir           string
	Prompt            string
	Model             string
	Permissions       PermissionSpec
	ExpectedArtifacts []string
}

// SessionRef is opaque; only the adapter that minted it can interpret it.
type SessionRef string

type AgentSession interface {
	Events() <-chan AgentEvent
	Ref() SessionRef
	Wait() error
}

type AgentRunner interface {
	Name() string
	Capabilities() Capabilities
	Start(ctx context.Context, req AgentRequest) (AgentSession, error)
	Resume(ctx context.Context, ref SessionRef, input string) (AgentSession, error)
}

type Workspace interface {
	Root() string
	EnsureLayout() error
	ArtifactExists(rel string) bool
}

type Journal interface {
	Append(ev RunEvent) error
	Replay() ([]RunEvent, error)
}

type Question struct {
	ID      string
	Node    string
	Prompt  string
	Options []string
}

type Decision struct {
	Approved bool
	Comment  string
}

type UserInteraction interface {
	Ask(q Question) (string, error)
	Approve(node, artifact, summary string) (Decision, error)
}
