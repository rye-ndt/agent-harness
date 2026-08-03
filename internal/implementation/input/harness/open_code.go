package harness

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"

	"hexago/internal/helpers"
	"hexago/internal/helpers/constances"
	"hexago/internal/helpers/enums"
	"hexago/internal/helpers/prompts"
	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/implementation/input/harness/harness_helper"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
)

const openCodeName = "open-code"

var openCodePermissions = map[string]string{
	"edit":     "allow",
	"bash":     "allow",
	"webfetch": "allow",
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Digest             string `json:"digest"`
	} `json:"assets"`
}

type openCodeProc struct {
	cmd       *exec.Cmd
	out       chan string
	port      int
	session   string
	done      chan struct{}
	exited    chan struct{}
	lastOut   atomic.Int64
	ctxWindow int
	usageMu   sync.Mutex
	usage     input_itf.ContextUsage
}

type openCodeUsage struct {
	Properties struct {
		Info struct {
			Tokens struct {
				Input     int `json:"input"`
				Output    int `json:"output"`
				Reasoning int `json:"reasoning"`
				Cache     struct {
					Read  int `json:"read"`
					Write int `json:"write"`
				} `json:"cache"`
			} `json:"tokens"`
		} `json:"info"`
	} `json:"properties"`
}

func (p *openCodeProc) trackUsage(line []byte) {
	event := &openCodeUsage{}
	if err := json.Unmarshal(line, event); err != nil {
		return
	}

	reported := event.Properties.Info.Tokens

	used := reported.Input +
		reported.Output +
		reported.Reasoning +
		reported.Cache.Read +
		reported.Cache.Write

	if used == 0 {
		return
	}

	p.usageMu.Lock()
	p.usage = input_itf.ContextUsage{
		Total:      p.ctxWindow,
		Used:       used,
		Input:      reported.Input,
		Output:     reported.Output,
		CacheRead:  reported.Cache.Read,
		CacheWrite: reported.Cache.Write,
		UpdatedAt:  helpers.NewUTC(),
	}
	p.usageMu.Unlock()
}

func (p *openCodeProc) snapshotUsage() *input_itf.ContextUsage {
	p.usageMu.Lock()
	defer p.usageMu.Unlock()

	snapshot := p.usage
	snapshot.Total = p.ctxWindow

	return &snapshot
}

type OpenCodeCfg struct {
	Name          string            `mapstructure:"name" validate:"required"`
	BinName       string            `mapstructure:"bin_name" validate:"required"`
	ReleaseBase   string            `mapstructure:"release_base" validate:"required,http_url"`
	LoginTimeout  time.Duration     `mapstructure:"login_timeout" validate:"gt=0"`
	MaxInstance   int               `mapstructure:"max_instance" validate:"required,gt=0"`
	EnabledModels []enums.ModelName `mapstructure:"enabled_models" validate:"required,dive,model_name"`
}

type openCode struct {
	dir           string
	binPath       string
	dataDir       string
	authPath      string
	workspacesDir string

	mu           sync.Mutex
	agents       map[string]*openCodeProc
	uninstalled  bool
	authMu       sync.Mutex
	installMu    sync.Mutex
	cfg          *OpenCodeCfg
	httpCli      input_itf.HttpCli
	storage      input_itf.HarnessStorage
	agentCfg     map[string]any
	systemPrompt []byte
	env          []string
	sessionCli   *http.Client
	ctxWindow    int
}

func NewOpenCode(
	globalCfg input_itf.Config,
	httpCli input_itf.HttpCli,
	db input_itf.HarnessStorage,
	mcpGateway *core_itf.MCPGateway,
	openCodeCfg *OpenCodeCfg,
) (input_itf.AgentHarness, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}

	dir := filepath.Join(base, globalCfg.Read().App.Name, "harness", openCodeName)
	dataDir := filepath.Join(dir, "config")

	cfg := map[string]any{
		"permission": openCodePermissions,
	}

	if block := openCodeMCPCfg(mcpGateway); block != nil {
		cfg["mcp"] = block
	}

	return &openCode{
		dir:           dir,
		binPath:       binPath(dir, openCodeCfg.BinName),
		dataDir:       dataDir,
		authPath:      filepath.Join(dataDir, "opencode", "auth.json"),
		workspacesDir: filepath.Join(dir, "workspaces"),

		agents:       map[string]*openCodeProc{},
		cfg:          openCodeCfg,
		httpCli:      httpCli,
		storage:      db,
		agentCfg:     cfg,
		systemPrompt: prompts.System(),
		env:          append(cleanEnv("XDG_DATA_HOME=", "OPENCODE_"), "XDG_DATA_HOME="+dataDir),
		sessionCli:   &http.Client{Timeout: 2 * time.Second},
		ctxWindow:    globalCfg.Read().AgentManager.AllowedAgentContextWindow,
	}, nil
}

