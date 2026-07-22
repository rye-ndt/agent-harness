package enums

type CriticalLevel string

const (
	Critical CriticalLevel = "critical"
	Bypass   CriticalLevel = "bypass"
)

func (c CriticalLevel) String() string {
	return string(c)
}
