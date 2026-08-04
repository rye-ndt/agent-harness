package mcp_proxy

import (
	"context"
	"crypto/subtle"
	"io"
	"net"
	"net/http"
	"strings"

	"hexago/internal/helpers/constances"
	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
	core_itf "hexago/internal/interface/core"

	"github.com/google/uuid"
)

const (
	gatewayPath        = "/mcp/"
	gatewayTokenHeader = "X-Harness-Gateway-Token"
)

func (s *v1) Serve() (*core_itf.MCPGateway, error) {
	s.locker.Lock()
	defer s.locker.Unlock()

	if s.gateway != nil {
		return s.gateway, nil
	}

	uid, err := uuid.NewV7()
	if err != nil {
		return nil, custom_error.Critical("%v", err)
	}

	ln, err := net.Listen("tcp", net.JoinHostPort(constances.GlobalLocalHost, "0"))
	if err != nil {
		return nil, custom_error.Critical("cannot start mcp gateway listener: %v", err)
	}

	servers := []core_itf.MCPGatewayServer{{Name: constances.GatewayLocalServer}}

	for _, m := range s.cfg.SupportedServers {
		servers = append(servers, core_itf.MCPGatewayServer{
			Name:        m.Name,
			AuthKeyName: m.AuthKeyName,
		})
	}

	mux := http.NewServeMux()
	mux.HandleFunc(gatewayPath, s.forward)
	mux.HandleFunc(gatewayPath+constances.GatewayLocalServer, s.serveLocal)

	s.gateway = &core_itf.MCPGateway{
		BaseURL:     "http://" + ln.Addr().String(),
		Token:       uid.String(),
		TokenHeader: gatewayTokenHeader,
		Servers:     servers,
	}

	s.gatewayHttpServer = &http.Server{Handler: s.authenticated(mux)}

	go s.gatewayHttpServer.Serve(ln)

	return s.gateway, nil
}

func (s *v1) Close() error {
	s.locker.Lock()
	srv := s.gatewayHttpServer
	s.gatewayHttpServer = nil
	s.gateway = nil
	s.locker.Unlock()

	if srv == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownGrace)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		return custom_error.Critical("cannot stop mcp gateway: %v", err)
	}

	return nil
}

func (s *v1) authenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.locker.RLock()
		gateway := s.gateway
		s.locker.RUnlock()

		if gateway == nil {
			http.Error(w, "mcp gateway is not running", http.StatusServiceUnavailable)
			return
		}

		presented := r.Header.Get(gatewayTokenHeader)
		if subtle.ConstantTimeCompare([]byte(presented), []byte(gateway.Token)) != 1 {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		r.Header.Del(gatewayTokenHeader)

		next.ServeHTTP(w, r)
	})
}

func (s *v1) forward(w http.ResponseWriter, r *http.Request) {
	name := strings.Trim(strings.TrimPrefix(r.URL.Path, gatewayPath), "/")
	if name == "" {
		http.Error(w, "mcp server not specified", http.StatusNotFound)
		return
	}

	r.Header.Del(constances.GatewayAgentHeader)

	res, err := s.Request(name, r.Header, r.Body)
	if err != nil {
		http.Error(w, err.Error(), gatewayStatus(err))
		return
	}
	defer res.Body.Close()

	for key, values := range res.Header {
		switch strings.ToLower(key) {
		case "content-length", "transfer-encoding", "www-authenticate":
			continue
		}

		for _, v := range values {
			w.Header().Add(key, v)
		}
	}

	status := res.StatusCode
	if status == http.StatusUnauthorized {
		status = http.StatusBadGateway
	}

	w.WriteHeader(status)

	stream(w, res.Body)
}

func gatewayStatus(err error) int {
	typed, ok := err.(custom_error.Severity)
	if !ok {
		return http.StatusBadGateway
	}

	switch typed.Type() {
	case enums.ErrMcpNotFound:
		return http.StatusNotFound
	case enums.ErrMcpForbiddenRequest:
		return http.StatusForbidden
	case enums.ErrMcpNotAuthenticated, enums.ErrMcpCredentialsExpired:
		return http.StatusBadGateway
	default:
		return http.StatusBadGateway
	}
}

func stream(w http.ResponseWriter, body io.Reader) {
	flusher, flushable := w.(http.Flusher)

	buf := make([]byte, 4096)

	for {
		n, readErr := body.Read(buf)

		if n > 0 {
			if _, err := w.Write(buf[:n]); err != nil {
				return
			}

			if flushable {
				flusher.Flush()
			}
		}

		if readErr != nil {
			return
		}
	}
}
