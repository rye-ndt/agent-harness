package viper

import (
	lib "github.com/spf13/viper"

	"hexago/internal/helpers"
	"hexago/internal/implementation/core/custom_error"
	input_itf "hexago/internal/interface/input"
)

type viper struct {
	cfg *input_itf.ConfigStruct
}

func New(path string) (input_itf.Config, error) {
	v := lib.New()
	v.SetConfigFile(path)

	if err := v.ReadInConfig(); err != nil {
		return nil, err
	}

	cfg := &input_itf.ConfigStruct{}

	if err := v.Unmarshal(cfg); err != nil {
		return nil, custom_error.Critical("cannot decode %s: %v", path, err)
	}

	if err := helpers.ValidateStruct(cfg); err != nil {
		return nil, custom_error.Critical("invalid %s: %v", path, err)
	}

	return &viper{cfg: cfg}, nil
}

func (c *viper) Read() *input_itf.ConfigStruct {
	return c.cfg
}
