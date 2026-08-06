package session_manager

import (
	"sync"
	"testing"
	"time"

	"hexago/internal/helpers/enums"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/google/uuid"
)

type fakeWAL struct {
	mu      sync.Mutex
	records []*input_itf.TaskWALRecord
}

func (w *fakeWAL) Append(record *input_itf.TaskWALRecord) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.records = append(w.records, record)

	return nil
}

func (w *fakeWAL) Replay() ([]*input_itf.TaskWALRecord, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	return w.records, nil
}

func (w *fakeWAL) Reset() error { return nil }

func (w *fakeWAL) Close() error { return nil }

func (w *fakeWAL) lastStatusFor(taskID uuid.UUID) enums.TaskStatus {
	w.mu.Lock()
	defer w.mu.Unlock()

	status := enums.TaskStatus("")

	for _, record := range w.records {
		if record.TaskID == taskID {
			status = record.Status
		}
	}

	return status
}

type fakeMQ struct{}

func (fakeMQ) Emit(uuid.UUID, output_itf.MQEvent, any) error { return nil }

func (fakeMQ) Subscribe(uuid.UUID, output_itf.MQEvent) (<-chan any, error) {
	return make(chan any), nil
}

func (fakeMQ) Unsubscribe(uuid.UUID, output_itf.MQEvent) (<-chan any, error) {
	return nil, nil
}

func newManager(t *testing.T) (core_itf.SessionManager, *fakeWAL) {
	t.Helper()

	w := &fakeWAL{}

	manager, err := InitV1(&input_itf.SessionConfig{
		HeartbeatTimeout:       30 * time.Minute,
		HeartbeatScanInterval:  time.Minute,
		AgentHeartbeatInterval: time.Minute,
	}, w, fakeMQ{})
	if err != nil {
		t.Fatalf("init session manager: %v", err)
	}

	t.Cleanup(manager.Stop)

	return manager, w
}

func addTask(t *testing.T, manager core_itf.SessionManager, session uuid.UUID, name string, gated bool, deps ...uuid.UUID) uuid.UUID {
	t.Helper()

	taskID, err := manager.AddTask(session, &core_itf.AddTask{
		Name:                 name,
		ManualAcceptRequired: gated,
		DependsOn:            deps,
		AgentSpecs:           &core_itf.AgentRequest{Name: enums.Sonnet},
	})
	if err != nil {
		t.Fatalf("add task %s: %v", name, err)
	}

	return taskID
}

func statusOf(t *testing.T, manager core_itf.SessionManager, session, taskID uuid.UUID) enums.TaskStatus {
	t.Helper()

	status, err := manager.Status(session)
	if err != nil {
		t.Fatalf("session status: %v", err)
	}

	report, found := status.Tasks[taskID]
	if !found {
		t.Fatalf("task %v missing from session status", taskID)
	}

	return report.Status
}

func readyIDs(t *testing.T, manager core_itf.SessionManager, session uuid.UUID) map[uuid.UUID]bool {
	t.Helper()

	specs, err := manager.ReadyTasks(session)
	if err != nil {
		t.Fatalf("ready tasks: %v", err)
	}

	ids := map[uuid.UUID]bool{}
	for _, spec := range specs {
		ids[spec.TaskID] = true
	}

	return ids
}

func newSession(t *testing.T, manager core_itf.SessionManager) uuid.UUID {
	t.Helper()

	session, err := manager.NewSession(&core_itf.InitSession{WorkingDirPath: t.TempDir()})
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	return session
}

func reportDone(t *testing.T, manager core_itf.SessionManager, taskID, agentID uuid.UUID) {
	t.Helper()

	if err := manager.Assign(taskID, agentID); err != nil {
		t.Fatalf("assign: %v", err)
	}

	if err := manager.Report(agentID, enums.TaskCompleted, []*core_itf.HandoverDoc{{
		Task:    "gated",
		Outcome: "briefing",
	}}); err != nil {
		t.Fatalf("report: %v", err)
	}
}

func TestGatedTaskHoldsDownstreamUntilAccepted(t *testing.T) {
	manager, w := newManager(t)
	session := newSession(t, manager)

	gate := addTask(t, manager, session, "plan", true)
	downstream := addTask(t, manager, session, "implement", false, gate)

	agentID := uuid.New()
	reportDone(t, manager, gate, agentID)

	if got := statusOf(t, manager, session, gate); got != enums.TaskAwaitingAccept {
		t.Fatalf("gated task status = %s, want %s", got, enums.TaskAwaitingAccept)
	}

	if got := w.lastStatusFor(gate); got != enums.TaskAwaitingAccept {
		t.Fatalf("wal status = %s, want %s", got, enums.TaskAwaitingAccept)
	}

	if ready := readyIDs(t, manager, session); ready[downstream] {
		t.Fatal("downstream task became ready while the gate was open")
	}

	if err := manager.AnswerAcceptance(gate, true); err != nil {
		t.Fatalf("accept: %v", err)
	}

	if got := statusOf(t, manager, session, gate); got != enums.TaskCompleted {
		t.Fatalf("accepted task status = %s, want %s", got, enums.TaskCompleted)
	}

	if ready := readyIDs(t, manager, session); !ready[downstream] {
		t.Fatal("downstream task did not become ready after acceptance")
	}
}

