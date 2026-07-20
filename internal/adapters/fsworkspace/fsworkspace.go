package fsworkspace

import (
	"os"
	"path/filepath"
)

type Workspace struct {
	root string
}

func New(runsDir, taskID string) (*Workspace, error) {
	root, err := filepath.Abs(filepath.Join(runsDir, taskID))
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	return &Workspace{root: root}, nil
}

func (w *Workspace) Root() string { return w.root }

func (w *Workspace) EnsureLayout() error {
	for _, dir := range []string{"context", "plans", "reports", "recordings"} {
		if err := os.MkdirAll(filepath.Join(w.root, dir), 0o755); err != nil {
			return err
		}
	}
	return nil
}

func (w *Workspace) ArtifactExists(rel string) bool {
	info, err := os.Stat(filepath.Join(w.root, rel))
	return err == nil && !info.IsDir()
}
