package enums

type Severity string

const (
	Critical Severity = "critical"
	Bypass   Severity = "bypass"
)

func (c Severity) String() string {
	return string(c)
}
