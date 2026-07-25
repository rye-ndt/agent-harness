package task_manager

import (
	"sync"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/google/uuid"
)

const eventBufferSize = 16

type AgentHandle struct {
	AgentID       uuid.UUID
	LastHeartBeat int64
}

type taskChannel struct {
	taskID uuid.UUID
	events chan *output_itf.TaskEvent
}

type queueChannel struct {
	queueID uuid.UUID
	events  chan *output_itf.QueueEvent
}

type V1Config struct {
	PollTimeout time.Duration
}

type v1 struct {
	locker         sync.Mutex
	info           *input_itf.QueueEntity
	pollTimeout    time.Duration
	wal            input_itf.TaskWAL
	logger         output_itf.Logger
	tasks          map[uuid.UUID]*input_itf.TaskEntity
	agentsInCharge map[uuid.UUID]*AgentHandle
	taskChannels   map[uuid.UUID]*taskChannel
	queueChannels  map[uuid.UUID]*queueChannel
}

func InitV1(
	cfg V1Config,
	db input_itf.TaskStorage,
	wal input_itf.TaskWAL,
	logger output_itf.Logger,
) (output_itf.TaskManager, error) {
	uid, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}

	info := &input_itf.QueueEntity{
		ID:          uid,
		StartedAt:   time.Time{}, // 0
		CompletedAt: time.Time{},
		TotalTask:   0,
		TotalRetry:  0,
		RevertCount: 0,
		CreatedAt:   helpers.NewUTC(),
		UpdatedAt:   helpers.NewUTC(),
	}

	if err = wal.Append(&input_itf.TaskWALRecord{
		Kind:  enums.EventQueueCreated,
		Queue: info,
	}); err != nil {
		return nil, custom_error.Critical("cannot append queue info to wal: %v", err)
	}

	return &v1{
		locker:         sync.Mutex{},
		pollTimeout:    cfg.PollTimeout,
		wal:            wal,
		logger:         logger,
		info:           info,
		tasks:          map[uuid.UUID]*input_itf.TaskEntity{},
		agentsInCharge: map[uuid.UUID]*AgentHandle{},
		taskChannels:   map[uuid.UUID]*taskChannel{},
		queueChannels:  map[uuid.UUID]*queueChannel{},
	}, nil
}

func (q *v1) Add(task *output_itf.AddTask) error {
	uid, err := uuid.NewV7()
	if err != nil {
		return err
	}

	t := &input_itf.TaskEntity{
		ID:                 uid,
		QueueID:            q.info.ID,
		Name:               task.Name,
		AgentRole:          task.AgentRole,
		FileWriteAllowance: task.FileWriteAllowance,
		AllowedFilePaths:   task.AllowedFilePaths,
		TemplateFilePaths:  task.TemplateFilePaths,
		ExtraGuidance:      task.ExtraGuidance,
		RetryCount:         0,
		Status:             enums.TaskNotTaken,
		CreatedAt:          helpers.NewUTC(),
		UpdatedAt:          helpers.NewUTC(),
	}

	var prevInfo, infoSnapshot input_itf.QueueEntity

	q.raceSafe(func() {
		q.tasks[uid] = t

		prevInfo = *q.info
		q.info.TotalTask += 1
		q.info.UpdatedAt = helpers.NewUTC()
		infoSnapshot = *q.info
	})

	if err = q.wal.Append(&input_itf.TaskWALRecord{
		Kind:  enums.EventTaskCreated,
		Task:  t,
		Queue: &infoSnapshot,
	}); err != nil {
		q.raceSafe(func() {
			delete(q.tasks, uid)
			*q.info = prevInfo
		})
		return custom_error.Critical("cannot append new task to wal: %v", err)
	}

	q.raceSafe(func() {
		q.publishTaskEvent(uid, enums.EventTaskCreated, &output_itf.TaskEventData{
			Status:     t.Status,
			RetryCount: t.RetryCount,
		})
	})

	return nil
}

