package input_itf

type DownloadParams struct {
	Checksum string
}

type HttpCli interface {
	GetString(url string) (string, error)
	GetJSON(url string, v any) error
	Download(url, path string, p *DownloadParams) error
}
