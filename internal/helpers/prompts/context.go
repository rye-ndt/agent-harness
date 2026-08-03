package prompts

import "embed"

//go:embed skeleton/*.md
var skeletonFiles embed.FS

var skeletonLayout = map[string]string{
	"AGENTS.md":                      "skeleton/AGENTS.md",
	".agent/glossary.md":             "skeleton/glossary.md",
	".agent/gotchas.md":              "skeleton/gotchas.md",
	".agent/flows/build-test-run.md": "skeleton/build-test-run.md",
}

var contextSkeleton = loadSkeleton()

func ContextSkeleton() map[string][]byte {
	return contextSkeleton
}

func loadSkeleton() map[string][]byte {
	out := make(map[string][]byte, len(skeletonLayout))

	for dest, src := range skeletonLayout {
		b, err := skeletonFiles.ReadFile(src)
		if err != nil {
			panic(err)
		}

		out[dest] = b
	}

	return out
}
