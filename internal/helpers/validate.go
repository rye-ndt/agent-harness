package helpers

import (
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
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

	v.RegisterValidation("model_name", func(fl validator.FieldLevel) bool {
		return enums.ModelName(fl.Field().String()).Valid()
	})

	v.RegisterValidation("task_level", func(fl validator.FieldLevel) bool {
		return enums.TaskLevel(fl.Field().String()).Valid()
	})

	v.RegisterValidation("thinking_level", func(fl validator.FieldLevel) bool {
		return enums.ThinkingLevel(fl.Field().String()).Valid()
	})

	return v
}

func ValidateStruct(target any) error {
	if target == nil {
		return custom_error.Critical("config nil")
	}

	return configValidator.Struct(target)
}
