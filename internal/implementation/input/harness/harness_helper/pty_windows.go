//go:build windows

package harness_helper

import (
	"errors"
	"os"
	"os/exec"
)

func StartPty(cmd *exec.Cmd, cols, rows uint16) (*os.File, error) {
	return nil, errors.New("pty login is not supported on windows")
}
