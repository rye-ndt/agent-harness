package mcp_proxy

import (
	"encoding/json"
	"net/http"

	"hexago/internal/helpers/constances"
	"hexago/internal/helpers/enums"
	core_itf "hexago/internal/interface/core"

	"github.com/google/uuid"
)

const (
	approvalTool           = "request_approval"
	defaultProtocolVersion = "2025-06-18"
)

const approvalToolDescription = `Ask the human operator to approve a decision or grant a permission, then wait for their answer.
Call this instead of asking the user directly: you are running non-interactively and have no other way to reach them.
Use it when a choice would be expensive to undo, when you need a decision locked in before continuing, or when you need
permission the current task does not already grant. The call blocks until the operator answers.
The operator may approve, which returns the option they picked, or reject, which returns approved=false and no option.`

const (
	rejectedWithGuidance = "The operator rejected this and is sending their guidance as a separate message. " +
		"Wait for that message before continuing; do not act on the rejected approach."
	rejectedNoGuidance = "The operator rejected this and gave no guidance. " +
		"Do not retry the same approach; stop and report what is blocked."
)

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type toolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type toolResult struct {
	Content []toolContent `json:"content"`
	IsError bool          `json:"isError"`
}

type approvalArgs struct {
	Kind        string `json:"kind"`
	Question    string `json:"question"`
	Detail      string `json:"detail"`
	MultiSelect bool   `json:"multi_select"`
	Options     []struct {
		ID          string `json:"id"`
		Label       string `json:"label"`
		Description string `json:"description"`
	} `json:"options"`
}

func (s *v1) serveLocal(w http.ResponseWriter, r *http.Request) {
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
		res.Result = initializeResult(req.Params)
	case "tools/list":
		res.Result = map[string]any{"tools": []any{approvalToolSchema()}}
	case "tools/call":
		res.Result = s.callTool(req.Params, agentFromHeader(r))
	default:
		res.Error = &rpcError{Code: -32601, Message: "unknown method " + req.Method}
	}

	writeRPC(w, res)
}

func initializeResult(params json.RawMessage) map[string]any {
	requested := struct {
		ProtocolVersion string `json:"protocolVersion"`
	}{}

	protocol := defaultProtocolVersion
	if err := json.Unmarshal(params, &requested); err == nil && requested.ProtocolVersion != "" {
		protocol = requested.ProtocolVersion
	}

	return map[string]any{
		"protocolVersion": protocol,
		"capabilities":    map[string]any{"tools": map[string]any{}},
		"serverInfo": map[string]any{
			"name":    constances.GatewayLocalServer,
			"version": "1",
		},
	}
}

func approvalToolSchema() map[string]any {
	return map[string]any{
		"name":        approvalTool,
		"description": approvalToolDescription,
		"inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"question": map[string]any{
					"type":        "string",
					"description": "The decision to be made, phrased as a question the operator can answer.",
				},
				"kind": map[string]any{
					"type":        "string",
					"enum":        []string{enums.ApproveDecision.String(), enums.ApprovePermission.String()},
					"description": "decision to lock a choice in, permission to be allowed to do something.",
				},
				"detail": map[string]any{
					"type":        "string",
					"description": "Context the operator needs: what you found, what each option costs.",
				},
				"options": map[string]any{
					"type":        "array",
					"minItems":    1,
					"description": "The choices available. Put your recommendation first.",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"id":          map[string]any{"type": "string"},
							"label":       map[string]any{"type": "string"},
							"description": map[string]any{"type": "string"},
						},
						"required": []string{"id", "label"},
					},
				},
				"multi_select": map[string]any{
					"type":        "boolean",
					"description": "Whether the operator may pick more than one option.",
				},
			},
			"required": []string{"question", "options"},
		},
	}
}

func (s *v1) callTool(params json.RawMessage, agentID uuid.UUID) *toolResult {
	call := struct {
		Name      string       `json:"name"`
		Arguments approvalArgs `json:"arguments"`
	}{}

	if err := json.Unmarshal(params, &call); err != nil {
		return errorResult("cannot parse tool arguments: " + err.Error())
	}

	if call.Name != approvalTool {
		return errorResult("unknown tool " + call.Name)
	}

	args := call.Arguments

	request := &core_itf.ApprovalRequest{
		AgentID:     agentID,
		Kind:        enums.ApprovalKind(args.Kind),
		Question:    args.Question,
		Detail:      args.Detail,
		MultiSelect: args.MultiSelect,
		Options:     make([]*core_itf.ApprovalOption, 0, len(args.Options)),
	}

	for _, option := range args.Options {
		request.Options = append(request.Options, &core_itf.ApprovalOption{
			ID:          option.ID,
			Label:       option.Label,
			Description: option.Description,
		})
	}

	answer, err := s.approvalBroker.Request(request)
	if err != nil {
		return errorResult(err.Error())
	}

	return answerResult(request, answer)
}

func answerResult(request *core_itf.ApprovalRequest, answer *core_itf.ApprovalAnswer) *toolResult {
	type selected struct {
		ID    string `json:"id"`
		Label string `json:"label"`
	}

	picked := []selected{}

	for _, id := range answer.OptionIDs {
		for _, option := range request.Options {
			if option.ID == id {
				picked = append(picked, selected{ID: option.ID, Label: option.Label})
				break
			}
		}
	}

	payload := map[string]any{
		"approved": answer.Approved,
		"selected": picked,
	}

	switch {
	case answer.Approved:
		payload["guidance"] = answer.Guidance
	case answer.Guidance != "":
		payload["note"] = rejectedWithGuidance
	default:
		payload["note"] = rejectedNoGuidance
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return errorResult("cannot encode the operator's answer: " + err.Error())
	}

	return &toolResult{Content: []toolContent{{Type: "text", Text: string(raw)}}}
}

func errorResult(message string) *toolResult {
	return &toolResult{
		Content: []toolContent{{Type: "text", Text: message}},
		IsError: true,
	}
}

func agentFromHeader(r *http.Request) uuid.UUID {
	parsed, err := uuid.Parse(r.Header.Get(constances.GatewayAgentHeader))
	if err != nil {
		return uuid.Nil
	}

	return parsed
}

func writeRPC(w http.ResponseWriter, res *rpcResponse) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
