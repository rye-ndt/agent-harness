package helpers

import "time"

func NewUTC() time.Time {
	return time.Now().UTC()
}

func NewUTCUnix() int64 {
	return time.Now().UTC().Unix()
}
