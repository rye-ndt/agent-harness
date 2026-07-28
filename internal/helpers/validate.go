package helpers

import (
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

var configValidator = newConfigValidator()

const structTag = "mapstructure"

func newConfigValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())

	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		name := strings.Split(field.Tag.Get(structTag), ",")[0]

		if name == "" || name == "-" {
			return field.Name
		}

		return name
	})

	return v
}

func ValidateStruct(target any) error {
	return configValidator.Struct(target)
}
