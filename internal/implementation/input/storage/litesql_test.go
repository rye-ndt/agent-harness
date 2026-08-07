package storage

import (
	"path/filepath"
	"testing"
	"time"

	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

func TestTemplateRoundTripsManualAcceptRequired(t *testing.T) {
	path := filepath.Join(t.TempDir(), "harness.db")

	store, err := New(path)
	if err != nil {
		t.Fatalf("open storage: %v", err)
	}

	templates := store.TemplateStore()

	gated := &input_itf.TemplateEntity{
		ID:                   uuid.New(),
		Name:                 "planner",
		TaskLevel:            enums.HeavyTask,
		ManualAcceptRequired: true,
		SystemPrompts:        map[string]string{"base": "plan carefully"},
	}

	plain := &input_itf.TemplateEntity{
		ID:            uuid.New(),
		Name:          "implementer",
		TaskLevel:     enums.DailyTask,
		SystemPrompts: map[string]string{"base": "write code"},
	}

	for _, template := range []*input_itf.TemplateEntity{gated, plain} {
		if err := templates.Upsert(template); err != nil {
			t.Fatalf("upsert %s: %v", template.Name, err)
		}
	}

	found, err := templates.Find(gated.ID)
	if err != nil {
		t.Fatalf("find gated template: %v", err)
	}

	if !found.ManualAcceptRequired {
		t.Fatal("gated template lost manual_accept_required on the round trip")
	}

	found, err = templates.Find(plain.ID)
	if err != nil {
		t.Fatalf("find plain template: %v", err)
	}

	if found.ManualAcceptRequired {
		t.Fatal("plain template gained manual_accept_required on the round trip")
	}

	gated.ManualAcceptRequired = false
	if err := templates.Upsert(gated); err != nil {
		t.Fatalf("re-upsert gated template: %v", err)
	}

	found, err = templates.Find(gated.ID)
	if err != nil {
		t.Fatalf("re-find gated template: %v", err)
	}

	if found.ManualAcceptRequired {
		t.Fatal("clearing manual_accept_required did not persist")
	}

	listed, err := templates.List()
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}

	if len(listed) != 2 {
		t.Fatalf("listed %d templates, want 2", len(listed))
	}
}

func TestMigrationsAreIdempotentAcrossReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "harness.db")

	first, err := New(path)
	if err != nil {
		t.Fatalf("open storage: %v", err)
	}

	template := &input_itf.TemplateEntity{
		ID:                   uuid.New(),
		Name:                 "planner",
		TaskLevel:            enums.HeavyTask,
		ManualAcceptRequired: true,
		SystemPrompts:        map[string]string{"base": "plan carefully"},
	}

	if err := first.TemplateStore().Upsert(template); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	second, err := New(path)
	if err != nil {
		t.Fatalf("reopen storage: %v", err)
	}

	found, err := second.TemplateStore().Find(template.ID)
	if err != nil {
		t.Fatalf("find after reopen: %v", err)
	}

	if !found.ManualAcceptRequired {
		t.Fatal("manual_accept_required did not survive a reopen")
	}
}

func TestTaskRoundTripsManualAcceptRequired(t *testing.T) {
	path := filepath.Join(t.TempDir(), "harness.db")

	store, err := New(path)
	if err != nil {
		t.Fatalf("open storage: %v", err)
	}

	tasks := store.TaskStore()

	task := &input_itf.TaskEntity{
		ID:                   uuid.New(),
		SessionID:            uuid.New(),
		Name:                 "plan",
		PreferredModel:       enums.Sonnet,
		ManualAcceptRequired: true,
		Status:               enums.TaskAwaitingAccept,
	}

	if err := tasks.Create(task); err != nil {
		t.Fatalf("create task: %v", err)
	}

	found, err := tasks.Find(task.ID)
	if err != nil {
		t.Fatalf("find task: %v", err)
	}

	if !found.ManualAcceptRequired {
		t.Fatal("task lost manual_accept_required on the round trip")
	}

	if found.Status != enums.TaskAwaitingAccept {
		t.Fatalf("task status = %s, want %s", found.Status, enums.TaskAwaitingAccept)
	}
}

func TestMCPCredentialsRoundTripAccountAndDelete(t *testing.T) {
	path := filepath.Join(t.TempDir(), "harness.db")

	store, err := New(path)
	if err != nil {
		t.Fatalf("open storage: %v", err)
	}

	mcps := store.MCPStore()

	entity := &input_itf.MCPEntity{
		Name:              "atlassian",
		EncryptedOAuthKey: "cipher",
		Account:           "rye@nexo.dev",
		ExpiredAt:         time.Now().Add(time.Hour),
	}

	if err := mcps.UpsertCredentials(entity); err != nil {
		t.Fatalf("upsert credentials: %v", err)
	}

	found, err := mcps.GetCredentials(entity.Name)
	if err != nil {
		t.Fatalf("get credentials: %v", err)
	}

	if found.Account != entity.Account {
		t.Fatalf("account = %q, want %q", found.Account, entity.Account)
	}

	authenticated, err := mcps.ListAuthenticated()
	if err != nil {
		t.Fatalf("list authenticated: %v", err)
	}

	if len(authenticated) != 1 || authenticated[0].Account != entity.Account {
		t.Fatalf("list authenticated = %+v, want one row carrying the account", authenticated)
	}

	if err := mcps.DeleteCredentials(entity.Name); err != nil {
		t.Fatalf("delete credentials: %v", err)
	}

	gone, err := mcps.GetCredentials(entity.Name)
	if err != nil {
		t.Fatalf("get credentials after delete: %v", err)
	}

	if gone != nil {
		t.Fatalf("credentials survived the delete: %+v", gone)
	}

	if err := mcps.DeleteCredentials(entity.Name); err != nil {
		t.Fatalf("second delete should be a no-op, got: %v", err)
	}
}
