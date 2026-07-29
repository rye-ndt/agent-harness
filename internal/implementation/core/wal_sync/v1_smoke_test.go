package wal_sync

import (
	"os"
	"path/filepath"
	"testing"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/input/storage"
	"hexago/internal/implementation/input/wal"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

func TestSyncSmoke(t *testing.T) {
	dir := t.TempDir()
	walPath := filepath.Join(dir, "task.wal")

	w, err := wal.New(walPath)
	if err != nil {
		t.Fatal(err)
	}

	sessionID := uuid.Must(uuid.NewV7())
	taskID := uuid.Must(uuid.NewV7())
	agentID := uuid.Must(uuid.NewV7())
	reportID := uuid.Must(uuid.NewV7())

	session := &input_itf.SessionEntity{ID: sessionID, CreatedAt: helpers.NewUTC(), UpdatedAt: helpers.NewUTC()}
	task := &input_itf.TaskEntity{
		ID: taskID, SessionID: sessionID, Name: "smoke", AgentRole: "dev",
		AllowedFilePaths: []string{"a.go"}, TemplateFilePaths: []string{},
		Status: enums.TaskNotTaken, CreatedAt: helpers.NewUTC(), UpdatedAt: helpers.NewUTC(),
	}

	if err := w.Append(&input_itf.TaskWALRecord{Kind: enums.SessionCreated, Session: session}); err != nil {
		t.Fatal(err)
	}
	if err := w.Append(&input_itf.TaskWALRecord{Kind: enums.SessionTaskCreated, Task: task, Session: session}); err != nil {
		t.Fatal(err)
	}
	if err := w.Append(&input_itf.TaskWALRecord{
		Kind: enums.SessionTaskStatusChanged, TaskID: taskID, AgentID: agentID, Status: enums.TaskProcessing,
	}); err != nil {
		t.Fatal(err)
	}

	done := *task
	done.Status = enums.TaskCompleted
	done.LastReportID = reportID

	report := &input_itf.TaskReportEntity{
		ID: reportID, TaskID: taskID, AgentID: agentID, AttemptStatus: enums.TaskCompleted,
		HandoverDocs: []*input_itf.HandoverDocEntity{{Task: "smoke", Outcome: "ok"}},
		CreatedAt:    helpers.NewUTC(), UpdatedAt: helpers.NewUTC(),
	}
	fc := &input_itf.FileChangeEntity{
		ID: uuid.Must(uuid.NewV7()), ReportID: reportID, Path: "a.go",
		ChangeType: enums.FileModified, Additions: 1,
	}

	if err := w.Append(&input_itf.TaskWALRecord{
		Kind: enums.SessionTaskReported, TaskID: taskID, AgentID: agentID,
		Status: enums.TaskCompleted, Task: &done, Report: report,
		FileChanges: []*input_itf.FileChangeEntity{fc}, Session: session,
	}); err != nil {
		t.Fatal(err)
	}

	store, err := storage.New(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	taskStore := store.TaskStore()

	if err := Run(w, taskStore); err != nil {
		t.Fatalf("clean sync returned error: %v", err)
	}

	got, err := taskStore.Find(taskID)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatal("task not found in db after sync")
	}
	if got.Status != enums.TaskCompleted || got.Name != "smoke" || got.LastReportID != reportID {
		t.Fatalf("unexpected task after sync: %+v", got)
	}

	lastReport := taskStore.FindLastImplementRecord(taskID)
	if lastReport == nil || lastReport.ID != reportID || len(lastReport.HandoverDocs) != 1 ||
		lastReport.HandoverDocs[0].Outcome != "ok" {
		t.Fatalf("unexpected report after sync: %+v", lastReport)
	}

	info, err := os.Stat(walPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != 0 {
		t.Fatalf("wal not cleared, size %d", info.Size())
	}

	if err := Run(w, taskStore); err != nil {
		t.Fatalf("empty wal sync returned error: %v", err)
	}

	if err := w.Append(&input_itf.TaskWALRecord{Kind: enums.SessionCreated, Session: session}); err != nil {
		t.Fatal(err)
	}
	f, err := os.OpenFile(walPath, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString("{garbage!!\n"); err != nil {
		t.Fatal(err)
	}
	f.Close()

	err = Run(w, taskStore)
	if err == nil {
		t.Fatal("corrupt wal sync returned no error")
	}

	info, err = os.Stat(walPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != 0 {
		t.Fatalf("corrupt wal not cleared, size %d", info.Size())
	}
}
