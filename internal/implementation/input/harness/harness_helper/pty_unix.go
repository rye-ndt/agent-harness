//go:build !windows

package harness_helper

import (
	"os"
	"os/exec"

	"github.com/creack/pty"
)

func StartPty(cmd *exec.Cmd, cols, rows uint16) (*os.File, error) {
	return pty.StartWithSize(cmd, &pty.Winsize{Rows: rows, Cols: cols})
}
