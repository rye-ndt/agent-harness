# What this project is

A desktop control plane for orchestrating a fleet of coding agents. Work is
authored as a **graph of nodes**; each node is a scoped task assigned to an
agent, nodes chain together, and a `HandoverDoc` carries what one node learned
into the next node's prompt. Read `README.md` before designing anything — the
section "The ideas that shape the code" explains why pieces that look
over-engineered (the WAL, heartbeats, unified diffs, the MCP proxy) exist.

Two things to hold onto:

- **Context engineering is the product**, not scheduling. `HandoverDoc` is the
  most important type in the repo.
- **Simplicity is the top priority**, explicitly so this stays maintainable for
  years. Prefer the simplest thing that works; flag anything that adds ongoing
  maintenance cost and offer the simpler alternative first.

Current focus: `FEAPI` is agent-lifecycle only, so the task graph is unreachable
from the frontend, and nothing yet owns the coordinator role — *node finished,
build the next node's context, assign it*. That coordinator belongs in
`interface/core` + `implementation/core`, beside `AgentManager`, not inside
`task_manager/v1.go`.

# Instructions

- Do not add new comments on code changes, except when explicitly asked to do so.

# Conventions

- Hexagonal with this project's own naming: ports in `internal/interface/{core,input,output}`
  (packages `core_itf` / `input_itf` / `output_itf`), one package per technology
  in `internal/implementation/`, and `wire.go` as the only composition root.
  Add the port first, then the implementation, then wire it.
- `interface/` knows no technology. `implementation/` packages depend on
  `interface/`, never on each other. `main.go` stays thin and imports no Wails.
- Constructors are `New()` (or `InitV1()` for versioned implementations),
  disambiguated by package path.
- All ids are UUIDv7 via `github.com/google/uuid`, called inline at the call
  site — no `newID()` wrapper.
- Errors go through `custom_error`: `Critical`, `Bypass`, or `TypedCritical`
  with an `enums.ErrorType`.
- Frontend bindings in `frontend/wailsjs/` are generated — regenerate with
  `~/go/bin/wails generate module` (not on PATH), never hand-edit.

# Gotchas

- Run from the repo root; `config.yaml` is read from the working directory.
- `go run .` fails with a Wails build-tag error — use `make dev`.
- The SQLite driver name is `sqlite` (modernc), not `sqlite3`.
- `viper.Read()` returns nil on unmarshal error, so a config typo surfaces as a
  nil dereference rather than a clear error.
- Typecheck the frontend with `npx tsc --noEmit` in `frontend/`.
