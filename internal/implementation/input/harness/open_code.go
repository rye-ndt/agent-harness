package harness

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"hexago/internal/implementation/core/custom_error"
	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"
)

const openCodeName = "open-code"

type githubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Digest             string `json:"digest"`
	} `json:"assets"`
}

type openCodeProc struct {
	cmd     *exec.Cmd
	out     chan string
	port    int
	session string
}

type OpenCodeCfg struct {
	Name         string        `mapstructure:"name"`
	BinName      string        `mapstructure:"bin_name"`
	ReleaseBase  string        `mapstructure:"release_base"`
	LoginTimeout time.Duration `mapstructure:"login_timeout"`
}

type openCode struct {
	dir     string
	mu      sync.Mutex
	agents  map[string]*openCodeProc
	cfg     *OpenCodeCfg
	httpCli input_itf.HttpCli
	storage input_itf.HarnessStorage
}

type OpenCodeManagerParams struct {
	GlobalCfg   input_itf.Config
	OpenCodeCfg *OpenCodeCfg
	HttpCli     input_itf.HttpCli
	Storage     input_itf.HarnessStorage
}

func NewOpenCode(p *OpenCodeManagerParams) (input_itf.AgentHarness, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}

	return &openCode{
		dir:     filepath.Join(base, p.GlobalCfg.Read().App.Name, "harness", openCodeName),
		agents:  map[string]*openCodeProc{},
		cfg:     p.OpenCodeCfg,
		httpCli: p.HttpCli,
		storage: p.Storage,
	}, nil
}

func (o *openCode) binPath() string {
	name := o.cfg.BinName

	if runtime.GOOS == enums.Windows.String() {
		name += ".exe"
	}

	return filepath.Join(o.dir, "bin", name)
}

func (o *openCode) dataDir() string {
	return filepath.Join(o.dir, "config")
}

func (o *openCode) authPath() string {
	return filepath.Join(o.dataDir(), "opencode", "auth.json")
}

