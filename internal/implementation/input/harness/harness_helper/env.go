package harness_helper

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"hexago/internal/helpers/custom_error"
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

func SandboxEnv(root string, extra ...string) ([]string, error) {
	managed := [][2]string{
		{"AGENT_TOOLS", root},
		{"TMPDIR", filepath.Join(root, "tmp")},
		{"XDG_CACHE_HOME", filepath.Join(root, "cache")},
		{"npm_config_prefix", filepath.Join(root, "npm")},
		{"npm_config_cache", filepath.Join(root, "cache", "npm")},
		{"PNPM_HOME", filepath.Join(root, "npm")},
		{"BUN_INSTALL", filepath.Join(root, "npm")},
		{"GOPATH", filepath.Join(root, "go")},
		{"GOMODCACHE", filepath.Join(root, "go", "pkg", "mod")},
		{"GOBIN", filepath.Join(root, "bin")},
		{"GOCACHE", filepath.Join(root, "cache", "go-build")},
		{"CARGO_HOME", filepath.Join(root, "cargo")},
		{"RUSTUP_HOME", filepath.Join(root, "rustup")},
		{"PIP_CACHE_DIR", filepath.Join(root, "cache", "pip")},
		{"PYTHONUSERBASE", filepath.Join(root, "python")},
		{"UV_CACHE_DIR", filepath.Join(root, "cache", "uv")},
		{"PLAYWRIGHT_BROWSERS_PATH", filepath.Join(root, "playwright-browsers")},
	}

	for _, dir := range []string{
		filepath.Join(root, "bin"),
		filepath.Join(root, "tmp"),
		filepath.Join(root, "cache"),
		npmBinDir(root),
	} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, custom_error.Critical("create agent sandbox dir %s: %v", dir, err)
		}
	}

	drop := make([]string, 0, len(managed)+len(extra)+1)

	for _, kv := range managed {
		drop = append(drop, kv[0]+"=")
	}

	drop = append(drop, "PATH=")
	drop = append(drop, extra...)

	env := CleanEnv(drop...)

	for _, kv := range managed {
		env = append(env, kv[0]+"="+kv[1])
	}

	return append(env, "PATH="+sandboxPath(root)), nil
}

func npmBinDir(root string) string {
	if runtime.GOOS == enums.Windows.String() {
		return filepath.Join(root, "npm")
	}

	return filepath.Join(root, "npm", "bin")
}

func sandboxPath(root string) string {
	entries := []string{filepath.Join(root, "bin"), npmBinDir(root)}

	if existing := os.Getenv("PATH"); existing != "" {
		entries = append(entries, existing)
	}

	return strings.Join(entries, string(os.PathListSeparator))
}
