package claudecli

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"agent-harness/internal/core"
)

type Runner struct {
	Bin string
}

func New() *Runner { return &Runner{Bin: "claude"} }

func (r *Runner) Name() string { return "claude" }

func (r *Runner) Capabilities() core.Capabilities {
	return core.Capabilities{Resume: true, MidSessionMsg: false, ToolAllowlist: true}
}

func (r *Runner) Start(ctx context.Context, req core.AgentRequest) (core.AgentSession, error) {
	prompt := req.Prompt
	if len(req.ExpectedArtifacts) > 0 {
		prompt += "\n\nYou must produce these files (paths relative to the working directory):\n- " +
			strings.Join(req.ExpectedArtifacts, "\n- ")
	}
	args := []string{"-p", prompt}
	return r.launch(ctx, req.WorkDir, req, args)
}

func (r *Runner) Resume(ctx context.Context, ref core.SessionRef, input string) (core.AgentSession, error) {
	args := []string{"-p", "--resume", string(ref), input}
	return r.launch(ctx, "", core.AgentRequest{Permissions: core.PermissionSpec{Read: true, Write: true, Execute: true}}, args)
}

func (r *Runner) launch(ctx context.Context, dir string, req core.AgentRequest, args []string) (core.AgentSession, error) {
	args = append(args, "--output-format", "stream-json", "--verbose")
	if req.Model != "" {
		args = append(args, "--model", req.Model)
	}
	if disallowed := disallowedTools(req.Permissions); len(disallowed) > 0 {
		args = append(args, "--disallowedTools", strings.Join(disallowed, ","))
	}
	cmd := exec.CommandContext(ctx, r.Bin, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	sess := &session{cmd: cmd, events: make(chan core.AgentEvent, 16), done: make(chan struct{})}
	go func() {
		scanner := bufio.NewScanner(stderr)
		var lines []string
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		sess.stderr = strings.Join(lines, "\n")
	}()
	go func() {
		defer close(sess.events)
		defer close(sess.done)
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
		for scanner.Scan() {
			line := scanner.Bytes()
			for _, ev := range parseLine(line, sess) {
				sess.events <- ev
			}
		}
		waitErr := cmd.Wait()
		if waitErr != nil && sess.err == nil {
			sess.err = fmt.Errorf("claude exited: %w (%s)", waitErr, strings.TrimSpace(sess.stderr))
		}
	}()
	return sess, nil
}

type streamLine struct {
	Type      string `json:"type"`
	Subtype   string `json:"subtype"`
	SessionID string `json:"session_id"`
	IsError   bool   `json:"is_error"`
	Result    string `json:"result"`
	Message   struct {
		Content []struct {
			Type  string         `json:"type"`
			Text  string         `json:"text"`
			Name  string         `json:"name"`
			Input map[string]any `json:"input"`
		} `json:"content"`
	} `json:"message"`
}

func parseLine(line []byte, sess *session) []core.AgentEvent {
	var msg streamLine
	if err := json.Unmarshal(line, &msg); err != nil {
		return nil
	}
	if msg.SessionID != "" {
		sess.ref = core.SessionRef(msg.SessionID)
	}
	raw := json.RawMessage(append([]byte(nil), line...))
	var events []core.AgentEvent
	switch msg.Type {
	case "assistant":
		for _, block := range msg.Message.Content {
			switch block.Type {
			case "text":
				if strings.TrimSpace(block.Text) != "" {
					events = append(events, core.AgentEvent{Kind: core.EventText, Text: block.Text, Raw: raw})
				}
			case "tool_use":
				events = append(events, core.AgentEvent{
					Kind:   core.EventToolActivity,
					Tool:   block.Name,
					Target: toolTarget(block.Input),
					Raw:    raw,
				})
			}
		}
	case "result":
		status := "ok"
		if msg.IsError {
			status = "failed"
			sess.err = fmt.Errorf("claude result error: %s", firstChars(msg.Result, 500))
		}
		events = append(events, core.AgentEvent{Kind: core.EventCompleted, Status: status, Text: msg.Result, Raw: raw})
	}
	return events
}

func toolTarget(input map[string]any) string {
	for _, key := range []string{"file_path", "command", "path", "url", "pattern", "prompt"} {
		if v, ok := input[key].(string); ok {
			return firstChars(v, 120)
		}
	}
	return ""
}

func disallowedTools(p core.PermissionSpec) []string {
	var out []string
	if !p.Execute {
		out = append(out, "Bash")
	}
	if !p.Write {
		out = append(out, "Write", "Edit", "NotebookEdit")
	}
	if !p.Network {
		out = append(out, "WebFetch", "WebSearch")
	}
	return out
}

func firstChars(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

type session struct {
	cmd    *exec.Cmd
	ref    core.SessionRef
	events chan core.AgentEvent
	done   chan struct{}
	err    error
	stderr string
}

func (s *session) Events() <-chan core.AgentEvent { return s.events }
func (s *session) Ref() core.SessionRef           { return s.ref }
func (s *session) Wait() error {
	<-s.done
	return s.err
}
