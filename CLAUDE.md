# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# What this project is

A desktop control plane for orchestrating a fleet of coding agents. Work is
authored as a **graph of nodes**; each node is a scoped task assigned to an
agent, nodes chain together, and a `HandoverDoc` carries what one node learned
into the next node's prompt. Read `README.md` before designing anything — the
section "Is this an another LLM wrapper?" explains why pieces that look
over-engineered (the WAL, heartbeats, unified diffs, the MCP proxy) exist.

Two things to hold onto:

- **Context engineering is the product**, not scheduling. `HandoverDoc` is the
  most important type in the repo.
- **Simplicity is the top priority**, explicitly so this stays maintainable for
  years. Prefer the simplest thing that works; flag anything that adds ongoing
  maintenance cost and offer the simpler alternative first.

# Commands

Run everything from the repo root; `config.yaml` is read from the working
directory.

```sh
make dev      # run the app; frontend hot-reloads, Go changes need a restart
make dev-go   # same, but rebuilds on Go changes (macOS steals focus each time)
make build    # production .app bundle
make run      # build, then launch the bundle
make test     # go test ./...
```

`go run .` fails on a Wails build tag — always use `make dev`.

A single Go test: `go test ./internal/implementation/core/session_manager -run TestGatedTaskHoldsDownstreamUntilAccepted -v`.
Tests live beside the code they cover (`v1_test.go`, `litesql_test.go`); the
suites that matter are `core/session_manager` (gating, retry, cancel),
`core/mcp_proxy` (credential revoke, account lookup) and `input/storage`.

In `frontend/`:

```sh
npm run dev        # vite on port 8888, pinned in vite.config.ts — no Wails runtime
npx tsc --noEmit   # typecheck
npm run lint       # eslint
npm run format     # prettier
```

Regenerate bindings with `~/go/bin/wails generate module` (wails is usually not
on PATH). Never hand-edit `frontend/wailsjs/`.

# Architecture

Hexagonal, with this project's own naming: ports in
`internal/interface/{core,input,output}` (packages `core_itf` / `input_itf` /
`output_itf`), one package per technology in `internal/implementation/`, and
`wire.go` as the only composition root. Add the port first, then the
implementation, then wire it.

`interface/` knows no technology. `implementation/` packages depend on
`interface/`, never on each other. `main.go` stays thin and imports no Wails.

## The run loop

The piece that takes reading several files to see is how a session actually
advances. Four collaborators, wired in that order in `wire.go`:

- **`SessionManager`** (`core/session_manager`) owns graph state: tasks, their
  dependencies, readiness, retries, accept gates, heartbeat deadlines. It hands
  out `ReadyTasks`, takes `Report` from a finished agent, and publishes a
  `SessionProgress` channel from `Execute`. It does not know how to start an
  agent.
- **`Coordinator`** (`core/coordinator`) is the loop. `Run` calls
  `sessions.Execute`, then a goroutine reacts to each progress event and to a
  15s ticker by calling `schedule`: for every ready spec it requests an agent
  from `AgentManager`, `Assign`s it, builds the prompt, and sends it. It also
  spawns a per-agent heartbeat watcher that reports the task failed if the agent
  goes quiet. Kills happen here, not in the session manager.
- **`AgentManager`** (`core/agent_manager`) owns instances on top of one
  `AgentHarness` per vendor (`input/harness/claude_code`, `.../open_code`),
  which are the things that actually spawn a subprocess and stream output.
- **`MCPProxy`** (`core/mcp_proxy`) closes the loop. It serves a local MCP
  server (`constances.GatewayLocalServer`, `"harness"`) exposing two tools:
  `request_approval` and `report_task`. An agent finishing its work calls
  `report_task`, which lands back in `SessionManager.Report` — that is the only
  way a node completes. The proxy also holds the OAuth credentials for remote
  MCP servers and swaps a placeholder for the real key on the way out.

