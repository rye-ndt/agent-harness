package input_itf

import (
	"io"
	"net/http"
)

type DownloadParams struct {
	Checksum   string
	OnProgress func(downloaded, total int64)
}

type HttpRequest struct {
	Method string
	URL    string
	Header http.Header
	Body   io.Reader
}

type HttpResponse struct {
	StatusCode int
	Header     http.Header
	Body       io.ReadCloser
}

type HttpCli interface {
	Reachable(url string) error
	GetString(url string) (string, error)
	GetJSON(url string, v any) error
	PostForm(url string, form map[string]string, v any) error
	PostJSON(url string, body any, v any) error
	Download(url, path string, p *DownloadParams) error
	Stream(req *HttpRequest) (*HttpResponse, error)
}
