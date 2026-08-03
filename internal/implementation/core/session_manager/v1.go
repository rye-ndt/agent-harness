package session_manager

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
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

const progressBufferSize = 32

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

func (s *v1) NewSession(p *core_itf.InitSession) (uuid.UUID, error) {
	workingDir, err := absDir("working dir", p.WorkingDirPath, true)
	if err != nil {
		return uuid.Nil, err
	}

	contextDir, err := absDir("context dir", p.ContextDirPath, false)
	if err != nil {
		return uuid.Nil, err
	}

	if contextDir == "" {
		contextDir = workingDir
	}

	if err := initContext(contextDir); err != nil {
		return uuid.Nil, err
	}

	uid, err := uuid.NewV7()
	if err != nil {
		return uuid.Nil, err
	}

	info := &input_itf.SessionEntity{
		ID:             uid,
		WorkingDirPath: workingDir,
		ContextDirPath: contextDir,
		StartedAt:      time.Time{},
		CompletedAt:    time.Time{},
		TotalTask:      0,
		TotalRetry:     0,
		RevertCount:    0,
		CreatedAt:      helpers.NewUTC(),
		UpdatedAt:      helpers.NewUTC(),
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

	publishErr := s.publish(&core_itf.SessionProgress{
		SessionID:  sessionID,
		TaskID:     taskID,
		AgentID:    agentID,
		Event:      enums.SessionTaskDropped,
		Status:     taskSnapshot.Status,
		RetryCount: taskSnapshot.RetryCount,
	})

	if err := s.drainIfDone(session); err != nil && publishErr == nil {
		publishErr = err
	}

	return publishErr
}

func (s *v1) AddTask(sessionID uuid.UUID, task *core_itf.AddTask) error {
	if task.AgentSpecs == nil {
		return custom_error.Critical("task %s is missing its agent specs", task.Name)
	}

	uid, err := uuid.NewV7()
	if err != nil {
		return err
	}

	t := &input_itf.TaskEntity{
		ID:                 uid,
		SessionID:          sessionID,
		Name:               task.Name,
		AgentRole:          task.AgentSpecs.Role,
		PreferredModel:     task.AgentSpecs.Name,
		ThinkingLevel:      task.AgentSpecs.ThinkingLevel,
		AutoRetry:          task.AutoRetry,
		FileWriteAllowance: task.FileWriteAllowance,
		AllowedFilePaths:   task.AllowedFilePaths,
		TemplateFilePaths:  task.TemplateFilePaths,
		ExtraGuidance:      task.ExtraGuidance,
		RetryCount:         0,
		Status:             enums.TaskNotTaken,
		CreatedAt:          helpers.NewUTC(),
		UpdatedAt:          helpers.NewUTC(),
	}

	var session *sessionMetadata
	var prevInfo, infoSnapshot input_itf.SessionEntity

	s.raceSafe(func() {
		var found bool

		session, found = s.sessions[sessionID]
		if !found {
			return
		}

		t.SystemPrompts = withContextProtocol(task.AgentSpecs.SystemPrompts, session.info.ContextDirPath)

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

	return s.publish(&core_itf.SessionProgress{
		SessionID:  sessionID,
		TaskID:     uid,
		Event:      enums.SessionTaskCreated,
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

	publishErr := s.publish(&core_itf.SessionProgress{
		SessionID:  infoSnapshot.ID,
		TaskID:     taskID,
		AgentID:    agentID,
		Event:      enums.SessionTaskReported,
		Status:     taskSnapshot.Status,
		RetryCount: taskSnapshot.RetryCount,
		Report:     report,
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
			ID:             id,
			Status:         sessionStatus(session.info),
			WorkingDirPath: session.info.WorkingDirPath,
			ContextDirPath: session.info.ContextDirPath,
			Tasks:          tasks,
		}
	})

	if err != nil {
		return nil, err
	}

	return status, nil
}

func (s *v1) HeartBeat(agentID uuid.UUID) error {
	var err error

	s.raceSafe(func() {
		handle, found := s.findAgent(agentID)
		if !found {
			err = custom_error.Critical("agent %v is not assigned to any task", agentID)
			return
		}

		handle.LastHeartBeat = helpers.NewUTCUnix()
	})

	return err
}

func (s *v1) findAgent(agentID uuid.UUID) (*AgentHandle, bool) {
	for _, session := range s.sessions {
		if handle, found := session.agentIDToHandle[agentID]; found {
			return handle, true
		}
	}

	return nil, false
}

func (s *v1) Execute(session uuid.UUID) (<-chan *core_itf.SessionProgress, error) {
	exists := false

	s.raceSafe(func() {
		_, exists = s.sessions[session]
	})

	if !exists {
		return nil, custom_error.Critical("session %v not found", session)
	}

	events := enums.SessionEvents()
	streams := make([]<-chan any, 0, len(events))

	for i, event := range events {
		stream, err := s.mq.Subscribe(session, event)
		if err != nil {
			for _, subscribed := range events[:i] {
				s.mq.Unsubscribe(session, subscribed)
			}

			return nil, custom_error.Critical("cannot watch session %v: %v", session, err)
		}

		streams = append(streams, stream)
	}

	out := make(chan *core_itf.SessionProgress, progressBufferSize)

	wg := sync.WaitGroup{}

	for _, stream := range streams {
		wg.Add(1)

		go func(stream <-chan any) {
			defer wg.Done()

			for {
				select {
				case <-s.stop:
					return
				case data, open := <-stream:
					if !open {
						return
					}

					progress, ok := data.(*core_itf.SessionProgress)
					if !ok {
						continue
					}

					select {
					case out <- progress:
					case <-s.stop:
						return
					}
				}
			}
		}(stream)
	}

	go func() {
		wg.Wait()
		close(out)
	}()

	return out, nil
}

func (s *v1) RetryTask(taskID uuid.UUID) error {
	var err error
	var session *sessionMetadata
	var t *input_itf.TaskEntity
	var prevTask, taskSnapshot input_itf.TaskEntity
	var prevInfo, infoSnapshot input_itf.SessionEntity

	s.raceSafe(func() {
		found := false

		session, t, found = s.findTask(taskID)
		if !found {
			err = custom_error.Critical("task %v not found to retry", taskID)
			return
		}

		if !t.Status.Takeable() {
			err = custom_error.Critical("task %v is %s and cannot be retried", taskID, t.Status)
			return
		}

		prevTask = *t
		t.Status = enums.TaskNotTaken
		t.UpdatedAt = helpers.NewUTC()
		taskSnapshot = *t

		prevInfo = *session.info
		session.info.CompletedAt = time.Time{}
		session.info.UpdatedAt = helpers.NewUTC()
		infoSnapshot = *session.info
	})

	if err != nil {
		return err
	}

	if err := s.wal.Append(&input_itf.TaskWALRecord{
		Kind:    enums.SessionTaskStatusChanged,
		TaskID:  taskID,
		Status:  taskSnapshot.Status,
		Task:    &taskSnapshot,
		Session: &infoSnapshot,
	}); err != nil {
		s.raceSafe(func() {
			*t = prevTask
			*session.info = prevInfo
		})

		return custom_error.Critical("cannot append task retry to wal: %v", err)
	}

	return s.publish(&core_itf.SessionProgress{
		SessionID:  infoSnapshot.ID,
		TaskID:     taskID,
		Event:      enums.SessionTaskStatusChanged,
		Status:     taskSnapshot.Status,
		RetryCount: taskSnapshot.RetryCount,
	})
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

	return s.publish(&core_itf.SessionProgress{
		SessionID:   infoSnapshot.ID,
		Event:       enums.SessionDrained,
		TotalTasks:  infoSnapshot.TotalTask,
		TotalRetry:  infoSnapshot.TotalRetry,
		StartedAt:   infoSnapshot.StartedAt,
		CompletedAt: infoSnapshot.CompletedAt,
	})
}

func (s *v1) publish(progress *core_itf.SessionProgress) error {
	progress.EmittedAt = helpers.NewUTC()

	return s.mq.Emit(progress.SessionID, progress.Event, progress)
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

func absDir(name, path string, required bool) (string, error) {
	trimmed := strings.TrimSpace(path)

	if trimmed == "" {
		if required {
			return "", custom_error.Critical("session %s is empty", name)
		}

		return "", nil
	}

	if !filepath.IsAbs(trimmed) {
		return "", custom_error.Critical("session %s %q must be an absolute path", name, trimmed)
	}

	cleaned := filepath.Clean(trimmed)

	info, err := os.Stat(cleaned)
	switch {
	case os.IsNotExist(err):
		return "", custom_error.Critical("session %s %q does not exist", name, cleaned)
	case os.IsPermission(err):
		return "", custom_error.Critical("session %s %q cannot be accessed: permission denied", name, cleaned)
	case err != nil:
		return "", custom_error.Critical("session %s %q cannot be accessed: %v", name, cleaned, err)
	case !info.IsDir():
		return "", custom_error.Critical("session %s %q is not a directory", name, cleaned)
	}

	dir, err := os.Open(cleaned)
	if err != nil {
		if os.IsPermission(err) {
			return "", custom_error.Critical("session %s %q cannot be accessed: permission denied", name, cleaned)
		}

		return "", custom_error.Critical("session %s %q cannot be opened: %v", name, cleaned, err)
	}
	defer dir.Close()

	if _, err := dir.ReadDir(1); err != nil && !errors.Is(err, io.EOF) {
		if os.IsPermission(err) {
			return "", custom_error.Critical("session %s %q cannot be read: permission denied", name, cleaned)
		}

		return "", custom_error.Critical("session %s %q cannot be read: %v", name, cleaned, err)
	}

	return cleaned, nil
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
