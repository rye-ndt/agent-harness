package task_manager

import (
	"testing"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/google/uuid"
)

type fakeWAL struct {
	records []*input_itf.TaskWALRecord
}

func (w *fakeWAL) Append(record *input_itf.TaskWALRecord) error {
	w.records = append(w.records, record)
	return nil
}

func (w *fakeWAL) Replay() ([]*input_itf.TaskWALRecord, error) { return nil, nil }
func (w *fakeWAL) Reset() error                                { return nil }
func (w *fakeWAL) Close() error                                { return nil }

type fakeLogger struct{}

func (l *fakeLogger) Debug(msg string, args ...any) {}
func (l *fakeLogger) Info(msg string, args ...any)  {}
func (l *fakeLogger) Warn(msg string, args ...any)  {}
func (l *fakeLogger) Error(msg string, args ...any) {}

func TestDropStaleAgent(t *testing.T) {
	wal := &fakeWAL{}

	manager, err := InitV1(V1Config{HeartbeatTimeout: 30 * time.Minute}, nil, wal, &fakeLogger{})
	if err != nil {
		t.Fatal(err)
	}
	defer manager.Stop()

	q := manager.(*v1)

	if err := q.Add(&output_itf.AddTask{Name: "stale", AgentRole: "dev"}); err != nil {
		t.Fatal(err)
	}

	var taskID uuid.UUID
	for id := range q.tasks {
		taskID = id
	}

	agentID := uuid.Must(uuid.NewV7())
	if err := q.Assign(agentID, taskID); err != nil {
		t.Fatal(err)
	}

	channelID, events := q.SubscribeTaskEvent(taskID)
	defer q.Unsubscribe(channelID)

	q.dropStaleAgents()
	if q.tasks[taskID].Status != enums.TaskProcessing {
		t.Fatal("task with fresh heartbeat was dropped")
	}

	q.agentsInCharge[taskID].LastHeartBeat = helpers.NewUTCUnix() - int64((31 * time.Minute).Seconds())

	q.dropStaleAgents()

	task, found := q.tasks[taskID]
	if !found {
		t.Fatal("dropped task was removed from the queue")
	}
	if task.Status != enums.TaskCancelled {
		t.Fatalf("dropped task status is %v, want cancelled", task.Status)
	}
	if _, found := q.agentsInCharge[taskID]; found {
		t.Fatal("agent still in charge after drop")
	}

	last := wal.records[len(wal.records)-1]
	if last.Kind != enums.EventTaskDropped || last.TaskID != taskID || last.AgentID != agentID {
		t.Fatalf("unexpected wal record: %+v", last)
	}

	select {
	case ev := <-events:
		if ev.Event != enums.EventTaskDropped || ev.Data.AgentID != agentID || ev.Data.Status != enums.TaskCancelled {
			t.Fatalf("unexpected event: %+v", ev)
		}
	default:
		t.Fatal("no task dropped event published")
	}

	otherAgent := uuid.Must(uuid.NewV7())
	if err := q.Assign(otherAgent, taskID); err != nil {
		t.Fatalf("orphaned task cannot be reassigned: %v", err)
	}
}
