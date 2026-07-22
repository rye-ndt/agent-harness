package harness

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
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

	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/implementation/helpers/enums"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

const harnessName = "claude-code"

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
	out    chan string
}

type ClaudeCodeCfg struct {
	Name         string        `mapstructure:"name"`
	BinName      string        `mapstructure:"bin_name"`
	ReleaseBase  string        `mapstructure:"release_base"`
	LoginTimeout time.Duration `mapstructure:"login_timeout"`
	TokenRegex   string        `mapstructure:"token_regex"`
	AnsiRegex    string        `mapstructure:"ansi_regex"`
}

type claudeCode struct {
	dir     string
	mu      sync.Mutex
	agents  map[string]*agentProc
	cfg     *ClaudeCodeCfg
	httpCli input_itf.HttpCli
	storage output_itf.HarnessStorage
	tokenRe *regexp.Regexp
	ansiRe  *regexp.Regexp
}

type ClaudeManagerParams struct {
	GlobalCfg     input_itf.Config
	ClaudeCodeCfg *ClaudeCodeCfg
	HttpCli       input_itf.HttpCli
	Storage       output_itf.HarnessStorage
}

func NewClaudeCode(p *ClaudeManagerParams) (input_itf.AgentHarness, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}

	tokenRe, err := regexp.Compile(p.ClaudeCodeCfg.TokenRegex)
	if err != nil {
		return nil, custom_error.Critical("compile token_regex: %v", err)
	}

	ansiRe, err := regexp.Compile(p.ClaudeCodeCfg.AnsiRegex)
	if err != nil {
		return nil, custom_error.Critical("compile ansi_regex: %v", err)
	}

	return &claudeCode{
		dir:     filepath.Join(base, p.GlobalCfg.Read().App.Name, "harness", harnessName),
		agents:  map[string]*agentProc{},
		cfg:     p.ClaudeCodeCfg,
		httpCli: p.HttpCli,
		storage: p.Storage,
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

func (c *claudeCode) Install(onProgress func(input_itf.InstallProgress)) error {
	if onProgress == nil {
		onProgress = func(input_itf.InstallProgress) {}
	}

	if _, err := os.Stat(c.binPath()); err == nil {
		info, err := c.storage.Find(harnessName)
		if err != nil {
			return custom_error.Critical("find harness info: %v", err)
		}
		if info != nil {
			onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDone})
			return nil
		}
	}

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageResolve})

	platform, err := platformString()
	if err != nil {
		return err
	}

	version, err := c.httpCli.GetString(c.cfg.ReleaseBase + "/stable")
	if err != nil {
		return custom_error.Critical("resolve stable version: %v", err)
	}

	manifest := &claudeManifest{}

	if err := c.httpCli.GetJSON(c.cfg.ReleaseBase+"/"+version+"/manifest.json", manifest); err != nil {
		return custom_error.Critical("fetch manifest: %v", err)
	}

	entry, ok := manifest.Platforms[platform]
	if !ok {
		return custom_error.Critical("no claude code build for platform %s", platform)
	}

	if err := os.MkdirAll(filepath.Dir(c.binPath()), 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	tmp := c.binPath() + ".download"

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDownload})

	url := c.cfg.ReleaseBase + "/" + version + "/" + platform + "/" + entry.Binary
	if err := c.httpCli.Download(url, tmp, &input_itf.DownloadParams{
		Checksum: entry.Checksum,
		OnProgress: func(downloaded, total int64) {
			onProgress(input_itf.InstallProgress{
				Stage:      enums.InstallStageDownload,
				Downloaded: downloaded,
				Total:      total,
			})
		},
	}); err != nil {
		return custom_error.Critical("download binary: %v", err)
	}
	if err := os.Chmod(tmp, 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}
	if err := os.Rename(tmp, c.binPath()); err != nil {
		return custom_error.Critical("%v", err)
	}

	if err := c.storage.Save(&output_itf.HarnessInfo{
		Name:     harnessName,
		Version:  version,
		Platform: enums.OS(platform),
		Path:     c.binPath(),
	}); err != nil {
		return custom_error.Critical("save install info: %v", err)
	}

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDone})

	return nil
}

