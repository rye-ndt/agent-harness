package wal

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	input_itf "hexago/internal/interface/input"
)

type fileWAL struct {
	writeMu sync.Mutex
	file    *os.File
	syncMu  sync.Mutex
	syncing bool
	dirty   bool
}

func New(path string) (input_itf.TaskWAL, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR|os.O_APPEND, 0o644)
	if err != nil {
		return nil, err
	}

	return &fileWAL{
		writeMu: sync.Mutex{},
		file:    f,
		syncMu:  sync.Mutex{},
		syncing: false,
		dirty:   false,
	}, nil
}

func (w *fileWAL) Append(record *input_itf.TaskWALRecord) error {
	line, err := json.Marshal(record)
	if err != nil {
		return err
	}

	line = append(line, '\n')

	w.writeMu.Lock()
	_, err = w.file.Write(line)
	w.writeMu.Unlock()

	if err != nil {
		return err
	}

	w.scheduleSync()
	return nil
}

func (w *fileWAL) scheduleSync() {
	w.syncMu.Lock()
	w.dirty = true
	if w.syncing {
		w.syncMu.Unlock()
		return
	}
	w.syncing = true
	w.syncMu.Unlock()

	go w.syncLoop()
}

func (w *fileWAL) syncLoop() {
	for {
		w.syncMu.Lock()
		if !w.dirty {
			w.syncing = false
			w.syncMu.Unlock()
			return
		}
		w.dirty = false
		w.syncMu.Unlock()

		w.file.Sync()
	}
}

func (w *fileWAL) Replay() ([]*input_itf.TaskWALRecord, error) {
	if _, err := w.file.Seek(0, 0); err != nil {
		return nil, err
	}

	var records []*input_itf.TaskWALRecord
	scanner := bufio.NewScanner(w.file)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		record := &input_itf.TaskWALRecord{}
		if err := json.Unmarshal(scanner.Bytes(), record); err != nil {
			break
		}
		records = append(records, record)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return records, nil
}

func (w *fileWAL) Reset() error {
	w.writeMu.Lock()
	defer w.writeMu.Unlock()

	if err := w.file.Truncate(0); err != nil {
		return err
	}
	if _, err := w.file.Seek(0, 0); err != nil {
		return err
	}

	return w.file.Sync()
}

func (w *fileWAL) Close() error {
	w.writeMu.Lock()
	defer w.writeMu.Unlock()

	if err := w.file.Sync(); err != nil {
		return err
	}

	return w.file.Close()
}
