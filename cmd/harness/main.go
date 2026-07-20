package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"agent-harness/internal/adapters/claudecli"
	"agent-harness/internal/adapters/cli"
	"agent-harness/internal/adapters/fakerunner"
	"agent-harness/internal/adapters/fsworkspace"
	"agent-harness/internal/adapters/journal"
	"agent-harness/internal/core"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "run":
		if err := runCmd(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
	default:
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `usage:
  harness run -graph <file.yaml> -task <id> [-runner fake|claude] [-runs-dir runs]`)
}

func runCmd(args []string) error {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	graphPath := fs.String("graph", "", "path to graph yaml")
	task := fs.String("task", "", "task id (e.g. JIRA-123)")
	runnerName := fs.String("runner", "fake", "default agent runner")
	runsDir := fs.String("runs-dir", "runs", "directory for run workspaces")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *graphPath == "" || *task == "" {
		return fmt.Errorf("-graph and -task are required")
	}

	graph, err := core.LoadGraph(*graphPath)
	if err != nil {
		return err
	}
	ws, err := fsworkspace.New(*runsDir, *task)
	if err != nil {
		return err
	}
	jnl, err := journal.New(filepath.Join(ws.Root(), "journal.jsonl"))
	if err != nil {
		return err
	}
	runners := map[string]core.AgentRunner{
		"fake":   fakerunner.New(),
		"claude": claudecli.New(),
	}
	if _, ok := runners[*runnerName]; !ok {
		return fmt.Errorf("unknown runner %q", *runnerName)
	}

	exec := &core.Executor{
		Runners:       runners,
		DefaultRunner: *runnerName,
		Workspace:     ws,
		Journal:       jnl,
		UI:            cli.NewTerminal(os.Stdin, os.Stdout),
		Log: func(format string, a ...any) {
			fmt.Printf(format+"\n", a...)
		},
	}

	fmt.Printf("graph %s · task %s · workspace %s\n", graph.Name, *task, ws.Root())
	if err := exec.Run(context.Background(), graph); err != nil {
		return err
	}
	fmt.Println("✔ run completed")
	return nil
}