`coordinator.buildPrompt` is where context engineering actually happens: it
composes the task's guidance, its write allowance, the `HandoverDoc`s of every
dependency, and the instruction to call `report_task` exactly once. Read it
before changing anything about how nodes talk to each other.

Note the deliberate cycle break: `SessionManager` needs live context usage and
activity from `AgentManager`, but `AgentManager` is built on top of the MCP
gateway that reports into `SessionManager`. So the session manager takes the
reader separately, after construction, via `TrackLiveAgents` (a narrow
`LiveAgentReader`).

## Durability

Every task write hits the WAL (`input/wal`) before SQLite (`input/storage`),
and `core/wal_sync` replays it at startup — a failed replay degrades to a
warning banner rather than a failed boot. Agents send heartbeats; one that goes
quiet past the deadline has its task dropped back into the pool. File changes
are stored as unified diffs so a revert never depends on git.

# Conventions

- Constructors are `New()` (or `InitV1()` for versioned implementations),
  disambiguated by package path.
- All ids are UUIDv7 via `github.com/google/uuid`, called inline at the call
  site — no `newID()` wrapper.
- Errors go through `custom_error`: `Critical`, `Bypass`, or `TypedCritical`
  with an `enums.ErrorType`.
- Do not add new comments on code changes, except when explicitly asked to.

# Frontend rules

- **Always run the `frontend-design` skill before frontend work.** Every new
  screen, component, or reshape of an existing one starts there, so the result
  is a deliberate design rather than framework defaults.
- **The feature `api` module is the only seam that touches Go.** Every feature
  now calls real bindings *and* keeps a fallback: the api module checks
  `hasWailsRuntime()` and either goes over the bindings or serves the feature's
  mock (`src/features/<domain>/mock-*.ts`, shared ones in `src/shared/api/`).
  That is what keeps port 8888 usable — under a plain vite server there is no
  Wails runtime. Nothing above the api layer may import a mock or a binding
  directly; ESLint `no-restricted-imports` enforces the mock half.
- **Sessions is the worked example.** `api/index.ts` holds graph editing,
  `api/remote-run.ts` builds a `RunSessionSpec`, starts the real run and polls
  `SessionStatus` until it settles, and `api/simulated-run.ts` is the same state
  machine without a backend. A new backed flow follows that split.
- **Types are DTOs, not component props.** Declare the shape in
  `src/features/<domain>/types.ts` as what the Go side returns (string ids, ISO
  timestamps), and map to view shapes at the api boundary.
- **Every flow must be end-to-end testable in the browser.** Mocks model state
  transitions and latency, not just a static payload — a run that starts must
  progress and finish, an approval must resolve, a failure path must be
  reachable. If a flow can only be demonstrated by editing a fixture by hand,
  it is not wired.
- **Written for a human maintainer, not a bot.** Small components with one job,
  names that say what the thing is, no cleverness that needs a comment to
  survive. Pure presentational components take props and render; state lives in
  hooks (the feature's `use-*.ts`, shared ones in `src/shared/hooks/`) and
  TanStack Query. Duplicate before you abstract — a wrong abstraction costs
  more than a repeated block.

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
- `config.yaml`'s `app.data_dir` is the storage key for every on-disk path.
  Renaming it orphans the database, the installed harnesses and the user config.
- The generated bindings in `frontend/wailsjs/` dereference `window.go` /
  `window.runtime` **synchronously**, so outside the Wails webview they throw
  rather than reject. `.catch()` on the returned promise never fires — go
  through `shared/api/bridge.ts` (`bridge` / `hasWailsRuntime`) or the component
  crashes the whole React tree under a plain `vite` dev server.
- `@xyflow/react/dist/base.css` must be imported with `layer(base)`. Unlayered
  CSS beats layered CSS at any specificity, so without it React Flow's defaults
  silently override the project's `@layer components` edge and handle styles.
