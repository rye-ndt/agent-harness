package cli

import (
	"bufio"
	"fmt"
	"io"
	"strings"

	"agent-harness/internal/core"
)

type Terminal struct {
	in  *bufio.Reader
	out io.Writer
}

func NewTerminal(in io.Reader, out io.Writer) *Terminal {
	return &Terminal{in: bufio.NewReader(in), out: out}
}

func (t *Terminal) Ask(q core.Question) (string, error) {
	fmt.Fprintf(t.out, "\n❓ [%s] %s\n", q.Node, q.Prompt)
	for i, opt := range q.Options {
		fmt.Fprintf(t.out, "  %d) %s\n", i+1, opt)
	}
	fmt.Fprint(t.out, "> ")
	line, err := t.in.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func (t *Terminal) Approve(node, artifact, summary string) (core.Decision, error) {
	fmt.Fprintf(t.out, "\n⏸  Gate %s\n", node)
	if summary != "" {
		fmt.Fprintf(t.out, "   %s\n", summary)
	}
	fmt.Fprintf(t.out, "   review: %s\n", artifact)
	fmt.Fprint(t.out, "   approve? [y/n] ")
	line, err := t.in.ReadString('\n')
	if err != nil {
		return core.Decision{}, err
	}
	answer := strings.ToLower(strings.TrimSpace(line))
	if answer == "y" || answer == "yes" {
		return core.Decision{Approved: true}, nil
	}
	fmt.Fprint(t.out, "   reason (optional): ")
	reason, err := t.in.ReadString('\n')
	if err != nil {
		return core.Decision{}, err
	}
	return core.Decision{Approved: false, Comment: strings.TrimSpace(reason)}, nil
}
