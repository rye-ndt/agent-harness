//go:build windows

package harness_helper

import (
	"errors"
	"os"
	"os/exec"
)

func SetProcAttrs(cmd *exec.Cmd) {}

func KillProc(cmd *exec.Cmd) error {
	if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return err
	}
	return nil
}
