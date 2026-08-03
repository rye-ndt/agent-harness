---
description: build, test, or CI is failing or unclear
---

# Build / test / run

## Fast loop

<cmd>                    # <seconds> — run this constantly
<cmd for a single test>  # <how to target one test>

## Full

<cmd>                    # <minutes>

## Prerequisites

- <service, container or env> must be running: `<cmd>`
- env vars: `<VAR>` (see `<file>`)

## Known-slow or known-flaky

- <test or step> — <why> — <workaround>

## Common failures

- `<error string>` -> <cause> -> <fix>
