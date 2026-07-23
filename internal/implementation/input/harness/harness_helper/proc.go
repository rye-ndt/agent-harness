package harness_helper

import (
	"errors"
	"os"
	"os/exec"
)

func SignalProc(cmd *exec.Cmd) error {
	if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return err
	}
	return nil
}