func (o *openCode) SupportedModels() []enums.ModelName {
	return slices.Clone(o.cfg.EnabledModels)
}

func (o *openCode) Support(name enums.ModelName) bool {
	return slices.Contains(o.cfg.EnabledModels, name)
}

func (o *openCode) atLimit() bool {
	return len(o.agents) >= o.cfg.MaxInstance
}

func (o *openCode) Install(onProgress func(input_itf.InstallProgress)) error {
	o.installMu.Lock()
	defer o.installMu.Unlock()

	if onProgress == nil {
		onProgress = func(input_itf.InstallProgress) {}
	}

	if _, err := os.Stat(o.binPath); err == nil {
		info, err := o.storage.Find(openCodeName)
		if err != nil {
			return custom_error.Critical("find harness info: %v", err)
		}
		if info != nil {
			onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDone})
			return nil
		}
	}

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageResolve})

	platform, err := openCodePlatform()
	if err != nil {
		return err
	}

	release := &githubRelease{}

	if err := o.httpCli.GetJSON(o.cfg.ReleaseBase+"/releases/latest", release); err != nil {
		return custom_error.Critical("resolve latest release: %v", err)
	}

	want := o.cfg.BinName + "-" + platform + ".zip"

	var url, checksum string
	for _, a := range release.Assets {
		if a.Name == want {
			url = a.BrowserDownloadURL
			checksum = strings.TrimPrefix(a.Digest, "sha256:")
			break
		}
	}
	if url == "" {
		return custom_error.Critical("no open code build for platform %s", platform)
	}

	if err := os.MkdirAll(filepath.Dir(o.binPath), 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	archive := o.binPath + ".zip"

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDownload})

	if err := o.httpCli.Download(url, archive, &input_itf.DownloadParams{
		Checksum: checksum,
		OnProgress: func(downloaded, total int64) {
			onProgress(input_itf.InstallProgress{
				Stage:      enums.InstallStageDownload,
				Downloaded: downloaded,
				Total:      total,
			})
		},
	}); err != nil {
		return custom_error.Critical("download archive: %v", err)
	}
	defer os.Remove(archive)

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageExtract})

	if err := extractBinary(archive, filepath.Base(o.binPath), o.binPath); err != nil {
		return err
	}
	if err := os.Chmod(o.binPath, 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	if err := o.storage.Save(&input_itf.HarnessEntity{
		Name:     openCodeName,
		Version:  strings.TrimPrefix(release.TagName, "v"),
		Platform: enums.OS(platform),
		Path:     o.binPath,
	}); err != nil {
		return custom_error.Critical("save install info: %v", err)
	}

	o.mu.Lock()
	o.uninstalled = false
	o.mu.Unlock()

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDone})

	return nil
}

func (o *openCode) Auth() (string, error) {
	if !o.authMu.TryLock() {
		return "", custom_error.Critical("auth is already in progress")
	}
	defer o.authMu.Unlock()

	if _, err := os.Stat(o.authPath); err == nil {
		return "", nil
	}

	if _, err := os.Stat(o.binPath); err != nil {
		return "", custom_error.Critical("open code is not installed, run Install first")
	}

	if runtime.GOOS != enums.Mac.String() {
		return "", custom_error.Critical("interactive login is only implemented for macOS")
	}

	if err := os.MkdirAll(o.dataDir, 0o755); err != nil {
		return "", custom_error.Critical("%v", err)
	}

	scriptPath := filepath.Join(o.dir, "login.sh")

	sh := fmt.Sprintf("#!/bin/sh\nexport XDG_DATA_HOME='%s'\nexec '%s' auth login\n",
		o.dataDir, o.binPath)
	if err := os.WriteFile(scriptPath, []byte(sh), 0o700); err != nil {
		return "", custom_error.Critical("%v", err)
	}

	if err := exec.Command("osascript",
		"-e", `tell application "Terminal" to activate`,
		"-e", fmt.Sprintf(`tell application "Terminal" to do script "sh '%s'"`, scriptPath),
	).Run(); err != nil {
		return "", custom_error.Critical("open Terminal for login: %v", err)
	}

	deadline := time.Now().Add(o.cfg.LoginTimeout)
	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)
		if _, err := os.Stat(o.authPath); err == nil {
			return "", nil
		}
	}

	return "", custom_error.Critical("login timed out after %s", o.cfg.LoginTimeout)
}

