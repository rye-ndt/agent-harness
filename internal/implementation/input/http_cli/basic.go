package http_cli

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	input_itf "hexago/internal/interface/input"
)

type BasicHttpCliCfg struct {
	Timeout time.Duration `mapstructure:"timeout"`
}

type basic struct {
	client *http.Client
	cfg    *BasicHttpCliCfg
}

func New(cfg *BasicHttpCliCfg) input_itf.HttpCli {
	return &basic{
		client: &http.Client{Timeout: cfg.Timeout},
		cfg:    cfg,
	}
}

func (f *basic) get(url string) (*http.Response, error) {
	res, err := f.client.Get(url)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, fmt.Errorf("GET %s: %s", url, res.Status)
	}
	return res, nil
}

func (f *basic) GetString(url string) (string, error) {
	res, err := f.get(url)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	b, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}

func (f *basic) GetJSON(url string, v any) error {
	res, err := f.get(url)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	return json.NewDecoder(res.Body).Decode(v)
}

// Download streams url into path. The client's total timeout would abort
// large downloads mid-stream, so this uses http.Get directly. If p carries a
// checksum, the file's hex SHA-256 must match it or the file is removed.
func (f *basic) Download(url, path string, p *input_itf.DownloadParams) error {
	res, err := http.Get(url)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: %s", url, res.Status)
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	h := sha256.New()
	dst := io.MultiWriter(file, h)
	if p != nil && p.OnProgress != nil {
		dst = io.MultiWriter(dst, &progressWriter{total: res.ContentLength, onProgress: p.OnProgress})
	}
	_, err = io.Copy(dst, res.Body)
	if cerr := file.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(path)
		return err
	}

	if p != nil && p.Checksum != "" {
		if sum := hex.EncodeToString(h.Sum(nil)); sum != p.Checksum {
			os.Remove(path)
			return fmt.Errorf("checksum mismatch: got %s, want %s", sum, p.Checksum)
		}
	}
	return nil
}

type progressWriter struct {
	total      int64
	written    int64
	reported   int64
	onProgress func(downloaded, total int64)
}

const reportStep = 256 * 1024

func (w *progressWriter) Write(b []byte) (int, error) {
	w.written += int64(len(b))
	if w.written-w.reported >= reportStep || w.written == w.total {
		w.reported = w.written
		w.onProgress(w.written, w.total)
	}
	return len(b), nil
}