func TestRejectingGatedTaskFailsItAndKeepsDownstreamBlocked(t *testing.T) {
	manager, _ := newManager(t)
	session := newSession(t, manager)

	gate := addTask(t, manager, session, "plan", true)
	downstream := addTask(t, manager, session, "implement", false, gate)

	reportDone(t, manager, gate, uuid.New())

	if err := manager.AnswerAcceptance(gate, false); err != nil {
		t.Fatalf("reject: %v", err)
	}

	if got := statusOf(t, manager, session, gate); got != enums.TaskFailed {
		t.Fatalf("rejected task status = %s, want %s", got, enums.TaskFailed)
	}

	if ready := readyIDs(t, manager, session); ready[downstream] {
		t.Fatal("downstream task became ready after a rejection")
	}
}

func TestUngatedTaskCompletesWithoutAGate(t *testing.T) {
	manager, _ := newManager(t)
	session := newSession(t, manager)

	task := addTask(t, manager, session, "implement", false)
	reportDone(t, manager, task, uuid.New())

	if got := statusOf(t, manager, session, task); got != enums.TaskCompleted {
		t.Fatalf("ungated task status = %s, want %s", got, enums.TaskCompleted)
	}
}

func TestGatedFailureIsNotHeld(t *testing.T) {
	manager, _ := newManager(t)
	session := newSession(t, manager)

	task := addTask(t, manager, session, "plan", true)
	agentID := uuid.New()

	if err := manager.Assign(task, agentID); err != nil {
		t.Fatalf("assign: %v", err)
	}

	if err := manager.Report(agentID, enums.TaskFailed, []*core_itf.HandoverDoc{{
		Task:    "plan",
		Outcome: "blocked",
	}}); err != nil {
		t.Fatalf("report: %v", err)
	}

	if got := statusOf(t, manager, session, task); got != enums.TaskFailed {
		t.Fatalf("failed gated task status = %s, want %s", got, enums.TaskFailed)
	}
}

func TestAnswerAcceptanceRejectsTaskThatIsNotAwaiting(t *testing.T) {
	manager, _ := newManager(t)
	session := newSession(t, manager)

	task := addTask(t, manager, session, "implement", false)

	if err := manager.AnswerAcceptance(task, true); err == nil {
		t.Fatal("accepting a task that is not awaiting acceptance should fail")
	}

	if err := manager.AnswerAcceptance(uuid.New(), true); err == nil {
		t.Fatal("accepting an unknown task should fail")
	}
}

func TestGatedCompletionDoesNotCountAsRetry(t *testing.T) {
	manager, _ := newManager(t)
	session := newSession(t, manager)

	task := addTask(t, manager, session, "plan", true)
	reportDone(t, manager, task, uuid.New())

	specs, err := manager.ReadyTasks(session)
	if err != nil {
		t.Fatalf("ready tasks: %v", err)
	}

	for _, spec := range specs {
		if spec.TaskID == task {
			t.Fatal("a gated task must not be schedulable while awaiting acceptance")
		}
	}

	if err := manager.AnswerAcceptance(task, true); err != nil {
		t.Fatalf("accept: %v", err)
	}

	status, err := manager.Status(session)
	if err != nil {
		t.Fatalf("session status: %v", err)
	}

	if status.Status != enums.SessionCompleted {
		t.Fatalf("session status = %s, want %s", status.Status, enums.SessionCompleted)
	}
}

func TestCancelClearsAnOpenGate(t *testing.T) {
	manager, _ := newManager(t)
	session := newSession(t, manager)

	task := addTask(t, manager, session, "plan", true)
	reportDone(t, manager, task, uuid.New())

	if _, err := manager.Cancel(session); err != nil {
		t.Fatalf("cancel: %v", err)
	}

	if got := statusOf(t, manager, session, task); got != enums.TaskCancelled {
		t.Fatalf("gated task status after cancel = %s, want %s", got, enums.TaskCancelled)
	}

	status, err := manager.Status(session)
	if err != nil {
		t.Fatalf("session status: %v", err)
	}

	if status.Status != enums.SessionCompleted {
		t.Fatalf("cancelled session did not drain, status = %s", status.Status)
	}
}
