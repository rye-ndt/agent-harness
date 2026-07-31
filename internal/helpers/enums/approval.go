package enums

type ApprovalKind string

const (
	ApproveDecision   ApprovalKind = "decision"
	ApprovePermission ApprovalKind = "permission"
)

func (k ApprovalKind) Valid() bool {
	switch k {
	case ApproveDecision, ApprovePermission:
		return true
	default:
		return false
	}
}

func (k ApprovalKind) String() string {
	return string(k)
}
