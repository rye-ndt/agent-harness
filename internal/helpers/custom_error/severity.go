package custom_error

import (
	"fmt"
	"hexago/internal/helpers/enums"
)

type severity struct {
	msg           string
	errType       enums.ErrorType
	criticalLevel enums.Severity
}

type Severity interface {
	Error() string
	Critical() bool
	Type() enums.ErrorType
}

func TypedCritical(t enums.ErrorType, format string, args ...any) error {
	return &severity{
		msg:           fmt.Sprintf(format, args...),
		errType:       t,
		criticalLevel: enums.Critical,
	}
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
	if s.errType == "" {
		return fmt.Sprintf("[Err] Message: %s - Critical: %s", s.msg, s.criticalLevel.String())
	}

	return fmt.Sprintf("[Err] Type: %s - Message: %s - Critical: %s", s.errType, s.msg, s.criticalLevel.String())
}

func (s *severity) Critical() bool {
	return s.criticalLevel == enums.Critical
}

func (s *severity) Type() enums.ErrorType {
	return s.errType
}
