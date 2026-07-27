package input_itf

type DownloadParams struct {
	Checksum   string
	OnProgress func(downloaded, total int64)
}

type HttpCli interface {
	GetString(url string) (string, error)
	GetJSON(url string, v any) error
	PostForm(url string, form map[string]string, v any) error
	PostJSON(url string, body any, v any) error
	Download(url, path string, p *DownloadParams) error
}
