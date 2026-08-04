# Nexo

Set up a workflow, hand it to a fleet of AI agents, go play pickleball. Either approve or revert it once you are back. That's everything. _n8n_, but AI-native.

Want help setting this up for your team, custom templates, or tuning it for your company? Please contact nduytung.1611@gmail.com.

<!-- Drop a screenshot of the canvas mid-run here. Nothing sells a desktop app faster. -->

## How it works

You draw the work as a graph. Each node is one scoped task: a role, a model, the
files it's allowed to touch, plus whatever guidance it needs. Nexo runs agents
through the graph, watches them, captures the diff, and feeds what each node
learned into the next node's prompt.

## Requirements

- macOS. Windows is half-built and untested.
- Go 1.25+
- Node 20+
- Wails: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

Wails installs to `~/go/bin`, which might not be on your PATH. The Makefile
finds it either way.

## Run it

```sh
git clone https://github.com/rye-ndt/nexo.git
cd nexo
make dev
```

Then, in the app:

1. install and sign in to Claude Code / Open Code in settings
2. authorize any MCP servers you need
3. start a session
4. make templates — each one is a kind of agent that does a kind of work
5. drop nodes on the canvas and wire them together, mixing agent types freely
6. finalize the session, run it
7. go play pickleball
8. come back, review, revert what you don't like
9. commit

Two things that will bite you: run from the repo root, because `config.yaml` is
read from the working directory. And use `make dev` — `go run .` dies on a Wails
build tag.

## Config

`config.yaml` holds window size, timeouts, model lists, and the MCP servers you
can authorize.

**Change `encode_key` before you use this for real.** It encrypts your stored
OAuth tokens, and the default value is committed to this repo, so it isn't a
secret. Also: a typo anywhere in that file surfaces as a nil panic instead of a
readable error. Blame viper.

### Is this an another LLM wrapper?

No. And the reasons are

**Nodes are a DAG, not a queue.** Chaining is the entire point.

**The handover doc is the product.** A finished node writes down what it did,
what blocked it, what got approved, what got _rejected_, what to avoid, and
what's still broken. That doc becomes the next node's context. Telling the next
agent what **not** to do matters as much as telling it what happened.

**It assumes agents fail.** Every write hits a WAL before it commits and replays
into SQLite on restart. Agents send heartbeats — go quiet and your task drops
back into the pool. Every file change is stored as a unified diff, so you can
revert without depending on git.

**Agents never see your secrets.** Nexo does the OAuth once, encrypts the token,
and hands agents a placeholder name. The proxy swaps in the real key on the way
out, and refuses anything aimed at an auth endpoint.

## Why not just Claude Code?

Claude Code and OpenCode are great at one task, and Nexo runs on top of them
anyway. But:

- can you delegate a 10-step job, walk away, and trust it without reading every line?
- can you make it follow _your_ procedure instead of improvising one?
- can you see why it chose what it chose?
- what happens when your vendor triples the price?
- can you undo step 4 and keep steps 1 through 3?

That's what this is for.

v0.0.1 · MIT · last big update Aug 4, 2026

## Is this vibe-coded?

No. I built the backend and the architecture by hand, so I know how it works.
Claude helped with the frontend.

## Buy me a coffee

- BTC `bc1q5kaek7dnkfah0h958ys4lzn574yu6lpu2tzwsr`
- EVM `0xeb8d8C405C4d377fcFB61FFF3b0Bb730B103A51f`
- SVM `rypBpVeH5HmMXKkMRHy3W4fWRhCUSPHsxD3hDy46QPG`
