# master_harness

A desktop control plane for orchestrating a fleet of coding agents.

You author work as a **graph of nodes**. Each node is a scoped unit of work —
a role, a model preference, a bounded set of files it is allowed to write, and
whatever extra guidance it needs. Nodes are linked into a chain, and the app
drives agents through them: assigning work, watching for silence, capturing the
diff, and carrying what was learned forward into the next node.

It is local-first (SQLite plus a write-ahead log in your user config dir) and
vendor-agnostic: the app installs and authenticates the underlying agent CLIs
itself, so using it never requires knowing a CLI is involved.

## The ideas that shape the code

**Nodes form a DAG, not a queue.** `TaskEntity` carries `PrevTaskID`,
`NextTaskID` and `ChildrenTaskIDs`. Chaining is the point; the session is just
how a node gets picked up.

**Context is the hard part, not scheduling.** When a node finishes it produces a
`HandoverDoc` — outcome, blockers, approved and *rejected* decisions, current vs
changed behaviours, what to avoid, nuances, known gaps. That document is the
payload that flows into the next node's prompt. Passing forward what an agent
was told **not** to do matters as much as passing forward what it did.

**Agents fail, so the system assumes it.** Every mutation is written to a WAL
before it is committed, and replayed into SQLite on the next start. Assigned
agents send heartbeats; when one goes quiet its task is dropped and becomes
takeable again. Failed and cancelled tasks are re-pickable by design, and every
file change is stored as a unified diff so work can be reverted without
depending on the repo's VCS state.

**Agents never hold credentials.** MCP servers are authorized once, by the app,
over a loopback OAuth flow with PKCE; tokens are encrypted at rest. Agents send
a placeholder (`auth_key_name`) and the proxy substitutes the real secret on the
way out, refusing any request aimed at an authorization endpoint.

## Status

The backend is ahead of the UI. Built and tested: the task graph, the WAL and
WAL-to-SQLite sync, task/session event pub-sub, heartbeat-drop, agent
install/auth/spawn for Claude Code and OpenCode, and the MCP proxy including
request forwarding.

Not yet wired: `FEAPI` still exposes only agent lifecycle, so nothing in the
task graph is reachable from the frontend, and no component yet owns the
coordinator role — *node finished, build the next node's context from its
handover doc, assign it*. That is the current focus.

## Roadmap

- [ ] Single node work e2e
- [ ] Node linking & chaining
- [ ] Revert workflow
- [x] Centralized MCP credential storage — auth and forwarding done; token
      refresh and an agent-facing listener remain
- [ ] Repo knowledge engineering
- [ ] Context engineering

## Architecture

Hexagonal, with this project's own naming: every technology sits behind an
interface, and only `wire.go` knows which implementation fills which interface.

```
main.go                        entrypoint: wire, then run the app builder
wire.go                        composition root: the only place implementations are chosen
config.yaml                    app, session, mcp_servers, agent_harness settings
Makefile                       dev / build / run / test
internal/
  interface/                   ports — pure contracts, no tech
    core/    agent_manager, session_manager, mcp_proxy
    input/   config, http_cli, harness, cache (WAL), storage_{harness,task,mcp}
    output/  logger, app_builder, fe_api, message_queue
  implementation/              one package per technology
    core/
      agent_manager/           resolves a configured harness by name
      session_manager/v1.go    add task / report / heartbeat / events
      mcp_proxy/v1.go          OAuth broker + request forwarding (helpers/)
      wal_sync/                startup replay: WAL -> SQLite -> reset
      custom_error/            severity- and type-tagged errors
    input/
      config/viper.go          Config from config.yaml
      http_cli/basic.go        GET / JSON / checksummed download / streaming
      harness/                 claude_code.go, open_code.go + harness_helper (pty, proc)
      storage/litesql.go       SQLite (modernc) with user_version migrations
      wal/file.go              JSONL append with coalescing fsync
    output/
      logger/slog.go
      app_builder/wails.go
      fe_api/wails_api.go      the API bound to JS
  helpers/                     small shared utilities and enums/
frontend/                      React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui
  src/App.tsx                  UI calling Go via generated bindings
  wailsjs/                     generated bindings — regenerate, don't hand-edit
```

The rules:

- `interface/` knows nothing about any technology.
- `implementation/` packages depend on `interface/`, never on each other.
- `wire.go` is the only place a concrete implementation is chosen.
- All ids are UUIDv7, generated inline at the call site.

## Commands

```sh
make dev     # start with hot reload (recommended for development)
make run     # build the production .app and launch it
make build   # build the production .app only
make test    # run Go tests
```

Note: the app reads `config.yaml` from the working directory, so run it from
the repo root. `go run .` fails with a Wails build-tag error — use `make dev`.