func (o *openCode) Install(onProgress func(input_itf.InstallProgress)) error {
	if onProgress == nil {
		onProgress = func(input_itf.InstallProgress) {}
	}

	if _, err := os.Stat(o.binPath()); err == nil {
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

	if err := os.MkdirAll(filepath.Dir(o.binPath()), 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	archive := o.binPath() + ".zip"

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

	if err := extractBinary(archive, filepath.Base(o.binPath()), o.binPath()); err != nil {
		return err
	}
	if err := os.Chmod(o.binPath(), 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	if err := o.storage.Save(&input_itf.HarnessInfo{
		Name:     openCodeName,
		Version:  release.TagName,
		Platform: enums.OS(platform),
		Path:     o.binPath(),
	}); err != nil {
		return custom_error.Critical("save install info: %v", err)
	}

	onProgress(input_itf.InstallProgress{Stage: enums.InstallStageDone})

	return nil
}

func (o *openCode) Auth() error {
	if _, err := os.Stat(o.authPath()); err == nil {
		return nil
	}

	if _, err := os.Stat(o.binPath()); err != nil {
		return custom_error.Critical("open code is not installed, run Install first")
	}

	if runtime.GOOS != enums.Mac.String() {
		return custom_error.Critical("interactive login is only implemented for macOS")
	}

	if err := os.MkdirAll(o.dataDir(), 0o755); err != nil {
		return custom_error.Critical("%v", err)
	}

	scriptPath := filepath.Join(o.dir, "login.sh")

	sh := fmt.Sprintf("#!/bin/sh\nexport XDG_DATA_HOME='%s'\nexec '%s' auth login\n",
		o.dataDir(), o.binPath())
	if err := os.WriteFile(scriptPath, []byte(sh), 0o700); err != nil {
		return custom_error.Critical("%v", err)
	}

	if err := exec.Command("osascript",
		"-e", `tell application "Terminal" to activate`,
		"-e", fmt.Sprintf(`tell application "Terminal" to do script "sh '%s'"`, scriptPath),
	).Run(); err != nil {
		return custom_error.Critical("open Terminal for login: %v", err)
	}

	deadline := time.Now().Add(o.cfg.LoginTimeout)
	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)
		if _, err := os.Stat(o.authPath()); err == nil {
			return nil
		}
	}

	return custom_error.Critical("login timed out after %s", o.cfg.LoginTimeout)
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

	o.mu.Lock()
	status.InstanceCount = len(o.agents)
	o.mu.Unlock()

	return status, nil
}

func (o *openCode) Spawn() (*input_itf.Agent, error) {
	if _, err := os.Stat(o.binPath()); err != nil {
		return nil, custom_error.Critical("open code is not installed, run Install first")
	}

	if _, err := os.Stat(o.authPath()); err != nil {
		return nil, custom_error.Critical("not authenticated, run Auth first")
	}

	uid, err := uuid.NewV7()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}
	id := uid.String()

	workdir := filepath.Join(o.dir, "workspaces", id)
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		return nil, custom_error.Critical("%v", err)
	}

	port, err := freePort()
	if err != nil {
		return nil, err
	}

	logFile, err := os.Create(filepath.Join(workdir, "serve.log"))
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}

	cmd := exec.Command(o.binPath(), "serve",
		"--port", strconv.Itoa(port),
		"--hostname", "127.0.0.1",
	)
	cmd.Dir = workdir
	cmd.Env = append(cleanEnv("XDG_DATA_HOME=", "OPENCODE_"),
		"XDG_DATA_HOME="+o.dataDir(),
	)
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	if err := cmd.Start(); err != nil {
		logFile.Close()
		return nil, custom_error.Critical("start open code: %v", err)
	}

	session, err := o.createSession(port)
	if err != nil {
		cmd.Process.Kill()
		go func() {
			cmd.Wait()
			logFile.Close()
		}()
		return nil, err
	}

	out := make(chan string, 64)

	o.mu.Lock()
	o.agents[id] = &openCodeProc{cmd: cmd, out: out, port: port, session: session}
	o.mu.Unlock()

	go streamEvents(port, out)

	go func() {
		cmd.Wait()
		logFile.Close()
		o.mu.Lock()
		delete(o.agents, id)
		o.mu.Unlock()
	}()

	return &input_itf.Agent{ID: id}, nil
}

func (o *openCode) createSession(port int) (string, error) {
	client := &http.Client{Timeout: 2 * time.Second}
	url := fmt.Sprintf("http://127.0.0.1:%d/session", port)

	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		res, err := client.Post(url, "application/json", strings.NewReader("{}"))
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

func streamEvents(port int, out chan string) {
	res, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/event", port))
	if err != nil {
		close(out)
		return
	}
	defer res.Body.Close()

	sc := bufio.NewScanner(res.Body)
	sc.Buffer(make([]byte, 64*1024), 8*1024*1024)
	for sc.Scan() {
		data, ok := strings.CutPrefix(sc.Text(), "data: ")
		if !ok || data == "" {
			continue
		}
		out <- data
	}
	close(out)
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

	url := fmt.Sprintf("http://127.0.0.1:%d/session/%s/message", a.port, a.session)
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

func (o *openCode) Listen(id string) (<-chan string, error) {
	o.mu.Lock()
	a, ok := o.agents[id]
	o.mu.Unlock()
	if !ok {
		return nil, custom_error.Critical("no running agent with id %s", id)
	}
	return a.out, nil
}

func (o *openCode) Uninstall() error {
	o.mu.Lock()

	for _, a := range o.agents {
		a.cmd.Process.Kill()
	}

	o.mu.Unlock()

	if err := os.RemoveAll(o.dir); err != nil {
		return custom_error.Critical("remove install dir: %v", err)
	}

	return nil
}

func (o *openCode) Kill(id string) error {
	o.mu.Lock()
	a, ok := o.agents[id]
	o.mu.Unlock()
	if !ok {
		return custom_error.Critical("no running agent with id %s", id)
	}
	if err := a.cmd.Process.Kill(); err != nil {
		return custom_error.Critical("%v", err)
	}
	return nil
}

func freePort() (int, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, custom_error.Critical("%v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()
	return port, nil
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
