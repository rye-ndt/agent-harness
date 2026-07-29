package session_manager

import (
	"sync"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"
	output_itf "hexago/internal/interface/output"

	"github.com/google/uuid"
)

type AgentHandle struct {
	AgentID       uuid.UUID
	TaskID        uuid.UUID
	AssignedAt    time.Time
	LastHeartBeat int64
}

type V1Config struct {
	PollTimeout           time.Duration `mapstructure:"poll_timeout" validate:"required,gt=0"`
	HeartbeatTimeout      time.Duration `mapstructure:"heartbeat_timeout" validate:"required,gt=0"`
	HeartbeatScanInterval time.Duration `mapstructure:"heartbeat_scan_interval" validate:"required,gt=0,ltefield=HeartbeatTimeout"`
}

type sessionMetadata struct {
	info            *input_itf.SessionEntity
	taskIDToTask    map[uuid.UUID]*input_itf.TaskEntity
	agentIDToHandle map[uuid.UUID]*AgentHandle
	taskIDToReport  map[uuid.UUID]*core_itf.TaskReport
}

type v1 struct {
	locker   sync.Mutex
	cfg      *V1Config
	wal      input_itf.TaskWAL
	mq       output_itf.MessageQ
	sessions map[uuid.UUID]*sessionMetadata
	stop     chan struct{}
}

func InitV1(cfg *V1Config, wal input_itf.TaskWAL, mq output_itf.MessageQ) (core_itf.SessionManager, error) {
	if err := helpers.ValidateStruct(cfg); err != nil {
		return nil, custom_error.Critical("invalid session manager config: %v", err)
	}

	s := &v1{
		locker:   sync.Mutex{},
		cfg:      cfg,
		wal:      wal,
		mq:       mq,
		sessions: map[uuid.UUID]*sessionMetadata{},
		stop:     make(chan struct{}),
	}

	go s.watchHeartbeats()

	return s, nil
}

func (s *v1) NewSession() (uuid.UUID, error) {
	uid, err := uuid.NewV7()
	if err != nil {
		return uuid.Nil, err
	}

	info := &input_itf.SessionEntity{
		ID:          uid,
		StartedAt:   time.Time{},
		CompletedAt: time.Time{},
		TotalTask:   0,
		TotalRetry:  0,
		RevertCount: 0,
		CreatedAt:   helpers.NewUTC(),
		UpdatedAt:   helpers.NewUTC(),
	}

	if err := s.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.SessionCreated,
		Session: info,
	}); err != nil {
		return uuid.Nil, custom_error.Critical("cannot append session info to wal: %v", err)
	}

	s.raceSafe(func() {
		s.sessions[uid] = &sessionMetadata{
			info:            info,
			taskIDToTask:    map[uuid.UUID]*input_itf.TaskEntity{},
			agentIDToHandle: map[uuid.UUID]*AgentHandle{},
			taskIDToReport:  map[uuid.UUID]*core_itf.TaskReport{},
		}
	})

	return uid, nil
}

func (s *v1) Stop() {
	close(s.stop)
}

func (s *v1) watchHeartbeats() {
	ticker := time.NewTicker(s.cfg.HeartbeatScanInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			_ = s.dropStaleAgents()
		}
	}
}

func (s *v1) dropStaleAgents() error {
	deadline := helpers.NewUTCUnix() - int64(s.cfg.HeartbeatTimeout.Seconds())

	type staleAgent struct {
		sessionID uuid.UUID
		agentID   uuid.UUID
	}

	stale := []staleAgent{}

	s.raceSafe(func() {
		for sessionID, session := range s.sessions {
			for agentID, handle := range session.agentIDToHandle {
				if handle.LastHeartBeat <= deadline {
					stale = append(stale, staleAgent{sessionID: sessionID, agentID: agentID})
				}
			}
		}
	})

	var dropErr error

	for _, agent := range stale {
		if err := s.dropTask(agent.sessionID, agent.agentID, deadline); err != nil && dropErr == nil {
			dropErr = custom_error.Critical("cannot drop task of stale agent %v: %v", agent.agentID, err)
		}
	}

	return dropErr
}

