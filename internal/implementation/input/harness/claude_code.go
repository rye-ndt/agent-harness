package harness

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"hexago/internal/implementation/helpers/enums"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type claudeManifest struct {
	Platforms map[string]struct {
		Binary   string `json:"binary"`
		Checksum string `json:"checksum"`
	} `json:"platforms"`
}

type agentProc struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
}

type claudeCode struct {
	log     output_itf.Logger
	dir     string
	mu      sync.Mutex
	agents  map[string]*agentProc
	cfg     *input_itf.ClaudeCodeConfig
	httpCli input_itf.HttpCli
	tokenRe *regexp.Regexp
	ansiRe  *regexp.Regexp
}

func New(
	globalCfg input_itf.Config,
	claudeCodeCfg *input_itf.ClaudeCodeConfig,
	logger output_itf.Logger,
	httpCli input_itf.HttpCli,
) (input_itf.HarnessAgent, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	tokenRe, err := regexp.Compile(claudeCodeCfg.TokenRegex)
	if err != nil {
		return nil, fmt.Errorf("compile token_regex: %w", err)
	}
	ansiRe, err := regexp.Compile(claudeCodeCfg.AnsiRegex)
	if err != nil {
		return nil, fmt.Errorf("compile ansi_regex: %w", err)
	}

	return &claudeCode{
		log:     logger,
		dir:     filepath.Join(base, globalCfg.Read().App.Name, "harness", "claude-code"),
		agents:  map[string]*agentProc{},
		cfg:     claudeCodeCfg,
		httpCli: httpCli,
		tokenRe: tokenRe,
		ansiRe:  ansiRe,
	}, nil
}

func (c *claudeCode) binPath() string {
	name := c.cfg.BinName

	if runtime.GOOS == enums.Windows.String() {
		name += ".exe"
	}

	return filepath.Join(c.dir, "bin", name)
}

func (c *claudeCode) configDir() string {
	return filepath.Join(c.dir, "config")
}

func (c *claudeCode) tokenPath() string {
	return filepath.Join(c.dir, "credentials")
}

func (c *claudeCode) Install() error {
	if _, err := os.Stat(c.binPath()); err == nil {
		return nil
	}

	platform, err := platformString()
	if err != nil {
		return err
	}

	version, err := c.httpCli.GetString(c.cfg.ReleaseBase + "/stable")
	if err != nil {
		return fmt.Errorf("resolve stable version: %w", err)
	}

	manifest := &claudeManifest{}

	if err := c.httpCli.GetJSON(c.cfg.ReleaseBase+"/"+version+"/manifest.json", manifest); err != nil {
		return fmt.Errorf("fetch manifest: %w", err)
	}

	entry, ok := manifest.Platforms[platform]
	if !ok {
		return fmt.Errorf("no claude code build for platform %s", platform)
	}

	c.log.Info("installing claude code", "version", version, "platform", platform)

	if err := os.MkdirAll(filepath.Dir(c.binPath()), 0o755); err != nil {
		return err
	}

	tmp := c.binPath() + ".download"

	url := c.cfg.ReleaseBase + "/" + version + "/" + platform + "/" + entry.Binary
	if err := c.httpCli.Download(url, tmp, &input_itf.DownloadParams{Checksum: entry.Checksum}); err != nil {
		return fmt.Errorf("download binary: %w", err)
	}
	if err := os.Chmod(tmp, 0o755); err != nil {
		return err
	}
	if err := os.Rename(tmp, c.binPath()); err != nil {
		return err
	}

	c.log.Info("claude code installed", "version", version, "path", c.binPath())
	return nil
}

