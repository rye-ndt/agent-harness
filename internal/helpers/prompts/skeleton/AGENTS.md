# <repo-name> — agent guide

<2-4 sentences: what this system does, in domain terms. Stop.>

## Commands

build:     <cmd>
test:      <cmd>
test-one:  <cmd pattern for a single test>
lint:      <cmd>
run:       <cmd>
typecheck: <cmd>

## Layout

<3-8 lines. ONLY non-obvious mappings. Skip anything self-evident from the name.>

<path>/    <what lives here> — <constraint if any>
<path>/    DEAD. do not read or modify.

## Rules

- <5-10 imperatives that would otherwise produce a wrong PR>
- <phrase as commands, not principles>

## Knowledge index — read on demand

| Load when | File |
|---|---|
| terminology or naming unclear | .agent/glossary.md |
| behaviour is unexpected | .agent/gotchas.md |
| build, test or CI failing | .agent/flows/build-test-run.md |
