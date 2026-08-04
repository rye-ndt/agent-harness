package harness_helper

import (
	mapstructure "github.com/go-viper/mapstructure/v2"

	"hexago/internal/helpers"
	"hexago/internal/helpers/custom_error"
)

func DecodeCfg[T any](raw map[string]any) (*T, error) {
	out := new(T)

	dec, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		DecodeHook: mapstructure.StringToTimeDurationHookFunc(),
		Result:     out,
	})
	if err != nil {
		return nil, err
	}

	if err := dec.Decode(raw); err != nil {
		return nil, err
	}

	if err := helpers.ValidateStruct(out); err != nil {
		return nil, custom_error.Critical("invalid agent harness config: %v", err)
	}

	return out, nil
}