func (c *claudeCode) Auth() error {
	if _, err := os.Stat(c.tokenPath()); err == nil {
		return nil
	}

	if _, err := os.Stat(c.binPath()); err != nil {
		return custom_error.Critical("claude code is not installed, run Install first")
	}

	if runtime.GOOS != enums.Mac.String() {
		return custom_error.Critical("interactive login is only implemented for macOS")
	}

	if err := os.MkdirAll(c.configDir(), 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	logPath := filepath.Join(c.dir, "login.log")
	os.Remove(logPath)

	scriptPath := filepath.Join(c.dir, "login.sh")

	sh := fmt.Sprintf("#!/bin/sh\nexport CLAUDE_CONFIG_DIR='%s'\nexec script -q '%s' '%s' setup-token\n",
		c.configDir(), logPath, c.binPath())
	if err := os.WriteFile(scriptPath, []byte(sh), 0o700); err != nil {
		return custom_error.Critical("%v", err)
	}

	if err := exec.Command("osascript",
		"-e", `tell application "Terminal" to activate`,
		"-e", fmt.Sprintf(`tell application "Terminal" to do script "sh '%s'"`, scriptPath),
	).Run(); err != nil {
		return custom_error.Critical("open Terminal for login: %v", err)
	}

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
				return custom_error.Critical("%v", err)
			}
			os.Remove(logPath)
			return nil
		}
	}

	return custom_error.Critical("login timed out after %s", c.cfg.LoginTimeout)
}

func (c *claudeCode) Status() (*input_itf.AgentStatus, error) {
	status := &input_itf.AgentStatus{Name: c.cfg.Name}

	info, err := c.storage.Find(harnessName)
	if err != nil {
		return nil, custom_error.Critical("find harness info: %v", err)
	}

	if info != nil {
		if _, err := os.Stat(info.Path); err == nil {
			status.Installed = true
			status.Version = info.Version
		}
	}

	c.mu.Lock()
	status.InstanceCount = len(c.agents)
	c.mu.Unlock()

	return status, nil
}

func (c *claudeCode) Spawn() (*input_itf.Agent, error) {
	if _, err := os.Stat(c.binPath()); err != nil {
		return nil, custom_error.Critical("claude code is not installed, run Install first")
	}

	token, err := os.ReadFile(c.tokenPath())
	if err != nil {
		return nil, custom_error.Critical("not authenticated, run Auth first")
	}

	id, err := newID()
	if err != nil {
		return nil, err
	}

	workdir := filepath.Join(c.dir, "workspaces", id)
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		return nil, custom_error.Critical("%v", err)
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
		return nil, custom_error.Critical("%v", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}
	stderr, err := os.Create(filepath.Join(workdir, "stderr.log"))
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		stderr.Close()
		return nil, custom_error.Critical("start claude code: %v", err)
	}

	out := make(chan string, 64)

	c.mu.Lock()
	c.agents[id] = &agentProc{cmd: cmd, stdin: stdin, stdout: stdout, out: out}
	c.mu.Unlock()

	go func() {
		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 64*1024), 8*1024*1024)
		for sc.Scan() {
			out <- sc.Text()
		}
		close(out)
		cmd.Wait()
		stderr.Close()
		c.mu.Lock()
		delete(c.agents, id)
		c.mu.Unlock()
	}()

	return &input_itf.Agent{ID: id}, nil
}

func (c *claudeCode) Send(id string, message string) error {
	c.mu.Lock()
	a, ok := c.agents[id]
	c.mu.Unlock()
	if !ok {
		return custom_error.Critical("no running agent with id %s", id)
	}

	payload, err := json.Marshal(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []map[string]string{
				{"type": "text", "text": message},
			},
		},
	})
	if err != nil {
		return custom_error.Critical("%v", err)
	}

	if _, err := a.stdin.Write(append(payload, '\n')); err != nil {
		return custom_error.Critical("write to agent %s: %v", id, err)
	}
	return nil
}

func (c *claudeCode) Listen(id string) (<-chan string, error) {
	c.mu.Lock()
	a, ok := c.agents[id]
	c.mu.Unlock()
	if !ok {
		return nil, custom_error.Critical("no running agent with id %s", id)
	}
	return a.out, nil
}

func (c *claudeCode) Uninstall() error {
	c.mu.Lock()

	for _, a := range c.agents {
		a.stdin.Close()
		a.cmd.Process.Kill()
	}

	c.mu.Unlock()

	if err := os.RemoveAll(c.dir); err != nil {
		return custom_error.Critical("remove install dir: %v", err)
	}

	return nil
}

func (c *claudeCode) Kill(id string) error {
	c.mu.Lock()
	a, ok := c.agents[id]
	c.mu.Unlock()
	if !ok {
		return custom_error.Critical("no running agent with id %s", id)
	}
	a.stdin.Close()
	if err := a.cmd.Process.Kill(); err != nil {
		return custom_error.Critical("%v", err)
	}
	return nil
}

func platformString() (string, error) {
	goos := map[string]string{"darwin": "darwin", "linux": "linux", "windows": "win32"}[runtime.GOOS]
	arch := map[string]string{"arm64": "arm64", "amd64": "x64"}[runtime.GOARCH]
	if goos == "" || arch == "" {
		return "", custom_error.Critical("unsupported platform %s/%s", runtime.GOOS, runtime.GOARCH)
	}
	return goos + "-" + arch, nil
}

func cleanEnv(extra ...string) []string {
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

func newID() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", custom_error.Critical("%v", err)
	}
	return hex.EncodeToString(b), nil
}