func (o *openCode) SubmitAuthCode(code string) error {
	return custom_error.Critical("open code login does not use an auth code")
}

func (o *openCode) Status() (*input_itf.AgentStatus, error) {
	status := &input_itf.AgentStatus{Name: o.cfg.Name}

	info, err := o.storage.Find(openCodeName)
	if err != nil {
		return nil, custom_error.Critical("find harness info: %v", err)
	}

	if info != nil {
		if _, err := os.Stat(info.Path); err == nil {
			status.Installed = true
			status.Version = info.Version
		}
	}

	if _, err := os.Stat(o.authPath); err == nil {
		status.LoggedIn = true
	}

	o.mu.Lock()
	status.InstanceCount = len(o.agents)
	o.mu.Unlock()

	return status, nil
}

func (o *openCode) Spawn(
	name enums.ModelName,
	thinkingLevel enums.ThinkingLevel,
	systemPrompts []string,
	workdir string,
) (uuid.UUID, error) {
	if workdir != "" {
		return uuid.Nil, custom_error.Critical("open code does not support a custom working dir yet")
	}

	if !o.Support(name) {
		return uuid.Nil, custom_error.Critical("open code does not support model %s", name)
	}

	if _, err := os.Stat(o.binPath); err != nil {
		return uuid.Nil, custom_error.Critical("open code is not installed, run Install first")
	}

	if _, err := os.Stat(o.authPath); err != nil {
		return uuid.Nil, custom_error.Critical("not authenticated, run Auth first")
	}

	o.mu.Lock()
	limited := o.atLimit()
	o.mu.Unlock()

	if limited {
		return uuid.Nil, custom_error.Critical("open code is at its limit of %d instances", o.cfg.MaxInstance)
	}

	uid, err := uuid.NewV7()
	if err != nil {
		return uuid.Nil, custom_error.Critical("%v", err)
	}
	id := uid.String()

	workspace := filepath.Join(o.workspacesDir, id)
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		return uuid.Nil, custom_error.Critical("%v", err)
	}

	agentCfg := maps.Clone(o.agentCfg)
	agentCfg["model"] = string(name)

	rawCfg, err := json.Marshal(agentCfg)
	if err != nil {
		os.RemoveAll(workspace)
		return uuid.Nil, custom_error.Critical("build open code config: %v", err)
	}

	rawCfg = bytes.ReplaceAll(
		rawCfg,
		[]byte(constances.GatewayAgentPlaceholder),
		[]byte(id),
	)

	if err := harness_helper.WriteNewFile(filepath.Join(workspace, "opencode.json"), rawCfg, 0o600); err != nil {
		os.RemoveAll(workspace)
		return uuid.Nil, custom_error.Critical("write opencode config: %v", err)
	}

	if err := os.WriteFile(filepath.Join(workspace, "AGENTS.md"), agentsFile(o.systemPrompt, systemPrompts), 0o644); err != nil {
		os.RemoveAll(workspace)
		return uuid.Nil, custom_error.Critical("%v", err)
	}

	port, err := freePort(constances.GlobalLocalHost)
	if err != nil {
		os.RemoveAll(workspace)
		return uuid.Nil, err
	}

	logFile, err := os.Create(filepath.Join(workspace, "serve.log"))
	if err != nil {
		os.RemoveAll(workspace)
		return uuid.Nil, custom_error.Critical("%v", err)
	}

	cmd := exec.Command(
		o.binPath,
		"serve",
		"--port", strconv.Itoa(port),
		"--hostname", constances.GlobalLocalHost,
	)

	cmd.Dir = workspace
	cmd.Env = o.env
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	harness_helper.SetProcAttrs(cmd)

	if err := cmd.Start(); err != nil {
		logFile.Close()
		os.RemoveAll(workspace)
		return uuid.Nil, custom_error.Critical("start open code: %v", err)
	}

	session, err := o.createSession(port)
	if err != nil {
		harness_helper.KillProc(cmd)
		go func() {
			cmd.Wait()
			logFile.Close()
			os.RemoveAll(workspace)
		}()
		return uuid.Nil, err
	}

	out := make(chan string, 64)
	done := make(chan struct{})
	exited := make(chan struct{})

	abort := func() {
		harness_helper.KillProc(cmd)
		cmd.Wait()
		logFile.Close()
		os.RemoveAll(workspace)
	}

	o.mu.Lock()
	if o.uninstalled {
		o.mu.Unlock()
		abort()
		return uuid.Nil, custom_error.Critical("open code was uninstalled")
	}

	if o.atLimit() {
		o.mu.Unlock()
		abort()
		return uuid.Nil, custom_error.Critical("open code is at its limit of %d instances", o.cfg.MaxInstance)
	}
	proc := &openCodeProc{cmd: cmd, out: out, port: port, session: session, done: done, exited: exited, ctxWindow: o.ctxWindow}
	proc.lastOut.Store(helpers.NewUTCUnix())

	o.agents[id] = proc
	o.mu.Unlock()

	streamClosed := make(chan struct{})

	go streamEvents(o.baseURL(port), out, done, streamClosed, proc)

	go func() {
		select {
		case <-done:
		case <-streamClosed:
		}
		harness_helper.KillProc(cmd)
		cmd.Wait()
		logFile.Close()
		os.RemoveAll(workspace)
		o.mu.Lock()
		delete(o.agents, id)
		o.mu.Unlock()
		close(exited)
	}()

	return uid, nil
}

