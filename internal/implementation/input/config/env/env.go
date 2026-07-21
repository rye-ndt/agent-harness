package env

import (
	"os"
	"strconv"

	input_itf "hexago/internal/interface/input"
)

type env struct{}

func New() input_itf.Config {
	return env{}
}

func (env) Read() *input_itf.ConfigStruct {
	w, _ := strconv.Atoi(os.Getenv("APP_W"))
	h, _ := strconv.Atoi(os.Getenv("APP_H"))
	return &input_itf.ConfigStruct{
		App: &input_itf.AppConfig{
			Name: os.Getenv("APP_NAME"),
			W:    w,
			H:    h,
			Bg:   os.Getenv("APP_BG"),
		},
		Version:  os.Getenv("VERSION"),
		LogLevel: os.Getenv("LOG_LEVEL"),
	}
}