func (s *v1) dropTask(sessionID, agentID uuid.UUID, deadline int64) error {
	var session *sessionMetadata
	var t *input_itf.TaskEntity
	var workingAgent *AgentHandle
	var prevTask, taskSnapshot input_itf.TaskEntity
	var infoSnapshot input_itf.SessionEntity
	var taskID uuid.UUID
	skip := false

	s.raceSafe(func() {
		found := false

		session, found = s.sessions[sessionID]
		if !found {
			skip = true
			return
		}

		// still working
		workingAgent, found = session.agentIDToHandle[agentID]
		if !found || workingAgent.LastHeartBeat > deadline {
			skip = true
			return
		}

		taskID = workingAgent.TaskID

		t, found = session.taskIDToTask[taskID]
		if !found || t.Status != enums.TaskProcessing {
			skip = true
			return
		}

		prevTask = *t
		t.Status = enums.TaskCancelled
		t.UpdatedAt = helpers.NewUTC()
		taskSnapshot = *t

		delete(session.agentIDToHandle, agentID)
		infoSnapshot = *session.info
	})

	if skip {
		return nil
	}

	if err := s.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.SessionTaskDropped,
		TaskID:  taskID,
		AgentID: agentID,
		Status:  enums.TaskCancelled,
		Task:    &taskSnapshot,
		Session: &infoSnapshot,
	}); err != nil {
		s.raceSafe(func() {
			*t = prevTask
			session.agentIDToHandle[agentID] = workingAgent
		})

		return custom_error.Critical("cannot append task drop to wal: %v", err)
	}

	publishErr := s.publishTaskEvent(sessionID, taskID, enums.SessionTaskDropped, &core_itf.TaskEventData{
		AgentID:    agentID,
		Status:     taskSnapshot.Status,
		RetryCount: taskSnapshot.RetryCount,
	})

	if err := s.drainIfDone(session); err != nil && publishErr == nil {
		publishErr = err
	}

	return publishErr
}

func (s *v1) AddTask(sessionID uuid.UUID, task *core_itf.AddTask) error {
	uid, err := uuid.NewV7()
	if err != nil {
		return err
	}

	t := &input_itf.TaskEntity{
		ID:                   uid,
		SessionID:            sessionID,
		Name:                 task.Name,
		AgentRole:            task.AgentRole,
		PreferredModelFamily: task.PreferredModelFamily,
		FileWriteAllowance:   task.FileWriteAllowance,
		AllowedFilePaths:     task.AllowedFilePaths,
		TemplateFilePaths:    task.TemplateFilePaths,
		ExtraGuidance:        task.ExtraGuidance,
		RetryCount:           0,
		Status:               enums.TaskNotTaken,
		CreatedAt:            helpers.NewUTC(),
		UpdatedAt:            helpers.NewUTC(),
	}

	var session *sessionMetadata
	var prevInfo, infoSnapshot input_itf.SessionEntity

	s.raceSafe(func() {
		var found bool

		session, found = s.sessions[sessionID]
		if !found {
			return
		}

		session.taskIDToTask[uid] = t

		prevInfo = *session.info
		session.info.TotalTask += 1
		session.info.CompletedAt = time.Time{}
		session.info.UpdatedAt = helpers.NewUTC()
		infoSnapshot = *session.info
	})

	if session == nil {
		return custom_error.Critical("session %v not found", sessionID)
	}

	if err = s.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.SessionTaskCreated,
		Task:    t,
		Session: &infoSnapshot,
	}); err != nil {
		s.raceSafe(func() {
			delete(session.taskIDToTask, uid)
			*session.info = prevInfo
		})

		return custom_error.Critical("cannot append new task to wal: %v", err)
	}

	return s.publishTaskEvent(sessionID, uid, enums.SessionTaskCreated, &core_itf.TaskEventData{
		Status:     t.Status,
		RetryCount: t.RetryCount,
	})
}