func (q *v1) Assign(agentID, taskID uuid.UUID) error {
	var err error
	var t *input_itf.TaskEntity

	prevStatus := enums.TaskNotTaken

	var prevInfo, infoSnapshot input_itf.QueueEntity

	q.raceSafe(func() {
		var found bool
		t, found = q.tasks[taskID]
		if !found || !t.Status.Takeable() {
			err = custom_error.Critical("task id %v cannot be taken", taskID)
			return
		}

		prevStatus = t.Status
		t.Status = enums.TaskProcessing
		q.agentsInCharge[t.ID] = &AgentHandle{
			AgentID:       agentID,
			LastHeartBeat: helpers.NewUTCUnix(),
		}

		prevInfo = *q.info
		if q.info.StartedAt.IsZero() {
			now := helpers.NewUTC()
			q.info.StartedAt = now
			q.info.UpdatedAt = now
		}
		infoSnapshot = *q.info
	})

	if err != nil {
		return err
	}

	if err := q.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.EventTaskStatusChanged,
		TaskID:  taskID,
		AgentID: agentID,
		Status:  enums.TaskProcessing,
		Queue:   &infoSnapshot,
	}); err != nil {
		q.raceSafe(func() {
			t.Status = prevStatus
			delete(q.agentsInCharge, taskID)
			*q.info = prevInfo
		})

		return custom_error.Critical("cannot append status change to wal: %v", err)
	}

	q.raceSafe(func() {
		q.publishTaskEvent(taskID, enums.EventTaskStatusChanged, &output_itf.TaskEventData{
			AgentID:    agentID,
			Status:     t.Status,
			RetryCount: t.RetryCount,
		})
	})

	return nil
}

func (q *v1) Report(
	agentID, taskID uuid.UUID,
	report *output_itf.TaskReport,
	fileChanges []*output_itf.FileChange,
) error {
	var err error
	var t *input_itf.TaskEntity

	q.raceSafe(func() {
		handle, found := q.agentsInCharge[taskID]
		if !found || handle.AgentID != agentID {
			err = custom_error.Critical("agent %v is not assigned to task %v", agentID, taskID)
			return
		}

		t, found = q.tasks[taskID]
		if !found || t.Status != enums.TaskProcessing {
			err = custom_error.Critical("task %v not found to report", taskID)
		}
	})

	if err != nil {
		return err
	}

	reportID, err := uuid.NewV7()
	if err != nil {
		return custom_error.Critical("cannot create uuid: %v", err)
	}

	doc := report.HandoverDoc
	if doc == nil {
		return custom_error.Critical("report for task %v is missing a handover doc", taskID)
	}

	taskReportRecord := &input_itf.TaskReportEntity{
		ID:            reportID,
		TaskID:        taskID,
		AgentID:       agentID,
		AttemptStatus: report.AttemptStatus,
		HandoverDoc: &input_itf.HandoverDocEntity{
			Task:              doc.Task,
			Outcome:           doc.Outcome,
			Blockers:          doc.Blockers,
			ApprovedDecisions: doc.ApprovedDecisions,
			RejectedDecisions: doc.RejectedDecisions,
			CurrentBehaviors:  doc.CurrentBehaviors,
			ChangedBehaviors:  doc.ChangedBehaviors,
			MustAvoid:         doc.MustAvoid,
			Nuances:           doc.Nuances,
			KnownGaps:         doc.KnownGaps,
		},
		StartedAt:   report.StartedAt,
		CompletedAt: report.CompletedAt,
		CreatedAt:   helpers.NewUTC(),
		UpdatedAt:   helpers.NewUTC(),
	}

	fileChangeRecords := []*input_itf.FileChangeEntity{}

	for _, fc := range fileChanges {
		fcID, err := uuid.NewV7()
		if err != nil {
			return custom_error.Critical("cannot generate uuid: %v", err)
		}

		fileChangeRecords = append(fileChangeRecords, &input_itf.FileChangeEntity{
			ID:          fcID,
			ReportID:    reportID,
			Path:        fc.Path,
			OldPath:     fc.OldPath,
			ChangeType:  fc.ChangeType,
			Additions:   fc.Additions,
			Deletions:   fc.Deletions,
			UnifiedDiff: fc.UnifiedDiff,
		})
	}

	var prevTask, taskSnapshot input_itf.TaskEntity
	var prevInfo, infoSnapshot input_itf.QueueEntity

	q.raceSafe(func() {
		prevTask = *t

		t.Status = report.AttemptStatus
		t.UpdatedAt = helpers.NewUTC()
		t.LastReportID = reportID

		if !report.AttemptStatus.Removable() {
			t.RetryCount += 1
		}

		taskSnapshot = *t

		prevInfo = *q.info
		if report.AttemptStatus == enums.TaskFailed {
			q.info.TotalRetry += 1
			q.info.UpdatedAt = helpers.NewUTC()
		}
		infoSnapshot = *q.info
	})

	if err := q.wal.Append(&input_itf.TaskWALRecord{
		Kind:        enums.EventTaskReported,
		TaskID:      taskID,
		AgentID:     agentID,
		Status:      report.AttemptStatus,
		Task:        &taskSnapshot,
		Report:      taskReportRecord,
		FileChanges: fileChangeRecords,
		Queue:       &infoSnapshot,
	}); err != nil {
		q.raceSafe(func() {
			*t = prevTask
			*q.info = prevInfo
		})

		return custom_error.Critical("cannot append task report to wal: %v", err)
	}

	var drained bool

	q.raceSafe(func() {
		delete(q.agentsInCharge, taskID)

		q.publishTaskEvent(taskID, enums.EventTaskReported, &output_itf.TaskEventData{
			AgentID:     agentID,
			Status:      taskSnapshot.Status,
			RetryCount:  taskSnapshot.RetryCount,
			Report:      report,
			FileChanges: fileChanges,
		})

		if report.AttemptStatus.Removable() {
			delete(q.tasks, taskID)
			drained = len(q.tasks) == 0
		}

		if drained {
			prevInfo = *q.info
			now := helpers.NewUTC()
			q.info.CompletedAt = now
			q.info.UpdatedAt = now
			infoSnapshot = *q.info
		}
	})

	if drained {
		if err := q.wal.Append(&input_itf.TaskWALRecord{
			Kind:  enums.EventQueueDrained,
			Queue: &infoSnapshot,
		}); err != nil {
			q.raceSafe(func() {
				*q.info = prevInfo
			})

			return custom_error.Critical("cannot append queue drained to wal: %v", err)
		}

		q.raceSafe(func() {
			q.publishQueueEvent(enums.EventQueueDrained, &output_itf.QueueEventData{
				TotalTasks:  infoSnapshot.TotalTask,
				TotalRetry:  infoSnapshot.TotalRetry,
				StartedAt:   infoSnapshot.StartedAt,
				CompletedAt: infoSnapshot.CompletedAt,
			})
		})
	}

	return nil
}

