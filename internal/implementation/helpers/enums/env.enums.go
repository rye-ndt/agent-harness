package enums

type OS string

const (
	Windows OS = "windows"
	Mac     OS = "mac"
	Linux   OS = "linux"
)

func (os OS) String() string {
	return string(os)
}
