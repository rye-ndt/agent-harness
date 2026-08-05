package mcp_proxy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"hexago/internal/helpers/constances"
	input_itf "hexago/internal/interface/input"
)

const (
	figmaNotConnected = "Figma is not connected. Add a Figma personal access token in Settings, then try again."
	figmaReadTimeout  = 30 * time.Second
	maxFigmaBody      = 8 << 20
)

func (s *v1) serveFigma(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	req := &rpcRequest{}
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		writeRPC(w, &rpcResponse{
			JSONRPC: "2.0",
			Error:   &rpcError{Code: -32700, Message: "cannot parse request"},
		})

		return
	}

	if len(req.ID) == 0 {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	res := &rpcResponse{JSONRPC: "2.0", ID: req.ID}

	switch req.Method {
	case "initialize":
		res.Result = initializeResult(req.Params, constances.FigmaLocalServer)
	case "tools/list":
		res.Result = map[string]any{"tools": figmaToolSchemas()}
	case "tools/call":
		res.Result = s.callFigmaTool(req.Params)
	default:
		res.Error = &rpcError{Code: -32601, Message: "unknown method " + req.Method}
	}

	writeRPC(w, res)
}

func (s *v1) callFigmaTool(params json.RawMessage) *toolResult {
	call := struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}{}

	if err := json.Unmarshal(params, &call); err != nil {
		return errorResult("cannot parse tool arguments: " + err.Error())
	}

	switch call.Name {
	case "figma_whoami":
		return s.figmaWhoami()
	case "figma_get_file":
		return s.figmaGetFile(call.Arguments)
	case "figma_get_nodes":
		return s.figmaGetNodes(call.Arguments)
	case "figma_get_images":
		return s.figmaGetImages(call.Arguments)
	case "figma_get_components":
		return s.figmaGetComponents(call.Arguments)
	case "figma_get_styles":
		return s.figmaGetStyles(call.Arguments)
	default:
		return errorResult("unknown tool " + call.Name)
	}
}

type figmaArgs struct {
	FileKey string  `json:"file_key"`
	IDs     string  `json:"ids"`
	Depth   *int    `json:"depth"`
	Format  string  `json:"format"`
	Scale   float64 `json:"scale"`
}

func parseFigmaArgs(arguments json.RawMessage) (*figmaArgs, *toolResult) {
	args := &figmaArgs{}
	if len(arguments) > 0 {
		if err := json.Unmarshal(arguments, args); err != nil {
			return nil, errorResult("cannot parse tool arguments: " + err.Error())
		}
	}

	return args, nil
}

func requireArg(name, value string) *toolResult {
	if strings.TrimSpace(value) == "" {
		return errorResult(name + " is required")
	}

	return nil
}

func (s *v1) figmaWhoami() *toolResult {
	return s.figmaGet("/v1/me", nil)
}

func (s *v1) figmaGetFile(arguments json.RawMessage) *toolResult {
	args, bad := parseFigmaArgs(arguments)
	if bad != nil {
		return bad
	}

	if bad := requireArg("file_key", args.FileKey); bad != nil {
		return bad
	}

	query := url.Values{}
	if args.Depth != nil {
		query.Set("depth", strconv.Itoa(*args.Depth))
	}
	if strings.TrimSpace(args.IDs) != "" {
		query.Set("ids", args.IDs)
	}

	return s.figmaGet("/v1/files/"+url.PathEscape(args.FileKey), query)
}

func (s *v1) figmaGetNodes(arguments json.RawMessage) *toolResult {
	args, bad := parseFigmaArgs(arguments)
	if bad != nil {
		return bad
	}

	if bad := requireArg("file_key", args.FileKey); bad != nil {
		return bad
	}

	if bad := requireArg("ids", args.IDs); bad != nil {
		return bad
	}

	query := url.Values{}
	query.Set("ids", args.IDs)

	return s.figmaGet("/v1/files/"+url.PathEscape(args.FileKey)+"/nodes", query)
}

func (s *v1) figmaGetImages(arguments json.RawMessage) *toolResult {
	args, bad := parseFigmaArgs(arguments)
	if bad != nil {
		return bad
	}

	if bad := requireArg("file_key", args.FileKey); bad != nil {
		return bad
	}

	if bad := requireArg("ids", args.IDs); bad != nil {
		return bad
	}

	format := strings.TrimSpace(args.Format)
	if format == "" {
		format = "png"
	}

	query := url.Values{}
	query.Set("ids", args.IDs)
	query.Set("format", format)
	if args.Scale > 0 {
		query.Set("scale", strconv.FormatFloat(args.Scale, 'f', -1, 64))
	}

	return s.figmaGet("/v1/images/"+url.PathEscape(args.FileKey), query)
}

