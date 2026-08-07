package mcp_proxy_helpers

import (
	"encoding/json"
	"io"
	"net/http"

	input_itf "hexago/internal/interface/input"
)

const accountBodyLimit = 1 << 20

func FetchAccount(httpCli input_itf.HttpCli, cfg *input_itf.MCPAccountConfig, token string) string {
	if cfg == nil || token == "" {
		return ""
	}

	value := token
	if cfg.Scheme != "" {
		value = cfg.Scheme + " " + token
	}

	header := http.Header{}
	header.Set(cfg.Header, value)
	header.Set("Accept", "application/json")

	res, err := httpCli.Stream(&input_itf.HttpRequest{
		Method: http.MethodGet,
		URL:    cfg.URL,
		Header: header,
	})
	if err != nil {
		return ""
	}

	defer res.Body.Close()

	if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
		return ""
	}

	payload := map[string]any{}
	if err := json.NewDecoder(io.LimitReader(res.Body, accountBodyLimit)).Decode(&payload); err != nil {
		return ""
	}

	for _, field := range cfg.Fields {
		if account, ok := payload[field].(string); ok && account != "" {
			return account
		}
	}

	return ""
}
