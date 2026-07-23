package custom_error

import (
	"fmt"
	"hexago/internal/helpers/enums"
)

type severity struct {
	msg           string
	criticalLevel enums.CriticalLevel
}

type Severity interface {
	Error() string
	Critical() bool
}

func Critical(format string, args ...any) error {
	return &severity{
		msg:           fmt.Sprintf(format, args...),
		criticalLevel: enums.Critical,
	}
}

func Bypass(format string, args ...any) error {
	return &severity{
		msg:           fmt.Sprintf(format, args...),
		criticalLevel: enums.Bypass,
	}
}

func (s *severity) Error() string {
	return fmt.Sprintf("[Err] Message: %s - Critical: %s", s.msg, s.criticalLevel.String())
}

func (s *severity) Critical() bool {
	return s.criticalLevel == enums.Critical
}
