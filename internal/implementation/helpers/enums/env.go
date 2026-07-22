package enums

type OS string

const (
	Windows OS = "windows"
	Mac     OS = "darwin"
	Linux   OS = "linux"
)

func (os OS) String() string {
	return string(os)
}
