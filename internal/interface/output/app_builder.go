package output_itf

import "io/fs"

type AppBuilderOption struct {
	Title            string
	Width            int
	Height           int
	Assets           fs.FS
	BackgroundColour string
	Bind             []any
}

type AppBuilder interface {
	Run(options *AppBuilderOption) error
}
