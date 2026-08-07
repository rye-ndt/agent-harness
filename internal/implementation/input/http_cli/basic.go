package http_cli

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	neturl "net/url"
	"os"
	"strings"
	"time"

	"hexago/internal/helpers/custom_error"
	input_itf "hexago/internal/interface/input"
)

type BasicHttpCliCfg struct {
	Timeout time.Duration `mapstructure:"timeout"`
}

type basic struct {
	client *http.Client
	stream *http.Client
	cfg    *BasicHttpCliCfg
}

func New(cfg *BasicHttpCliCfg) input_itf.HttpCli {
	return &basic{
		client: &http.Client{Timeout: cfg.Timeout},
		stream: &http.Client{
			Transport: &http.Transport{
				ResponseHeaderTimeout: cfg.Timeout,
			},
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		cfg: cfg,
	}
}

func (f *basic) get(url string) (*http.Response, error) {
	res, err := f.client.Get(url)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, custom_error.Critical("GET %s: %s", url, res.Status)
	}
	return res, nil
}

func (f *basic) Reachable(url string) error {
	res, err := f.client.Head(url)
	if err != nil {
		return custom_error.Critical("HEAD %s: %v", url, err)
	}

	res.Body.Close()

	return nil
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

func (f *basic) post(url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", "application/json")

	res, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode < http.StatusOK || res.StatusCode > 299 {
		detail, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		res.Body.Close()
		return nil, custom_error.Critical("POST %s: %s: %s", url, res.Status, strings.TrimSpace(string(detail)))
	}
	return res, nil
}

func (f *basic) PostForm(url string, form map[string]string, v any) error {
	values := neturl.Values{}
	for k, val := range form {
		values.Set(k, val)
	}

	res, err := f.post(url, "application/x-www-form-urlencoded", strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if v == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(v)
}

func (f *basic) PostJSON(url string, body any, v any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}

	res, err := f.post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if v == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(v)
}

func (f *basic) Stream(req *input_itf.HttpRequest) (*input_itf.HttpResponse, error) {
	r, err := http.NewRequest(req.Method, req.URL, req.Body)
	if err != nil {
		return nil, err
	}

	for name, values := range req.Header {
		for _, v := range values {
			r.Header.Add(name, v)
		}
	}

	res, err := f.stream.Do(r)
	if err != nil {
		return nil, err
	}

	return &input_itf.HttpResponse{
		StatusCode: res.StatusCode,
		Header:     res.Header,
		Body:       res.Body,
	}, nil
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
		return custom_error.Critical("GET %s: %s", url, res.Status)
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
			return custom_error.Critical("checksum mismatch: got %s, want %s", sum, p.Checksum)
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