func (q *v1) HeartBeat(agentID, taskID uuid.UUID) {
	q.raceSafe(func() {
		handle, found := q.agentsInCharge[taskID]
		if !found || handle.AgentID != agentID {
			q.logger.Error("this agent is not assigned with this task")
			return
		}

		handle.LastHeartBeat = helpers.NewUTCUnix()
	})
}

func (q *v1) SubscribeTaskEvent(taskID uuid.UUID) (uuid.UUID, <-chan *output_itf.TaskEvent) {
	events := make(chan *output_itf.TaskEvent, eventBufferSize)

	channelID, err := uuid.NewV7()
	if err != nil {
		q.logger.Error("cannot create uuid: %v", err)
		close(events)
		return uuid.Nil, events
	}

	q.raceSafe(func() {
		q.taskChannels[channelID] = &taskChannel{
			taskID: taskID,
			events: events,
		}
	})

	return channelID, events
}

func (q *v1) SubscribeQueueEvent(queueID uuid.UUID) (uuid.UUID, <-chan *output_itf.QueueEvent) {
	events := make(chan *output_itf.QueueEvent, eventBufferSize)

	channelID, err := uuid.NewV7()
	if err != nil {
		q.logger.Error("cannot create uuid: %v", err)
		close(events)
		return uuid.Nil, events
	}

	q.raceSafe(func() {
		q.queueChannels[channelID] = &queueChannel{
			queueID: queueID,
			events:  events,
		}
	})

	return channelID, events
}

func (q *v1) Unsubscribe(channelID uuid.UUID) {
	q.raceSafe(func() {
		if sub, found := q.taskChannels[channelID]; found {
			close(sub.events)
			delete(q.taskChannels, channelID)
		}

		if sub, found := q.queueChannels[channelID]; found {
			close(sub.events)
			delete(q.queueChannels, channelID)
		}
	})
}

func (q *v1) publishTaskEvent(
	taskID uuid.UUID,
	event enums.TaskQueueEvent,
	data *output_itf.TaskEventData,
) {
	emittedAt := helpers.NewUTC()

	for channelID, sub := range q.taskChannels {
		if sub.taskID != taskID {
			continue
		}

		select {
		case sub.events <- &output_itf.TaskEvent{
			ChannelID: channelID,
			QueueID:   q.info.ID,
			TaskID:    taskID,
			Event:     event,
			Data:      data,
			EmittedAt: emittedAt,
		}:
		default:
			q.logger.Error("task event channel %v is full, dropping event %v", channelID, event)
		}
	}
}

func (q *v1) publishQueueEvent(
	event enums.TaskQueueEvent,
	data *output_itf.QueueEventData,
) {
	emittedAt := helpers.NewUTC()

	for channelID, sub := range q.queueChannels {
		if sub.queueID != q.info.ID {
			continue
		}

		select {
		case sub.events <- &output_itf.QueueEvent{
			ChannelID: channelID,
			QueueID:   q.info.ID,
			Event:     event,
			Data:      data,
			EmittedAt: emittedAt,
		}:
		default:
			q.logger.Error("queue event channel %v is full, dropping event %v", channelID, event)
		}
	}
}

func (q *v1) raceSafe(exec func()) {
	q.locker.Lock()
	defer q.locker.Unlock()
	exec()
}
