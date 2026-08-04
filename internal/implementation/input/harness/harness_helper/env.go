package harness_helper

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"hexago/internal/helpers/enums"
)

func BinPath(dir, name string) string {
	if runtime.GOOS == enums.Windows.String() {
		name += ".exe"
	}

	return filepath.Join(dir, "bin", name)
}

func CleanEnv(extra ...string) []string {
	drop := append([]string{
		"ANTHROPIC_API_KEY=", "ANTHROPIC_AUTH_TOKEN=",
		"CLAUDE_CODE_OAUTH_TOKEN=", "CLAUDE_CONFIG_DIR=",
		"CLAUDE_CODE_USE_BEDROCK=", "CLAUDE_CODE_USE_VERTEX=",
	}, extra...)
	var env []string
outer:
	for _, kv := range os.Environ() {
		for _, d := range drop {
			if strings.HasPrefix(kv, d) {
				continue outer
			}
		}
		env = append(env, kv)
	}
	return env
}
