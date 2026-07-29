package wal_sync

import (
	"hexago/internal/helpers/enums"
	"hexago/internal/implementation/core/custom_error"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

func Run(wal input_itf.TaskWAL, db input_itf.TaskStorage) error {
	records, replayErr := wal.Replay()
	if len(records) == 0 && replayErr == nil {
		return nil
	}

	corrupted := replayErr != nil

	sessions := map[uuid.UUID]*input_itf.SessionEntity{}
	tasks := map[uuid.UUID]*input_itf.TaskEntity{}
	reports := []*input_itf.TaskReportEntity{}
	fileChanges := []*input_itf.FileChangeEntity{}

	for _, r := range records {
		if r.Session != nil {
			sessions[r.Session.ID] = r.Session
		}

		switch r.Kind {
		case enums.SessionCreated, enums.SessionDrained:
			if r.Session == nil {
				corrupted = true
			}
		case enums.SessionTaskCreated:
			if r.Task == nil {
				corrupted = true
				continue
			}
			tasks[r.Task.ID] = r.Task
		case enums.SessionTaskStatusChanged, enums.SessionTaskDropped:
			t, found := tasks[r.TaskID]
			if !found {
				corrupted = true
				continue
			}
			t.Status = r.Status
		case enums.SessionTaskReported:
			if r.Task == nil || r.Report == nil {
				corrupted = true
				continue
			}
			tasks[r.Task.ID] = r.Task
			reports = append(reports, r.Report)
			fileChanges = append(fileChanges, r.FileChanges...)
		default:
			corrupted = true
		}
	}

	sessionList := make([]*input_itf.SessionEntity, 0, len(sessions))
	for _, s := range sessions {
		sessionList = append(sessionList, s)
	}

	taskList := make([]*input_itf.TaskEntity, 0, len(tasks))
	for _, t := range tasks {
		taskList = append(taskList, t)
	}

	if err := db.SaveTaskHistory(sessionList, taskList, reports, fileChanges); err != nil {
		return custom_error.Critical("cannot save wal history to db: %v", err)
	}

	if err := wal.Reset(); err != nil {
		return custom_error.Critical("cannot reset wal after sync: %v", err)
	}

	if corrupted {
		return custom_error.Bypass("wal data is corrupted: %v", replayErr)
	}

	return nil
}
