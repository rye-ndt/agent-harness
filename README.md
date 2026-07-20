# agent-harness

Local agent workflow orchestrator: runs a graph of nodes (agent tasks, human
gates, sources) against a per-task workspace, with Claude Code as the default
agent runner. Think n8n/ComfyUI for coding-agent pipelines, CLI-first.

## Layout

```
cmd/harness/           entrypoint + flag parsing (thin driver)
internal/core/         the hexagon: graph spec, executor, ports, events
internal/adapters/
  claudecli/           AgentRunner via `claude -p --output-format stream-json`
  fakerunner/          deterministic AgentRunner for tests and offline dev
  fsworkspace/         run workspace on disk (runs/<task>/...)
  journal/             append-only JSONL run journal (resume support)
  cli/                 terminal prompts for gates and agent questions
examples/              graph documents
runs/                  per-task workspaces (gitignored)
```

## Run the demo

```sh
go run ./cmd/harness run -graph examples/demo.yaml -task DEMO-1
```

Uses the fake runner by default. Against real Claude Code:

```sh
go run ./cmd/harness run -graph examples/demo.yaml -task DEMO-2 -runner claude
```

Re-running the same task resumes: completed nodes are skipped via the journal
at `runs/<task>/journal.jsonl`.

## Design rules

- Simplicity over everything; this must stay maintainable long-term.
- `core` imports nothing from `adapters`. All interfaces live in `core/ports.go`.
- No provider-specific strings in core; runner adapters normalize to the
  canonical `AgentEvent` vocabulary and map `PermissionSpec` to native flags.
- Contracts are enforced on workspace artifacts, not on event streams.
- Interactions (gates, questions) are journaled so any future frontend
  (HTTP/canvas UI) can drive them; the terminal is just one adapter.

## Node types

- `source` — copy context files into the workspace
- `agent-task` — run an agent session; must produce declared `artifacts`
- `human-gate` — block until the user approves an artifact

Planned archetypes: fan-out, verifier, recorder.