// Auth runs the interactive OAuth login for the managed install. The flow
// needs a real terminal (browser hand-off plus a pasted code), so it is
// launched in Terminal.app under `script`, which records the terminal output;
// the token printed by `claude setup-token` is captured from that recording
// into the credentials file. Spawn injects it as CLAUDE_CODE_OAUTH_TOKEN, so
// credentials never touch the user's Keychain or their own ~/.claude login.
func (c *claudeCode) Auth() error {
	if _, err := os.Stat(c.tokenPath()); err == nil {
		return nil
	}
	if _, err := os.Stat(c.binPath()); err != nil {
		return fmt.Errorf("claude code is not installed, run Install first")
	}
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("interactive login is only implemented for macOS")
	}
	if err := os.MkdirAll(c.configDir(), 0o755); err != nil {
		return err
	}

	logPath := filepath.Join(c.dir, "login.log")
	os.Remove(logPath)

	scriptPath := filepath.Join(c.dir, "login.sh")
	sh := fmt.Sprintf("#!/bin/sh\nexport CLAUDE_CONFIG_DIR='%s'\nexec script -q '%s' '%s' setup-token\n",
		c.configDir(), logPath, c.binPath())
	if err := os.WriteFile(scriptPath, []byte(sh), 0o700); err != nil {
		return err
	}

	if err := exec.Command("osascript",
		"-e", `tell application "Terminal" to activate`,
		"-e", fmt.Sprintf(`tell application "Terminal" to do script "sh '%s'"`, scriptPath),
	).Run(); err != nil {
		return fmt.Errorf("open Terminal for login: %w", err)
	}
	c.log.Info("claude code login started in Terminal, waiting for token")

	deadline := time.Now().Add(c.cfg.LoginTimeout)
	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)
		raw, err := os.ReadFile(logPath)
		if err != nil {
			continue
		}
		clean := c.ansiRe.ReplaceAllString(strings.ReplaceAll(string(raw), "\r", ""), "")
		if tok := c.tokenRe.FindString(clean); tok != "" {
			if err := os.WriteFile(c.tokenPath(), []byte(tok), 0o600); err != nil {
				return err
			}
			os.Remove(logPath)
			c.log.Info("claude code login complete")
			return nil
		}
	}
	return fmt.Errorf("login timed out after %s", c.cfg.LoginTimeout)
}

// Spawn starts a long-lived headless Claude Code session speaking
// newline-delimited JSON on stdin/stdout, in its own workspace directory and
// with only the managed credentials in its environment.
func (c *claudeCode) Spawn() (*input_itf.Agent, error) {
	if _, err := os.Stat(c.binPath()); err != nil {
		return nil, fmt.Errorf("claude code is not installed, run Install first")
	}
	token, err := os.ReadFile(c.tokenPath())
	if err != nil {
		return nil, fmt.Errorf("not authenticated, run Auth first")
	}

	id, err := newID()
	if err != nil {
		return nil, err
	}
	workdir := filepath.Join(c.dir, "workspaces", id)
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		return nil, err
	}

	cmd := exec.Command(c.binPath(), "-p",
		"--input-format", "stream-json",
		"--output-format", "stream-json",
		"--verbose",
	)
	cmd.Dir = workdir
	cmd.Env = append(cleanEnv(),
		"CLAUDE_CONFIG_DIR="+c.configDir(),
		"CLAUDE_CODE_OAUTH_TOKEN="+strings.TrimSpace(string(token)),
	)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start claude code: %w", err)
	}

	c.mu.Lock()
	c.agents[id] = &agentProc{cmd: cmd, stdin: stdin, stdout: stdout}
	c.mu.Unlock()

	// Reap the process so the map never holds exited agents.
	go func() {
		err := cmd.Wait()
		c.mu.Lock()
		delete(c.agents, id)
		c.mu.Unlock()
		c.log.Info("agent exited", "id", id, "err", err)
	}()

	c.log.Info("agent spawned", "id", id, "pid", cmd.Process.Pid)
	return &input_itf.Agent{ID: id}, nil
}

func (c *claudeCode) Kill(id string) error {
	c.mu.Lock()
	a, ok := c.agents[id]
	c.mu.Unlock()
	if !ok {
		return fmt.Errorf("no running agent with id %s", id)
	}
	a.stdin.Close()
	return a.cmd.Process.Kill()
}

func platformString() (string, error) {
	goos := map[string]string{"darwin": "darwin", "linux": "linux", "windows": "win32"}[runtime.GOOS]
	arch := map[string]string{"arm64": "arm64", "amd64": "x64"}[runtime.GOARCH]
	if goos == "" || arch == "" {
		return "", fmt.Errorf("unsupported platform %s/%s", runtime.GOOS, runtime.GOARCH)
	}
	return goos + "-" + arch, nil
}

// cleanEnv strips auth and routing variables from the inherited environment
// so the user's own Anthropic credentials can never take precedence over the
// managed token.
func cleanEnv() []string {
	drop := []string{
		"ANTHROPIC_API_KEY=", "ANTHROPIC_AUTH_TOKEN=",
		"CLAUDE_CODE_OAUTH_TOKEN=", "CLAUDE_CONFIG_DIR=",
		"CLAUDE_CODE_USE_BEDROCK=", "CLAUDE_CODE_USE_VERTEX=",
	}
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

func newID() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