func (o *openCode) baseURL(port int) string {
	return "http://" + net.JoinHostPort(constances.GlobalLocalHost, strconv.Itoa(port))
}

func (o *openCode) createSession(port int) (string, error) {
	url := o.baseURL(port) + "/session"

	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		res, err := o.sessionCli.Post(url, "application/json", strings.NewReader("{}"))
		if err != nil {
			time.Sleep(200 * time.Millisecond)
			continue
		}
		if res.StatusCode != http.StatusOK {
			res.Body.Close()
			time.Sleep(200 * time.Millisecond)
			continue
		}

		var session struct {
			ID string `json:"id"`
		}
		err = json.NewDecoder(res.Body).Decode(&session)
		res.Body.Close()
		if err != nil {
			return "", custom_error.Critical("decode session: %v", err)
		}
		return session.ID, nil
	}

	return "", custom_error.Critical("open code server did not become ready on port %d", port)
}

func streamEvents(
	baseURL string,
	out chan string,
	done <-chan struct{},
	closed chan<- struct{},
	proc *openCodeProc,
) {
	defer close(closed)
	defer close(out)

	res, err := http.Get(baseURL + "/event")
	if err != nil {
		return
	}
	defer res.Body.Close()

	sc := bufio.NewScanner(res.Body)
	sc.Buffer(make([]byte, 64*1024), 8*1024*1024)
	for sc.Scan() {
		proc.lastOut.Store(helpers.NewUTCUnix())

		data, ok := strings.CutPrefix(sc.Text(), "data: ")
		if !ok || data == "" {
			continue
		}

		proc.trackUsage([]byte(data))

		select {
		case out <- data:
		case <-done:
			return
		}
	}
}

func (o *openCode) Send(id string, message string) error {
	o.mu.Lock()
	a, ok := o.agents[id]
	o.mu.Unlock()
	if !ok {
		return custom_error.Critical("no running agent with id %s", id)
	}

	payload, err := json.Marshal(map[string]any{
		"parts": []map[string]string{
			{"type": "text", "text": message},
		},
	})
	if err != nil {
		return custom_error.Critical("%v", err)
	}

	url := fmt.Sprintf("%s/session/%s/message", o.baseURL(a.port), a.session)
	res, err := http.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		return custom_error.Critical("send to agent %s: %v", id, err)
	}
	defer res.Body.Close()
	io.Copy(io.Discard, res.Body)

	if res.StatusCode != http.StatusOK {
		return custom_error.Critical("send to agent %s: %s", id, res.Status)
	}
	return nil
}

func (o *openCode) Alive(id string) (time.Time, error) {
	o.mu.Lock()
	a, ok := o.agents[id]
	o.mu.Unlock()
	if !ok {
		return time.Time{}, custom_error.Critical("no running agent with id %s", id)
	}

	select {
	case <-a.exited:
		return time.Time{}, custom_error.Critical("agent %s has exited", id)
	default:
	}

	return time.Unix(a.lastOut.Load(), 0).UTC(), nil
}

