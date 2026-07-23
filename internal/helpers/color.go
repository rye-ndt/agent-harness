package helpers

import (
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options"
)

func HexColour(s string) *options.RGBA {
	s = strings.TrimPrefix(s, "#")
	v, err := strconv.ParseUint(s, 16, 32)
	if err != nil || len(s) != 6 {
		return &options.RGBA{R: 27, G: 38, B: 54, A: 255}
	}
	return &options.RGBA{R: uint8(v >> 16), G: uint8(v >> 8), B: uint8(v), A: 255}
}