func (s *v1) reportTask(report *core_itf.TaskReport) error {
	if report == nil {
		return custom_error.Critical("report is empty")
	}

	taskID := report.TaskID

	if len(report.HandoverDocs) == 0 {
		return custom_error.Critical("report for task %v is missing a handover doc", taskID)
	}

	var err error
	var session *sessionMetadata
	var t *input_itf.TaskEntity
	var handle *AgentHandle

	s.raceSafe(func() {
		var found bool

		session, t, found = s.findTask(taskID)
		if !found || t.Status != enums.TaskProcessing {
			err = custom_error.Critical("task %v not found to report", taskID)
			return
		}

		handle, found = session.findHandle(taskID)
		if !found {
			err = custom_error.Critical("task %v has no agent in charge", taskID)
		}
	})

	if err != nil {
		return err
	}

	agentID := handle.AgentID

	reportID, err := uuid.NewV7()
	if err != nil {
		return custom_error.Critical("cannot create uuid: %v", err)
	}

	handoverDocRecords := []*input_itf.HandoverDocEntity{}

	for _, doc := range report.HandoverDocs {
		if doc == nil {
			return custom_error.Critical("report for task %v has an empty handover doc", taskID)
		}

		handoverDocRecords = append(handoverDocRecords, &input_itf.HandoverDocEntity{
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
		})
	}

	taskReportRecord := &input_itf.TaskReportEntity{
		ID:            reportID,
		TaskID:        taskID,
		AgentID:       agentID,
		AttemptStatus: report.Status,
		HandoverDocs:  handoverDocRecords,
		StartedAt:     handle.AssignedAt,
		CompletedAt:   helpers.NewUTC(),
		CreatedAt:     helpers.NewUTC(),
		UpdatedAt:     helpers.NewUTC(),
	}

	fileChangeRecords := []*input_itf.FileChangeEntity{}

	for _, fc := range report.FileChanges {
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
	var prevInfo, infoSnapshot input_itf.SessionEntity

	s.raceSafe(func() {
		prevTask = *t

		t.Status = report.Status
		t.UpdatedAt = helpers.NewUTC()
		t.LastReportID = reportID

		if !report.Status.Removable() {
			t.RetryCount += 1
		}

		taskSnapshot = *t

		prevInfo = *session.info
		if report.Status == enums.TaskFailed {
			session.info.TotalRetry += 1
			session.info.UpdatedAt = helpers.NewUTC()
		}
		infoSnapshot = *session.info
	})

	if err := s.wal.Append(&input_itf.TaskWALRecord{
		Kind:        enums.SessionTaskReported,
		TaskID:      taskID,
		AgentID:     agentID,
		Status:      report.Status,
		Task:        &taskSnapshot,
		Report:      taskReportRecord,
		FileChanges: fileChangeRecords,
		Session:     &infoSnapshot,
	}); err != nil {
		s.raceSafe(func() {
			*t = prevTask
			*session.info = prevInfo
		})

		return custom_error.Critical("cannot append task report to wal: %v", err)
	}

	s.raceSafe(func() {
		delete(session.agentIDToHandle, agentID)
		session.keepReport(report)
	})

	publishErr := s.publishTaskEvent(session.info.ID, taskID, enums.SessionTaskReported, &core_itf.TaskEventData{
		AgentID:     agentID,
		Status:      taskSnapshot.Status,
		RetryCount:  taskSnapshot.RetryCount,
		Report:      report,
		FileChanges: report.FileChanges,
	})

	if err := s.drainIfDone(session); err != nil && publishErr == nil {
		publishErr = err
	}

	return publishErr
}

func (s *v1) Status(id uuid.UUID) (*core_itf.SessionStatus, error) {
	var err error
	var status *core_itf.SessionStatus

	s.raceSafe(func() {
		session, found := s.sessions[id]
		if !found {
			err = custom_error.Critical("session %v not found", id)
			return
		}

		tasks := map[uuid.UUID]*core_itf.TaskReport{}

		for taskID, t := range session.taskIDToTask {
			task := &core_itf.TaskReport{
				TaskID:       taskID,
				Status:       t.Status,
				FileChanges:  []*core_itf.FileChange{},
				HandoverDocs: []*core_itf.HandoverDoc{},
			}

			if reported, found := session.taskIDToReport[taskID]; found {
				task.FileChanges = append(task.FileChanges, reported.FileChanges...)
				task.HandoverDocs = append(task.HandoverDocs, reported.HandoverDocs...)
			}

			tasks[taskID] = task
		}

		status = &core_itf.SessionStatus{
			ID:     id,
			Status: sessionStatus(session.info),
			Tasks:  tasks,
		}
	})

	if err != nil {
		return nil, err
	}

	return status, nil
}

func (s *v1) HeartBeat(agentID, taskID uuid.UUID) error {
	var err error

	s.raceSafe(func() {
		session, _, found := s.findTask(taskID)
		if !found {
			err = custom_error.Critical("task %v not found", taskID)
			return
		}

		handle, found := session.agentIDToHandle[agentID]
		if !found || handle.TaskID != taskID {
			err = custom_error.Critical("agent %v is not assigned to task %v", agentID, taskID)
			return
		}

		handle.LastHeartBeat = helpers.NewUTCUnix()
	})

	return err
}

func (s *v1) Execute(session uuid.UUID) error {
	return nil
}

func (s *v1) drainIfDone(session *sessionMetadata) error {
	var prevInfo, infoSnapshot input_itf.SessionEntity
	drained := false

	s.raceSafe(func() {
		if !session.info.CompletedAt.IsZero() || len(session.taskIDToTask) == 0 {
			return
		}

		for _, t := range session.taskIDToTask {
			if !t.Status.Removable() {
				return
			}
		}

		drained = true

		prevInfo = *session.info
		now := helpers.NewUTC()
		session.info.CompletedAt = now
		session.info.UpdatedAt = now
		infoSnapshot = *session.info
	})

	if !drained {
		return nil
	}

	if err := s.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.SessionDrained,
		Session: &infoSnapshot,
	}); err != nil {
		s.raceSafe(func() {
			*session.info = prevInfo
		})

		return custom_error.Critical("cannot append session drained to wal: %v", err)
	}

	return s.publishSessionEvent(infoSnapshot.ID, enums.SessionDrained, &core_itf.SessionEventData{
		TotalTasks:  infoSnapshot.TotalTask,
		TotalRetry:  infoSnapshot.TotalRetry,
		StartedAt:   infoSnapshot.StartedAt,
		CompletedAt: infoSnapshot.CompletedAt,
	})
}

