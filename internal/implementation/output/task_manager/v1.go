package task_manager

import (
	"sync"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/google/uuid"
)

type AgentHandle struct {
	TaskID        uuid.UUID
	LastHeartBeat int64 // for easy comparison
}

type v1 struct {
	locker         sync.Mutex
	queueID        uuid.UUID
	wal            input_itf.TaskWAL
	logger         output_itf.Logger
	tasks          map[uuid.UUID]*input_itf.TaskEntity
	agentsInCharge map[uuid.UUID]*AgentHandle
}

func NewV1Queue(
	db input_itf.TaskStorage,
	wal input_itf.TaskWAL,
	logger output_itf.Logger,
) (output_itf.TaskQueue, error) {
	uid, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}

	return &v1{
		locker:         sync.Mutex{},
		queueID:        uid,
		wal:            wal,
		logger:         logger,
		tasks:          map[uuid.UUID]*input_itf.TaskEntity{},
		agentsInCharge: map[uuid.UUID]*AgentHandle{},
	}, nil
}

func (q *v1) Add(task *output_itf.AddTask) error {
	uid, err := uuid.NewV7()
	if err != nil {
		return err
	}

	t := &input_itf.TaskEntity{
		ID:                 uid,
		QueueID:            q.queueID,
		Name:               task.Name,
		AgentRole:          task.AgentRole,
		FileWriteAllowance: task.FileWriteAllowance,
		AllowedFilePaths:   task.AllowedFilePaths,
		TemplateFilePaths:  task.TemplateFilePaths,
		ExtraGuidance:      task.ExtraGuidance,
		Age:                0,
		Status:             enums.TaskNotTaken,
		CreatedAt:          helpers.NewUTC(),
		UpdatedAt:          helpers.NewUTC(),
	}

	q.tasks[uid] = t

	if err = q.wal.Append(&input_itf.TaskWALRecord{
		Kind: enums.WALTaskCreated,
		Task: t,
	}); err != nil {
		delete(q.tasks, uid)
		return custom_error.Critical("cannot append new task to wal: %v", err)
	}

	return nil
}

func (q *v1) Assign(agentID, taskID uuid.UUID) error {
	var err error

	prevStatus := enums.TaskNotTaken

	q.raceSafe(func() {
		t, found := q.tasks[taskID]
		if !found || !t.Status.Takeable() {
			err = custom_error.Critical("task id %v cannot be taken", taskID)
			return
		}

		prevStatus = t.Status
		t.Status = enums.TaskProcessing
		q.agentsInCharge[t.ID] = &AgentHandle{
			TaskID:        taskID,
			LastHeartBeat: helpers.NewUTCUnix(),
		}
	})

	if err != nil {
		return err
	}

	if err := q.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.WALTaskStatusChanged,
		TaskID:  taskID,
		AgentID: agentID,
		Status:  enums.TaskProcessing,
	}); err != nil {
		q.raceSafe(func() {
			q.tasks[taskID].Status = prevStatus
			delete(q.agentsInCharge, taskID)
		})

		return custom_error.Critical("cannot append status change to wal: %v", err)
	}

	return nil
}

func (q *v1) Report(
	agentID, taskID uuid.UUID,
	report *output_itf.TaskReport,
	fileChanges []*output_itf.FileChange,
) error {
	if _, found := q.agentsInCharge[taskID]; !found {
		return custom_error.Critical("agent %v is not assigned to task %v", agentID, taskID)
	}

	t, found := q.tasks[taskID]
	if !found || t.Status != enums.TaskProcessing {
		return custom_error.Critical("task %v not found to report", taskID)

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

	prevTask, taskSnapshot := &input_itf.TaskEntity{}, &input_itf.TaskEntity{}

	q.raceSafe(func() {
		prevTask = t

		t.Status = report.AttemptStatus
		t.UpdatedAt = helpers.NewUTC()
		t.LastReportID = reportID

		if !report.AttemptStatus.Removable() {
			t.Age += 1
		}

		taskSnapshot = t
	})

	if err := q.wal.Append(&input_itf.TaskWALRecord{
		Kind:        enums.WALTaskReported,
		TaskID:      taskID,
		AgentID:     agentID,
		Status:      report.AttemptStatus,
		Task:        taskSnapshot,
		Report:      taskReportRecord,
		FileChanges: fileChangeRecords,
	}); err != nil {
		q.raceSafe(func() {
			t = prevTask
		})

		return custom_error.Critical("cannot append task report to wal: %v", err)
	}

	q.raceSafe(func() {
		delete(q.agentsInCharge, taskID)

		if report.AttemptStatus.Removable() {
			delete(q.tasks, taskID)
		}
	})

	return nil
}

func (q *v1) HeartBeat(agentID, taskID uuid.UUID) {
	if _, found := q.agentsInCharge[taskID]; !found {
		q.logger.Error("this agent is not assigned with this task")
		return
	}

	if _, found := q.tasks[taskID]; !found {
		q.logger.Error("task not found or completed")
		return
	}

	q.agentsInCharge[agentID].LastHeartBeat = helpers.NewUTCUnix()

	return
}

func (q *v1) raceSafe(exec func()) {
	q.locker.Lock()
	defer q.locker.Unlock()
	exec()
}
