package prompts

import (
	"embed"
	"strings"
)

//go:embed *.md
var files embed.FS

var system = load()

func System() []byte {
	return []byte(system)
}

func load() string {
	entries, err := files.ReadDir(".")
	if err != nil {
		panic(err)
	}

	var parts []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		b, err := files.ReadFile(e.Name())
		if err != nil {
			panic(err)
		}
		if s := strings.TrimSpace(string(b)); s != "" {
			parts = append(parts, s)
		}
	}

	return strings.Join(parts, "\n\n")
}