func (s *v1) publishTaskEvent(
	sessionID, taskID uuid.UUID,
	event enums.SessionEvent,
	data *core_itf.TaskEventData,
) error {
	return s.mq.Emit(sessionID, event, &core_itf.TaskEvent{
		SessionID: sessionID,
		TaskID:    taskID,
		Event:     event,
		Data:      data,
		EmittedAt: helpers.NewUTC(),
	})
}

func (s *v1) publishSessionEvent(
	sessionID uuid.UUID,
	event enums.SessionEvent,
	data *core_itf.SessionEventData,
) error {
	return s.mq.Emit(sessionID, event, &core_itf.SessionEvent{
		SessionID: sessionID,
		Event:     event,
		Data:      data,
		EmittedAt: helpers.NewUTC(),
	})
}

func (s *v1) findTask(taskID uuid.UUID) (*sessionMetadata, *input_itf.TaskEntity, bool) {
	for _, session := range s.sessions {
		if t, found := session.taskIDToTask[taskID]; found {
			return session, t, true
		}
	}

	return nil, nil, false
}

func (m *sessionMetadata) findHandle(taskID uuid.UUID) (*AgentHandle, bool) {
	for _, handle := range m.agentIDToHandle {
		if handle.TaskID == taskID {
			return handle, true
		}
	}

	return nil, false
}

func (m *sessionMetadata) keepReport(report *core_itf.TaskReport) {
	kept, found := m.taskIDToReport[report.TaskID]
	if !found {
		kept = &core_itf.TaskReport{
			TaskID:       report.TaskID,
			FileChanges:  []*core_itf.FileChange{},
			HandoverDocs: []*core_itf.HandoverDoc{},
		}

		m.taskIDToReport[report.TaskID] = kept
	}

	kept.Status = report.Status
	kept.FileChanges = append(kept.FileChanges, report.FileChanges...)
	kept.HandoverDocs = append(kept.HandoverDocs, report.HandoverDocs...)
}

func sessionStatus(info *input_itf.SessionEntity) enums.SessionStatus {
	switch {
	case !info.CompletedAt.IsZero():
		return enums.SessionCompleted
	case !info.StartedAt.IsZero():
		return enums.SessionProcessing
	default:
		return enums.SessionInit
	}
}

func (s *v1) raceSafe(exec func()) {
	s.locker.Lock()
	defer s.locker.Unlock()
	exec()
}
