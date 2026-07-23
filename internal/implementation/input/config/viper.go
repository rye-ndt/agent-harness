package viper

import (
	lib "github.com/spf13/viper"

	input_itf "hexago/internal/interface/input"
)

type viper struct {
	v *lib.Viper
}

func New(path string) (input_itf.Config, error) {
	v := lib.New()
	v.SetConfigFile(path)
	if err := v.ReadInConfig(); err != nil {
		return nil, err
	}
	return &viper{v: v}, nil
}

func (c *viper) Read() *input_itf.ConfigStruct {
	var cfg input_itf.ConfigStruct
	if err := c.v.Unmarshal(&cfg); err != nil {
		return nil
	}
	return &cfg
}
