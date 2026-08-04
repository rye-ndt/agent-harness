//go:build windows

package harness_helper

import (
	"os"
	"os/exec"

	"hexago/internal/helpers/custom_error"
)

func StartPty(cmd *exec.Cmd, cols, rows uint16) (*os.File, error) {
	return nil, custom_error.Critical("pty login is not supported on windows")
}