func (o *openCode) Usage(id string) (*input_itf.ContextUsage, error) {
	o.mu.Lock()
	a, ok := o.agents[id]
	o.mu.Unlock()
	if !ok {
		return nil, custom_error.Critical("no running agent with id %s", id)
	}

	return a.snapshotUsage(), nil
}

func (o *openCode) Listen(id string) (<-chan string, error) {
	o.mu.Lock()
	a, ok := o.agents[id]
	o.mu.Unlock()
	if !ok {
		return nil, custom_error.Critical("no running agent with id %s", id)
	}
	return a.out, nil
}

func (o *openCode) stopAll() {
	o.mu.Lock()
	procs := make([]*openCodeProc, 0, len(o.agents))
	for id, a := range o.agents {
		procs = append(procs, a)
		delete(o.agents, id)
	}
	o.mu.Unlock()

	for _, a := range procs {
		close(a.done)
	}

	for _, a := range procs {
		select {
		case <-a.exited:
		case <-time.After(5 * time.Second):
		}
	}
}

func (o *openCode) Shutdown() {
	o.stopAll()
}

func (o *openCode) Uninstall() error {
	o.mu.Lock()
	o.uninstalled = true
	o.mu.Unlock()

	o.stopAll()

	if err := os.RemoveAll(o.dir); err != nil {
		return custom_error.Critical("remove install dir: %v", err)
	}

	return nil
}

func (o *openCode) Kill(id string) error {
	o.mu.Lock()
	a, ok := o.agents[id]
	if ok {
		delete(o.agents, id)
	}
	o.mu.Unlock()
	if !ok {
		return custom_error.Critical("no running agent with id %s", id)
	}
	close(a.done)
	return nil
}

func agentsFile(base []byte, extra []string) []byte {
	parts := []string{strings.TrimSpace(string(base))}

	for _, prompt := range extra {
		if trimmed := strings.TrimSpace(prompt); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}

	return []byte(strings.Join(slices.DeleteFunc(parts, func(s string) bool { return s == "" }), "\n\n"))
}

func freePort(host string) (int, error) {
	ln, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
	if err != nil {
		return 0, custom_error.Critical("%v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()
	return port, nil
}

func openCodeMCPCfg(gateway *core_itf.MCPGateway) map[string]any {
	if gateway == nil || len(gateway.Servers) == 0 {
		return nil
	}

	block := map[string]any{}

	for _, server := range gateway.Servers {
		headers := map[string]string{
			gateway.TokenHeader:           gateway.Token,
			constances.GatewayAgentHeader: constances.GatewayAgentPlaceholder,
		}

		if server.AuthKeyName != "" {
			headers["Authorization"] = "Bearer " + server.AuthKeyName
		}

		block[server.Name] = map[string]any{
			"type":    "remote",
			"url":     gateway.BaseURL + "/mcp/" + server.Name,
			"enabled": true,
			"headers": headers,
		}
	}

	return block
}

func openCodePlatform() (string, error) {
	goos := map[string]string{"darwin": "darwin", "linux": "linux", "windows": "windows"}[runtime.GOOS]
	arch := map[string]string{"arm64": "arm64", "amd64": "x64"}[runtime.GOARCH]
	if goos == "" || arch == "" {
		return "", custom_error.Critical("unsupported platform %s/%s", runtime.GOOS, runtime.GOARCH)
	}
	return goos + "-" + arch, nil
}

func extractBinary(archive, member, dest string) error {
	r, err := zip.OpenReader(archive)
	if err != nil {
		return custom_error.Critical("open archive: %v", err)
	}
	defer r.Close()

	for _, f := range r.File {
		if filepath.Base(f.Name) != member {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return custom_error.Critical("%v", err)
		}
		tmp := dest + ".tmp"
		out, err := os.Create(tmp)
		if err != nil {
			rc.Close()
			return custom_error.Critical("%v", err)
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		if cerr := out.Close(); err == nil {
			err = cerr
		}
		if err == nil {
			err = os.Rename(tmp, dest)
		}
		if err != nil {
			os.Remove(tmp)
			return custom_error.Critical("%v", err)
		}
		return nil
	}

	return custom_error.Critical("%s not found in archive", member)
}
