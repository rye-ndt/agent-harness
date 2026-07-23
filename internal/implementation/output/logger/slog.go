package slogger

import (
	"log/slog"
	"os"

	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"
)

type slogger struct {
	l *slog.Logger
}

func New(cfg input_itf.Config) output_itf.Logger {
	c := cfg.Read()
	var level slog.Level
	if err := level.UnmarshalText([]byte(c.LogLevel)); err != nil {
		level = slog.LevelInfo
	}
	h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	return &slogger{l: slog.New(h).With("app", c.App.Name, "version", c.Version)}
}

func (s *slogger) Debug(msg string, args ...any) { s.l.Debug(msg, args...) }
func (s *slogger) Info(msg string, args ...any)  { s.l.Info(msg, args...) }
func (s *slogger) Warn(msg string, args ...any)  { s.l.Warn(msg, args...) }
func (s *slogger) Error(msg string, args ...any) { s.l.Error(msg, args...) }
