package mcp_proxy_helpers

import (
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
)

var authSegments = map[string]any{
	".well-known":   struct{}{},
	"oauth":         struct{}{},
	"oauth2":        struct{}{},
	"authorize":     struct{}{},
	"authorization": struct{}{},
	"token":         struct{}{},
	"register":      struct{}{},
	"login":         struct{}{},
	"userinfo":      struct{}{},
	"revoke":        struct{}{},
	"introspect":    struct{}{},
}

var hopByHopHeaders = map[string]any{
	"connection":          struct{}{},
	"proxy-connection":    struct{}{},
	"keep-alive":          struct{}{},
	"proxy-authenticate":  struct{}{},
	"proxy-authorization": struct{}{},
	"te":                  struct{}{},
	"trailer":             struct{}{},
	"transfer-encoding":   struct{}{},
	"upgrade":             struct{}{},
	"host":                struct{}{},
	"content-length":      struct{}{},
}

func RejectAuthRequest(target, tokenEndpoint string) error {
	u, err := url.Parse(target)
	if err != nil || u.Host == "" {
		return custom_error.TypedCritical(enums.ErrMcpForbiddenRequest, "mcp target %q is not a valid url", target)
	}

	for _, segment := range strings.Split(u.Path, "/") {
		if _, blocked := authSegments[strings.ToLower(segment)]; blocked {
			return custom_error.TypedCritical(enums.ErrMcpForbiddenRequest, "mcp target %q points at an authorization endpoint", target)
		}
	}

	if tokenEndpoint != "" && sameEndpoint(u, tokenEndpoint) {
		return custom_error.TypedCritical(enums.ErrMcpForbiddenRequest, "mcp target %q is the token endpoint", target)
	}

	return nil
}

func sameEndpoint(target *url.URL, raw string) bool {
	other, err := url.Parse(raw)
	if err != nil {
		return false
	}

	return strings.EqualFold(target.Host, other.Host) &&
		strings.Trim(target.Path, "/") == strings.Trim(other.Path, "/")
}

func ForwardHeader(header http.Header, placeholder, secret string) http.Header {
	replacer := secretReplacer(placeholder)

	forwarded := http.Header{}

	for name, values := range header {
		if _, skip := hopByHopHeaders[strings.ToLower(name)]; skip {
			continue
		}

		for _, v := range values {
			forwarded.Add(name, replacer.ReplaceAllLiteralString(v, secret))
		}
	}

	return forwarded
}

func ForwardBody(body io.Reader, placeholder, secret string) ([]byte, error) {
	if body == nil {
		return nil, nil
	}

	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, custom_error.TypedCritical(enums.ErrMcpRequestFailed, "cannot read agent request body: %v", err)
	}

	return secretReplacer(placeholder).ReplaceAllLiteral(raw, []byte(secret)), nil
}

func secretReplacer(placeholder string) *regexp.Regexp {
	return regexp.MustCompile(regexp.QuoteMeta(placeholder))
}
