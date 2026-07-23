package harness

import (
	"bufio"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/implementation/input/harness/harness_helper"
	input_itf "hexago/internal/interface/input"
)

const harnessName = "claude-code"

var authURLRe = regexp.MustCompile(`https://[A-Za-z0-9._~:/?#&=%+-]+`)

type authSession struct {
	cmd    *exec.Cmd
	tty    *os.File
	mu     sync.Mutex
	out    []byte
	killed bool
	done   chan struct{}
}

func (s *authSession) read() {
	buf := make([]byte, 4096)
	for {
		n, err := s.tty.Read(buf)
		if n > 0 {
			s.mu.Lock()
			s.out = append(s.out, buf[:n]...)
			if len(s.out) > 128*1024 {
				s.out = append(s.out[:0:0], s.out[len(s.out)-64*1024:]...)
			}
			s.mu.Unlock()
		}
		if err != nil {
			break
		}
	}
	s.cmd.Wait()
	close(s.done)
}

func (s *authSession) snapshot() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return string(s.out)
}

func (s *authSession) wasKilled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.killed
}

func (s *authSession) close() {
	select {
	case <-s.done:
	default:
		s.mu.Lock()
		s.killed = true
		s.mu.Unlock()
	}
	s.cmd.Process.Kill()
	s.tty.Close()
	select {
	case <-s.done:
	case <-time.After(5 * time.Second):
	}
}

type claudeManifest struct {
	Platforms map[string]struct {
		Binary   string `json:"binary"`
		Checksum string `json:"checksum"`
	} `json:"platforms"`
}

type agentProc struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdinMu sync.Mutex
	stdout  io.ReadCloser
	out     chan string
	done    chan struct{}
	exited  chan struct{}
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
	dir         string
	mu          sync.Mutex
	agents      map[string]*agentProc
	uninstalled bool
	authMu      sync.Mutex
	auth        *authSession
	loginMu     sync.Mutex
	cfg         *ClaudeCodeCfg
	httpCli     input_itf.HttpCli
	storage     input_itf.HarnessStorage
	tokenRe     *regexp.Regexp
	ansiRe      *regexp.Regexp
}

type ClaudeManagerParams struct {
	GlobalCfg     input_itf.Config
	ClaudeCodeCfg *ClaudeCodeCfg
	HttpCli       input_itf.HttpCli
	Storage       input_itf.HarnessStorage
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
		os.Remove(tmp)
		return custom_error.Critical("%v", err)
	}
	if err := os.Rename(tmp, c.binPath()); err != nil {
		os.Remove(tmp)
		return custom_error.Critical("%v", err)
	}

	if err := c.storage.Save(&input_itf.HarnessInfo{
		Name:     harnessName,
		Version:  version,
		Platform: enums.OS(platform),
		Path:     c.binPath(),
	}); err != nil {
		return custom_error.Critical("save install info: %v", err)
	}

	c.mu.Lock()
	c.uninstalled = false
	c.mu.Unlock()

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDone})

	return nil
}

func (c *claudeCode) Auth() (string, error) {
	if !c.loginMu.TryLock() {
		return "", custom_error.Critical("auth is already in progress")
	}
	defer c.loginMu.Unlock()

	if _, err := os.Stat(c.tokenPath()); err == nil {
		return "", nil
	}

	if _, err := os.Stat(c.binPath()); err != nil {
		return "", custom_error.Critical("claude code is not installed, run Install first")
	}

	if err := os.MkdirAll(c.configDir(), 0o755); err != nil {
		return "", custom_error.Critical("%v", err)
	}

	cmd := exec.Command(c.binPath(), "setup-token")
	cmd.Env = append(cleanEnv(),
		"CLAUDE_CONFIG_DIR="+c.configDir(),
		"TERM=xterm-256color",
	)

	tty, err := harness_helper.StartPty(cmd, 500, 50)
	if err != nil {
		return "", custom_error.Critical("start login session: %v", err)
	}

	s := &authSession{cmd: cmd, tty: tty, done: make(chan struct{})}
	go s.read()

	c.authMu.Lock()
	old := c.auth
	c.auth = s
	c.authMu.Unlock()
	if old != nil {
		old.close()
	}

	go func() {
		select {
		case <-s.done:
		case <-time.After(c.cfg.LoginTimeout):
		}
		c.dropAuth(s)
	}()

	go func() {
		tok, err := c.waitFor(s, c.tokenRe, c.cfg.LoginTimeout)
		if err != nil {
			return
		}
		if err := os.WriteFile(c.tokenPath(), []byte(tok), 0o600); err != nil {
			return
		}
		c.dropAuth(s)
	}()

	url, err := c.waitFor(s, authURLRe, 30*time.Second)
	if err != nil {
		c.dropAuth(s)
		return "", custom_error.Critical("wait for login url: %v", err)
	}

	return url, nil
}

