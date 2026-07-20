package core

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Executor struct {
	Runners       map[string]AgentRunner
	DefaultRunner string
	Workspace     Workspace
	Journal       Journal
	UI            UserInteraction
	Log           func(format string, args ...any)
}

func (e *Executor) logf(format string, args ...any) {
	if e.Log != nil {
		e.Log(format, args...)
	}
}

func (e *Executor) journal(kind, node string, data map[string]any) error {
	return e.Journal.Append(RunEvent{Time: time.Now(), Kind: kind, Node: node, Data: data})
}

func (e *Executor) Run(ctx context.Context, g *Graph) error {
	if err := e.Workspace.EnsureLayout(); err != nil {
		return err
	}
	completed, err := e.completedNodes()
	if err != nil {
		return err
	}
	order, err := g.TopoOrder()
	if err != nil {
		return err
	}
	if err := e.journal(RunStarted, "", map[string]any{"graph": g.Name}); err != nil {
		return err
	}
	for _, node := range order {
		if completed[node.ID] {
			e.logf("skip %s (already completed)", node.ID)
			continue
		}
		e.logf("run %s (%s)", node.ID, node.Type)
		if err := e.journal(NodeStarted, node.ID, nil); err != nil {
			return err
		}
		if err := e.runNode(ctx, node); err != nil {
			_ = e.journal(NodeFailed, node.ID, map[string]any{"error": err.Error()})
			_ = e.journal(RunFailed, "", map[string]any{"node": node.ID})
			return fmt.Errorf("node %s: %w", node.ID, err)
		}
		if err := e.journal(NodeCompleted, node.ID, nil); err != nil {
			return err
		}
	}
	return e.journal(RunCompleted, "", nil)
}

func (e *Executor) completedNodes() (map[string]bool, error) {
	events, err := e.Journal.Replay()
	if err != nil {
		return nil, err
	}
	done := map[string]bool{}
	for _, ev := range events {
		if ev.Kind == NodeCompleted {
			done[ev.Node] = true
		}
	}
	return done, nil
}

func (e *Executor) runNode(ctx context.Context, node NodeSpec) error {
	switch node.Type {
	case NodeSource:
		return e.runSource(node)
	case NodeAgentTask:
		return e.runAgentTask(ctx, node)
	case NodeHumanGate:
		return e.runHumanGate(node)
	default:
		return fmt.Errorf("unknown node type %q", node.Type)
	}
}

func (e *Executor) runSource(node NodeSpec) error {
	for _, src := range node.ConfigStrings("copy") {
		dest := filepath.Join(e.Workspace.Root(), "context", filepath.Base(src))
		if err := copyFile(src, dest); err != nil {
			return err
		}
		e.logf("  copied %s -> context/%s", src, filepath.Base(src))
	}
	return nil
}

func (e *Executor) runAgentTask(ctx context.Context, node NodeSpec) error {
	runner, err := e.pickRunner(node)
	if err != nil {
		return err
	}
	artifacts := node.ConfigStrings("artifacts")
	req := AgentRequest{
		WorkDir:           e.Workspace.Root(),
		Prompt:            node.ConfigString("prompt"),
		Model:             node.ConfigString("model"),
		Permissions:       PermissionSpec{Read: true, Write: true, Execute: true},
		ExpectedArtifacts: artifacts,
	}
	sess, err := runner.Start(ctx, req)
	if err != nil {
		return err
	}
	questionCount := 0
	for {
		var pending *Question
		for ev := range sess.Events() {
			switch ev.Kind {
			case EventText:
				e.logf("  [%s] %s", node.ID, firstLine(ev.Text))
			case EventToolActivity:
				e.logf("  [%s] tool: %s %s", node.ID, ev.Tool, ev.Target)
			case EventQuestion:
				questionCount++
				pending = &Question{
					ID:     fmt.Sprintf("%s-q%d", node.ID, questionCount),
					Node:   node.ID,
					Prompt: ev.Text,
				}
			case EventError:
				e.logf("  [%s] error: %s", node.ID, ev.Text)
			}
		}
		if err := sess.Wait(); err != nil {
			return err
		}
		if pending == nil {
			break
		}
		if !runner.Capabilities().Resume {
			return fmt.Errorf("runner %s asked a question but cannot resume", runner.Name())
		}
		if err := e.journal(QuestionAsked, node.ID, map[string]any{"id": pending.ID, "prompt": pending.Prompt, "session": string(sess.Ref())}); err != nil {
			return err
		}
		answer, err := e.UI.Ask(*pending)
		if err != nil {
			return err
		}
		if err := e.journal(QuestionAnswered, node.ID, map[string]any{"id": pending.ID, "answer": answer}); err != nil {
			return err
		}
		sess, err = runner.Resume(ctx, sess.Ref(), answer)
		if err != nil {
			return err
		}
	}
	for _, a := range artifacts {
		if !e.Workspace.ArtifactExists(a) {
			return fmt.Errorf("expected artifact %s was not produced", a)
		}
	}
	return nil
}

func (e *Executor) runHumanGate(node NodeSpec) error {
	artifact := node.ConfigString("artifact")
	summary := node.ConfigString("summary")
	decision, err := e.UI.Approve(node.ID, filepath.Join(e.Workspace.Root(), artifact), summary)
	if err != nil {
		return err
	}
	if err := e.journal(GateDecided, node.ID, map[string]any{"approved": decision.Approved, "comment": decision.Comment}); err != nil {
		return err
	}
	if !decision.Approved {
		return fmt.Errorf("rejected at gate: %s", decision.Comment)
	}
	return nil
}

func (e *Executor) pickRunner(node NodeSpec) (AgentRunner, error) {
	name := node.Runner
	if name == "" {
		name = e.DefaultRunner
	}
	runner, ok := e.Runners[name]
	if !ok {
		return nil, fmt.Errorf("unknown runner %q", name)
	}
	return runner, nil
}

func copyFile(src, dest string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i] + " …"
	}
	return s
}
