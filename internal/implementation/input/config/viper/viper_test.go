package viper

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadUnmarshalsYaml(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	yaml := `app:
  name: testapp
  w: 640
  h: 480
  bg: "#112233"
version: 1.2.3
log_level: debug
`
	if err := os.WriteFile(path, []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg, err := New(path)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	c := cfg.Read()
	if c == nil || c.App == nil {
		t.Fatal("Read returned nil")
	}
	if c.App.Name != "testapp" || c.App.W != 640 || c.App.H != 480 || c.App.Bg != "#112233" {
		t.Fatalf("unexpected app config: %+v", c.App)
	}
	if c.Version != "1.2.3" || c.LogLevel != "debug" {
		t.Fatalf("unexpected config: %+v", c)
	}
}