func (s *v1) figmaGetComponents(arguments json.RawMessage) *toolResult {
	args, bad := parseFigmaArgs(arguments)
	if bad != nil {
		return bad
	}

	if bad := requireArg("file_key", args.FileKey); bad != nil {
		return bad
	}

	return s.figmaGet("/v1/files/"+url.PathEscape(args.FileKey)+"/components", nil)
}

func (s *v1) figmaGetStyles(arguments json.RawMessage) *toolResult {
	args, bad := parseFigmaArgs(arguments)
	if bad != nil {
		return bad
	}

	if bad := requireArg("file_key", args.FileKey); bad != nil {
		return bad
	}

	return s.figmaGet("/v1/files/"+url.PathEscape(args.FileKey)+"/styles", nil)
}

func (s *v1) figmaGet(path string, query url.Values) *toolResult {
	cred, err := s.credentials(constances.FigmaLocalServer)
	if err != nil {
		return errorResult(figmaNotConnected)
	}

	base := strings.TrimRight(s.cfg.SupportedServers[constances.FigmaLocalServer].URL, "/")
	full := base + path
	if len(query) > 0 {
		full += "?" + query.Encode()
	}

	req := &input_itf.HttpRequest{
		Method: http.MethodGet,
		URL:    full,
		Header: http.Header{
			"X-Figma-Token": {cred.token},
			"Accept":        {"application/json"},
		},
	}

	res, err := s.httpCli.Stream(req)
	if err != nil {
		return errorResult(fmt.Sprintf("figma request failed: %v", err))
	}
	defer res.Body.Close()

	timer := time.AfterFunc(figmaReadTimeout, func() { res.Body.Close() })
	body, readErr := io.ReadAll(io.LimitReader(res.Body, maxFigmaBody))
	if !timer.Stop() {
		return errorResult("figma request timed out")
	}
	if readErr != nil {
		return errorResult(fmt.Sprintf("figma read failed: %v", readErr))
	}

	if res.StatusCode >= 400 {
		return errorResult(fmt.Sprintf("figma api %d: %s", res.StatusCode, string(body)))
	}

	return &toolResult{Content: []toolContent{{Type: "text", Text: string(body)}}}
}

func figmaToolSchemas() []any {
	object := func(properties map[string]any, required []string) map[string]any {
		return map[string]any{
			"type":       "object",
			"properties": properties,
			"required":   required,
		}
	}

	stringProp := func(description string) map[string]any {
		return map[string]any{"type": "string", "description": description}
	}

	return []any{
		map[string]any{
			"name":        "figma_whoami",
			"description": "Return the Figma user the stored personal access token belongs to.",
			"inputSchema": object(map[string]any{}, []string{}),
		},
		map[string]any{
			"name":        "figma_get_file",
			"description": "Fetch the document tree of a Figma file by its file key.",
			"inputSchema": object(map[string]any{
				"file_key": stringProp("The Figma file key, taken from the file URL."),
				"depth":    map[string]any{"type": "integer", "description": "How many levels of the node tree to return."},
				"ids":      stringProp("Comma-separated node ids to limit the returned tree to."),
			}, []string{"file_key"}),
		},
		map[string]any{
			"name":        "figma_get_nodes",
			"description": "Fetch specific nodes from a Figma file by their ids.",
			"inputSchema": object(map[string]any{
				"file_key": stringProp("The Figma file key, taken from the file URL."),
				"ids":      stringProp("Comma-separated node ids to fetch."),
			}, []string{"file_key", "ids"}),
		},
		map[string]any{
			"name":        "figma_get_images",
			"description": "Render nodes of a Figma file to image URLs.",
			"inputSchema": object(map[string]any{
				"file_key": stringProp("The Figma file key, taken from the file URL."),
				"ids":      stringProp("Comma-separated node ids to render."),
				"format": map[string]any{
					"type":        "string",
					"enum":        []string{"png", "jpg", "svg", "pdf"},
					"description": "Image format to render, defaults to png.",
				},
				"scale": map[string]any{"type": "number", "description": "Render scale between 0.01 and 4."},
			}, []string{"file_key", "ids"}),
		},
		map[string]any{
			"name":        "figma_get_components",
			"description": "List the components published from a Figma file.",
			"inputSchema": object(map[string]any{
				"file_key": stringProp("The Figma file key, taken from the file URL."),
			}, []string{"file_key"}),
		},
		map[string]any{
			"name":        "figma_get_styles",
			"description": "List the styles published from a Figma file.",
			"inputSchema": object(map[string]any{
				"file_key": stringProp("The Figma file key, taken from the file URL."),
			}, []string{"file_key"}),
		},
	}
}
