# Frontend

The UI for the agent-harness control plane: sessions are authored as a graph of
task nodes on a canvas, finalized into a run, and watched while agents work
through them. The backend is ahead of the UI, so much of this frontend runs
against mocks — but always behind a seam that the real Wails bindings slot into
without touching anything above it.

## Stack

React 19, TypeScript in strict mode, Vite 7, TanStack Query 5 for server
state, Tailwind v4 for styling, `@xyflow/react` for the graph canvas, and
Radix/shadcn-style primitives in `src/shared/ui/`. The dev server is web-based
on port 8888 (`npm run dev`, pinned in `vite.config.ts`); inside the shipped
app the same bundle runs in the Wails webview with the Go side bound to
`window.go`.

## Layout

The tree is organized by feature, not by layer. A component, its hooks, its
types, and the seam it talks through live together.

```
src/
  app/                 composition root: entry, query client, providers, error boundary, global CSS
  features/
    sessions/          the core domain: task graph, canvas, node dialogs, inspector
      api/             the sessions seam (see "Sessions run model" below)
      components/      canvas/, nodes/, inspector/, dialogs, the sessions rail
      graph.ts         pure graph operations on the session/task model
      types.ts         the DTO contract with the Go side
      use-*.ts         feature hooks (query + mutations, view-state store)
      mock-sessions.ts fixture backing the seam outside the webview
    agents/            agent roster, install and login flows
    templates/         agent template CRUD and the prompt/param editors
    settings/          preferences, MCP servers, per-agent defaults
    onboarding/        dependency check and the welcome/install dialog
  shared/
    ui/                design-system primitives (button, dialog, select, ...)
    components/        composed cross-feature components (fields, pickers, spines)
    lib/               pure utilities: enums, formatting, error helpers
    hooks/             cross-feature hooks
    api/               the Wails bridge and shared seams (dialogs, mock-fs)
```

Each feature holds what it needs of that shape — `agents/` has a flat `api.ts`,
`settings/` splits its seam into `api/mcp.ts` and `api/preferences.ts`,
`onboarding/` has no seam of its own and drives the agents seam instead.

## The api seam

The one load-bearing rule: **a feature's `api` module is the only place the
generated Wails bindings are called.** Every seam function checks
`hasWailsRuntime()` and either calls the real binding or falls back to a mock.
The mocks are not static payloads — they model latency and state transitions
(an install progresses through stages, a run walks the graph and settles), so
every flow is testable end to end in a plain browser.

Nothing above the seam may import a `mock-*` module. This is enforced by
ESLint (`no-restricted-imports` on `**/mock-*`, exempting only the api modules
and the mocks themselves), so the compiler catches the layering violation
before review does.

`src/shared/api/bridge.ts` exists because the generated bindings in `wailsjs/`
dereference `window.go` **synchronously** — outside the webview they throw
rather than reject, so `.catch()` on the returned promise never fires and an
unguarded call crashes the React tree under the plain Vite dev server. Seam
code wraps binding calls in `bridge()` so failures land as rejected promises,
and uses `hasWailsRuntime()` to decide real-vs-mock.

## State model

Server state lives in TanStack Query and nowhere else. The pattern is in
`src/features/sessions/use-sessions.ts`: every mutation writes its expected
result into the query cache optimistically, rolls back on error, and is
reconciled by an invalidate-and-refetch on settle. Queries default to
`staleTime: Infinity` with no focus refetch (`src/app/query-client.ts`); data
moves when a mutation settles or an active run polls.

View state — which session is open, which task is selected, which dialog is
showing — stays in local component state. `use-session-store.ts` composes the
sessions query with the selection state and is the single source of truth the
canvas reads. There is deliberately no global client-state store: the app has
exactly one screen, and lifting state any higher than it needs to be has cost
and no benefit.

## Sessions run model

A session graph is authored as a draft: nodes, dependencies, positions, all
editable. Finalizing freezes the draft and builds a run spec. From there the
two environments diverge behind `src/features/sessions/api/index.ts`:

- `api/store.ts` owns the in-memory session list and draft persistence —
  inside the webview drafts hydrate from and save back to the Go side as one
  JSON doc per session.
- `api/remote-run.ts` drives a real run: it submits the spec through the
  generated bindings and polls `SessionStatus` until the run settles, mapping
  remote task states back onto the client graph.
- `api/simulated-run.ts` is the browser fallback: a simulated engine walks the
  graph in dependency order on a timer, moving tasks through the same states a
  real run would, including failure paths.

Components never know which engine is running; they see the same session
objects either way, refreshed by `use-sessions.ts` polling the seam while any
task is active.

## Tooling

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm run build`
(which typechecks first). ESLint uses a flat config (`eslint.config.js`) with
typescript-eslint, react-hooks, and react-refresh, with Prettier for
formatting and `eslint-config-prettier` to keep them out of each other's way.

Import aliases: `@/*` maps to `src/*`, `@wailsjs/*` maps to the generated
bindings in `wailsjs/` — which are regenerated by Wails and never hand-edited.

## Performance ground rules

The hot path is agent output streaming into React for the life of a run.
The rules that follow from that:

- Continuous gestures — node drag, search-as-you-type, resize — render from
  local state and cross the bridge once, when the gesture ends.
- Every `EventsOn` subscription returns its unsubscribe from `useEffect`; a
  leaked listener pins the closure and everything it captured.
- Anything that grows for the length of a run is bounded. Run logs are the
  case that matters: cap the lines held in React state and let SQLite keep
  the rest.
- Lists past ~100 rows get virtualized instead of mounted whole.

One styling gotcha worth knowing: `@xyflow/react/dist/base.css` must be
imported with `layer(base)` (see `src/app/index.css`). Unlayered CSS beats
layered CSS at any specificity, so without it React Flow's defaults silently
override the project's `@layer components` edge and handle styles.
