package core

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

type scriptedRunner struct {
	askFirst   bool
	skipWrites bool
	started    int
	resumed    int
	workDir    string
}

func (r *scriptedRunner) Name() string { return "scripted" }
func (r *scriptedRunner) Capabilities() Capabilities {
	return Capabilities{Resume: true}
}

func (r *scriptedRunner) Start(ctx context.Context, req AgentRequest) (AgentSession, error) {
	r.started++
	events := make(chan AgentEvent, 4)
	if r.askFirst && r.resumed == 0 {
		events <- AgentEvent{Kind: EventQuestion, Text: "which approach?"}
	} else if !r.skipWrites {
		for _, rel := range req.ExpectedArtifacts {
			path := filepath.Join(req.WorkDir, rel)
			os.MkdirAll(filepath.Dir(path), 0o755)
			os.WriteFile(path, []byte("done"), 0o644)
		}
		events <- AgentEvent{Kind: EventCompleted, Status: "ok"}
	}
	close(events)
	return &scriptedSession{events: events}, nil
}

func (r *scriptedRunner) Resume(ctx context.Context, ref SessionRef, input string) (AgentSession, error) {
	r.resumed++
	events := make(chan AgentEvent, 2)
	path := filepath.Join(r.workDir, "plans/analysis.md")
	os.MkdirAll(filepath.Dir(path), 0o755)
	os.WriteFile(path, []byte("done after answer: "+input), 0o644)
	events <- AgentEvent{Kind: EventCompleted, Status: "ok"}
	close(events)
	return &scriptedSession{events: events}, nil
}

type scriptedSession struct{ events chan AgentEvent }

func (s *scriptedSession) Events() <-chan AgentEvent { return s.events }
func (s *scriptedSession) Ref() SessionRef           { return "scripted-1" }
func (s *scriptedSession) Wait() error               { return nil }

type memJournal struct{ events []RunEvent }

func (j *memJournal) Append(ev RunEvent) error    { j.events = append(j.events, ev); return nil }
func (j *memJournal) Replay() ([]RunEvent, error) { return j.events, nil }

type dirWorkspace struct{ root string }

func (w dirWorkspace) Root() string        { return w.root }
func (w dirWorkspace) EnsureLayout() error { return os.MkdirAll(w.root, 0o755) }
func (w dirWorkspace) ArtifactExists(rel string) bool {
	info, err := os.Stat(filepath.Join(w.root, rel))
	return err == nil && !info.IsDir()
}

type scriptedUI struct {
	answers   []string
	approvals []bool
	asked     []Question
}

func (u *scriptedUI) Ask(q Question) (string, error) {
	u.asked = append(u.asked, q)
	answer := u.answers[0]
	u.answers = u.answers[1:]
	return answer, nil
}

func (u *scriptedUI) Approve(node, artifact, summary string) (Decision, error) {
	approved := u.approvals[0]
	u.approvals = u.approvals[1:]
	return Decision{Approved: approved}, nil
}

func testGraph() *Graph {
	return &Graph{
		Name: "test",
		Nodes: []NodeSpec{
			{ID: "analyze", Type: NodeAgentTask, Config: map[string]any{
				"prompt":    "analyze",
				"artifacts": []any{"plans/analysis.md"},
			}},
			{ID: "gate", Type: NodeHumanGate, Needs: []string{"analyze"}, Config: map[string]any{
				"artifact": "plans/analysis.md",
			}},
		},
	}
}

func newTestExecutor(t *testing.T, runner AgentRunner, ui UserInteraction, jnl Journal) *Executor {
	t.Helper()
	return &Executor{
		Runners:       map[string]AgentRunner{"scripted": runner},
		DefaultRunner: "scripted",
		Workspace:     dirWorkspace{root: t.TempDir()},
		Journal:       jnl,
		UI:            ui,
	}
}

func TestRunWithQuestionAndGate(t *testing.T) {
	runner := &scriptedRunner{askFirst: true}
	ui := &scriptedUI{answers: []string{"approach B"}, approvals: []bool{true}}
	jnl := &memJournal{}
	e := newTestExecutor(t, runner, ui, jnl)
	runner.workDir = e.Workspace.Root()

	if err := e.Run(context.Background(), testGraph()); err != nil {
		t.Fatal(err)
	}
	if runner.resumed != 1 {
		t.Fatalf("expected 1 resume, got %d", runner.resumed)
	}
	if len(ui.asked) != 1 || ui.asked[0].Node != "analyze" {
		t.Fatalf("expected question from analyze, got %+v", ui.asked)
	}
	if !e.Workspace.ArtifactExists("plans/analysis.md") {
		t.Fatal("artifact missing")
	}
	last := jnl.events[len(jnl.events)-1]
	if last.Kind != RunCompleted {
		t.Fatalf("expected run_completed, got %s", last.Kind)
	}
}

func TestResumeSkipsCompletedNodes(t *testing.T) {
	runner := &scriptedRunner{}
	ui := &scriptedUI{approvals: []bool{false}}
	jnl := &memJournal{}
	e := newTestExecutor(t, runner, ui, jnl)
	runner.workDir = e.Workspace.Root()

	if err := e.Run(context.Background(), testGraph()); err == nil {
		t.Fatal("expected gate rejection to fail the run")
	}
	firstStarts := runner.started

	ui.approvals = []bool{true}
	if err := e.Run(context.Background(), testGraph()); err != nil {
		t.Fatal(err)
	}
	if runner.started != firstStarts {
		t.Fatalf("analyze re-ran on resume: %d -> %d starts", firstStarts, runner.started)
	}
}

func TestMissingArtifactFailsNode(t *testing.T) {
	runner := &scriptedRunner{skipWrites: true}
	ui := &scriptedUI{}
	e := newTestExecutor(t, runner, ui, &memJournal{})
	runner.workDir = e.Workspace.Root()

	g := &Graph{Name: "t", Nodes: []NodeSpec{
		{ID: "task", Type: NodeAgentTask, Config: map[string]any{
			"prompt":    "x",
			"artifacts": []any{"plans/never-written.md"},
		}},
	}}
	if err := e.Run(context.Background(), g); err == nil {
		t.Fatal("expected missing artifact to fail the run")
	}
}
