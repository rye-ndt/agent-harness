package session_manager

import (
	"fmt"
	"os"
	"path/filepath"

	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/prompts"
)

const contextProtocolTemplate = `
	## Shared repo context

	A knowledge base shared by every agent working on this repo lives at %s.
	It persists across sessions. You may read and write it.

	Files:
	AGENTS.md                      routing: commands, layout, rules
	.agent/glossary.md             domain term -> literal code identifier
	.agent/gotchas.md              traps and the wrong fixes that look right
	.agent/flows/build-test-run.md the dev loop

	Reading — stop as soon as you can act:
	1. AGENTS.md first.
	2. Term unclear? glossary.md
	3. Behaviour unexpected, or build/test failing? gotchas.md, build-test-run.md
	4. Then grep and read source.
	Max 3 files before touching code. If that is not enough, the docs are wrong:
	note it and fall back to grep. Never read these files "for background".

	Writing — at task end. The default outcome is NO CHANGE, and that is success.
	Only consider something you had to discover the hard way: it cost you more than
	5 tool calls, or a wrong attempt. Then both gates must pass:
	1. grep cannot recover it, AND a routine change will not invalidate it.
		Fails for signatures, paths, config values, types, call sites.
	2. you can name the task that would load it, AND loading it changes the
		output. "working in this repo" is not a trigger.
	Route it: term -> glossary.md, trap -> gotchas.md, dev loop -> build-test-run.md,
	commands/layout/rules -> AGENTS.md. Nothing fits cleanly -> discard it.

	Never create a new file to hold one line. Add to the nearest existing one.
	Adding is not free: if a file grows past roughly 200 lines, remove a line of
	equal size first — dead paths, then facts about code you just changed, then
	gotchas for fixed bugs. If nothing can go, your addition is not worth keeping.

	Anything you read that turned out to be WRONG must be fixed. That is mandatory
	and not subject to the gates above: stale docs get followed, missing docs do not.
`

func initContext(root string) error {
	for rel, body := range prompts.ContextSkeleton() {
		dest := filepath.Join(root, rel)

		_, err := os.Stat(dest)
		switch {
		case err == nil:
			continue
		case !os.IsNotExist(err):
			return custom_error.Critical("cannot inspect context file %q: %v", dest, err)
		}

		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return custom_error.Critical("cannot create context dir for %q: %v", dest, err)
		}

		if err := os.WriteFile(dest, body, 0o644); err != nil {
			return custom_error.Critical("cannot write context file %q: %v", dest, err)
		}
	}

	return nil
}

func withContextProtocol(prompts []string, root string) []string {
	out := make([]string, 0, len(prompts)+1)
	out = append(out, prompts...)

	return append(out, fmt.Sprintf(contextProtocolTemplate, root))
}