func (c *claudeCode) SubmitAuthCode(code string) error {
	if _, err := os.Stat(c.tokenPath()); err == nil {
		return nil
	}

	c.authMu.Lock()
	s := c.auth
	c.authMu.Unlock()
	if s == nil {
		return custom_error.Critical("no login in progress, run Auth first")
	}

	if _, err := s.tty.Write([]byte(strings.TrimSpace(code) + "\r")); err != nil {
		return custom_error.Critical("write auth code: %v", err)
	}

	tok, err := c.waitFor(s, c.tokenRe, 30*time.Second)
	if err != nil {
		return custom_error.Critical("confirm login: %v", err)
	}

	if err := os.WriteFile(c.tokenPath(), []byte(tok), 0o600); err != nil {
		return custom_error.Critical("%v", err)
	}

	c.dropAuth(s)

	return nil
}

func (c *claudeCode) dropAuth(s *authSession) {
	c.authMu.Lock()
	if c.auth == s {
		c.auth = nil
	}
	c.authMu.Unlock()
	s.close()
}

func (c *claudeCode) waitFor(s *authSession, re *regexp.Regexp, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for {
		clean := c.ansiRe.ReplaceAllString(strings.ReplaceAll(s.snapshot(), "\r", ""), "")
		if loc := re.FindStringIndex(clean); loc != nil && loc[1] < len(clean) {
			return clean[loc[0]:loc[1]], nil
		}

		select {
		case <-s.done:
			if s.wasKilled() {
				return "", custom_error.Critical("login session was cancelled")
			}
			clean = c.ansiRe.ReplaceAllString(strings.ReplaceAll(s.snapshot(), "\r", ""), "")
			if m := re.FindString(clean); m != "" {
				return m, nil
			}
			return "", custom_error.Critical("login process exited unexpectedly")
		default:
		}

		if time.Now().After(deadline) {
			return "", custom_error.Critical("timed out after %s", timeout)
		}

		time.Sleep(200 * time.Millisecond)
	}
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

	if _, err := os.Stat(c.tokenPath()); err == nil {
		status.LoggedIn = true
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

	uid, err := uuid.NewV7()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}
	id := uid.String()

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
		os.RemoveAll(workdir)
		return nil, custom_error.Critical("%v", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		stdin.Close()
		os.RemoveAll(workdir)
		return nil, custom_error.Critical("%v", err)
	}
	stderr, err := os.Create(filepath.Join(workdir, "stderr.log"))
	if err != nil {
		stdin.Close()
		stdout.Close()
		os.RemoveAll(workdir)
		return nil, custom_error.Critical("%v", err)
	}
	cmd.Stderr = stderr
	harness_helper.SetProcAttrs(cmd)

	if err := cmd.Start(); err != nil {
		stderr.Close()
		os.RemoveAll(workdir)
		return nil, custom_error.Critical("start claude code: %v", err)
	}

	out := make(chan string, 64)
	done := make(chan struct{})
	exited := make(chan struct{})

	c.mu.Lock()
	if c.uninstalled {
		c.mu.Unlock()
		harness_helper.KillProc(cmd)
		cmd.Wait()
		stderr.Close()
		os.RemoveAll(workdir)
		return nil, custom_error.Critical("claude code was uninstalled")
	}
	c.agents[id] = &agentProc{cmd: cmd, stdin: stdin, stdout: stdout, out: out, done: done, exited: exited}
	c.mu.Unlock()

	go func() {
		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 64*1024), 8*1024*1024)
		for sc.Scan() {
			select {
			case out <- sc.Text():
			case <-done:
			}
		}
		close(out)
		harness_helper.KillProc(cmd)
		cmd.Wait()
		stderr.Close()
		os.RemoveAll(workdir)
		c.mu.Lock()
		delete(c.agents, id)
		c.mu.Unlock()
		close(exited)
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

	a.stdinMu.Lock()
	_, err = a.stdin.Write(append(payload, '\n'))
	a.stdinMu.Unlock()
	if err != nil {
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

func (c *claudeCode) stopAll() {
	c.authMu.Lock()
	s := c.auth
	c.auth = nil
	c.authMu.Unlock()
	if s != nil {
		s.close()
	}

	c.mu.Lock()
	procs := make([]*agentProc, 0, len(c.agents))
	for id, a := range c.agents {
		procs = append(procs, a)
		delete(c.agents, id)
	}
	c.mu.Unlock()

	for _, a := range procs {
		close(a.done)
		a.stdin.Close()
		harness_helper.SignalProc(a.cmd)
	}

	for _, a := range procs {
		select {
		case <-a.exited:
		case <-time.After(5 * time.Second):
		}
	}
}

func (c *claudeCode) Shutdown() {
	c.stopAll()
}

func (c *claudeCode) Uninstall() error {
	c.mu.Lock()
	c.uninstalled = true
	c.mu.Unlock()

	c.stopAll()

	if err := os.RemoveAll(c.dir); err != nil {
		return custom_error.Critical("remove install dir: %v", err)
	}

	return nil
}

func (c *claudeCode) Kill(id string) error {
	c.mu.Lock()
	a, ok := c.agents[id]
	if ok {
		delete(c.agents, id)
	}
	c.mu.Unlock()
	if !ok {
		return custom_error.Critical("no running agent with id %s", id)
	}
	close(a.done)
	a.stdin.Close()
	if err := harness_helper.SignalProc(a.cmd); err != nil {
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
