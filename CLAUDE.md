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

# Performance

The hot path is agent output: a subprocess streams lines, Go forwards them over
the bridge, React renders them. It runs continuously for the life of a run, and
everything below exists because of it. Measure before optimizing anything not
on that path — `net/http/pprof` behind a debug flag for Go, Safari Web
Inspector against the WebContent process for the frontend.

- **Coalesce events on the Go side, never the JS side.** Throttle `EventsEmit`
  to ≤10Hz and batch whatever accumulated since the last tick into one payload.
  An agent that prints fast must not become one IPC message per line.
- **No N+1 across the bridge.** One call returning many, never a loop of bound
  calls — per-agent polling in a `for` loop is the shape to avoid. Return page
  slices and DTOs holding the fields the view needs, not whole tables or fat
  nested structs.
- **Write on commit, not on every frame.** Continuous gestures — node drag,
  search-as-you-type, resize — render from local state and cross the bridge
  once, when the gesture ends.
- **Every goroutine has an exit path; every ticker has a `Stop()`.** Output
  pumps and heartbeats outlive the call that started them, so they exit on
  context cancel or channel close. `runtime.NumGoroutine()` stays flat at idle.
- **Every `EventsOn` returns its unsubscribe from `useEffect`.** A leaked
  listener pins the closure and everything it captured.
- **Bound anything that grows for the length of a run.** Run logs are the case
  that matters: cap the lines held in React state and let SQLite keep the rest.
  Virtualize a list past ~100 rows instead of mounting all of it.
- Set `GOMEMLIMIT` via `debug.SetMemoryLimit` in `main()`. Preallocate when the
  size is known (`make([]T, 0, n)`).

# Gotchas

- Run from the repo root; `config.yaml` is read from the working directory.
- `go run .` fails with a Wails build-tag error — use `make dev`.
- The SQLite driver name is `sqlite` (modernc), not `sqlite3`.
- `viper.Read()` returns nil on unmarshal error, so a config typo surfaces as a
  nil dereference rather than a clear error.
- Typecheck the frontend with `npx tsc --noEmit` in `frontend/`.
- The generated bindings in `frontend/wailsjs/` dereference `window.go` /
  `window.runtime` **synchronously**, so outside the Wails webview they throw
  rather than reject. `.catch()` on the returned promise never fires — wrap the
  call in `try/catch` (or an `async` helper) or the component crashes the whole
  React tree under a plain `vite` dev server.
- `@xyflow/react/dist/base.css` must be imported with `layer(base)`. Unlayered
  CSS beats layered CSS at any specificity, so without it React Flow's defaults
  silently override the project's `@layer components` edge and handle styles.
