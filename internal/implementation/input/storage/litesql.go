package storage

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"

	"hexago/internal/helpers/enums"
	input_itf "hexago/internal/interface/input"
)

var migrations = []string{
	`CREATE TABLE harnesses (
		name TEXT PRIMARY KEY,
		version TEXT NOT NULL,
		platform TEXT NOT NULL,
		path TEXT NOT NULL
	)`,
	`CREATE TABLE sessions (
		id TEXT PRIMARY KEY,
		started_at TEXT NOT NULL,
		completed_at TEXT NOT NULL,
		total_task INTEGER NOT NULL,
		total_retry INTEGER NOT NULL,
		revert_count INTEGER NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE tasks (
		id TEXT PRIMARY KEY,
		session_id TEXT NOT NULL,
		name TEXT NOT NULL,
		agent_role TEXT NOT NULL,
		preferred_model_family TEXT NOT NULL,
		file_write_allowance TEXT NOT NULL,
		allowed_file_paths TEXT NOT NULL,
		template_file_paths TEXT NOT NULL,
		extra_guidance TEXT NOT NULL,
		retry_count INTEGER NOT NULL,
		status TEXT NOT NULL,
		prev_task_id TEXT NOT NULL,
		next_task_id TEXT NOT NULL,
		children_task_ids TEXT NOT NULL,
		last_report_id TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE task_reports (
		id TEXT PRIMARY KEY,
		task_id TEXT NOT NULL,
		agent_id TEXT NOT NULL,
		attempt_status TEXT NOT NULL,
		handover_doc TEXT NOT NULL,
		started_at TEXT NOT NULL,
		completed_at TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE file_changes (
		id TEXT PRIMARY KEY,
		report_id TEXT NOT NULL,
		path TEXT NOT NULL,
		old_path TEXT NOT NULL,
		change_type TEXT NOT NULL,
		additions INTEGER NOT NULL,
		deletions INTEGER NOT NULL,
		unified_diff TEXT NOT NULL
	)`,
	`CREATE TABLE mcp_credentials (
		name TEXT PRIMARY KEY,
		client_id TEXT NOT NULL,
		token_endpoint TEXT NOT NULL,
		encrypted_oauth_key TEXT NOT NULL,
		encrypted_refresh_key TEXT NOT NULL,
		expired_at TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`ALTER TABLE tasks RENAME COLUMN preferred_model_family TO preferred_model`,
	`ALTER TABLE tasks ADD COLUMN thinking_level TEXT NOT NULL DEFAULT ''`,
	`ALTER TABLE tasks ADD COLUMN system_prompts TEXT NOT NULL DEFAULT '[]'`,
	`ALTER TABLE tasks ADD COLUMN auto_retry INTEGER NOT NULL DEFAULT 0`,
}

type litesql struct {
	db *sql.DB
}

type taskStore struct {
	db *sql.DB
}

type mcpStore struct {
	db *sql.DB
}

type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func New(path string) (*litesql, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}

	return &litesql{db: db}, nil
}

func migrate(db *sql.DB) error {
	var version int
	if err := db.QueryRow(`PRAGMA user_version`).Scan(&version); err != nil {
		return err
	}

	for i := version; i < len(migrations); i++ {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(migrations[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
		if _, err := tx.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, i+1)); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func (s *litesql) Save(info *input_itf.HarnessEntity) error {
	_, err := s.db.Exec(`INSERT INTO harnesses (name, version, platform, path)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			version = excluded.version,
			platform = excluded.platform,
			path = excluded.path`,
		info.Name,
		info.Version,
		info.Platform.String(),
		info.Path,
	)
	return err
}

func (s *litesql) Find(name string) (*input_itf.HarnessEntity, error) {
	info := &input_itf.HarnessEntity{}
	var platform string

	err := s.db.QueryRow(`SELECT name, version, platform, path
		FROM harnesses WHERE name = ?`, name).
		Scan(&info.Name, &info.Version, &platform, &info.Path)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	info.Platform = enums.OS(platform)
	return info, nil
}

func (s *litesql) TaskStore() input_itf.TaskStorage {
	return &taskStore{db: s.db}
}

func (s *litesql) MCPStore() input_itf.StorageMCP {
	return &mcpStore{db: s.db}
}

func (s *mcpStore) ListAuthenticated() ([]*input_itf.MCPEntity, error) {
	rows, err := s.db.Query(`SELECT name, client_id, token_endpoint, encrypted_oauth_key,
		encrypted_refresh_key, expired_at, created_at, updated_at
		FROM mcp_credentials WHERE encrypted_oauth_key != ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*input_itf.MCPEntity{}

	for rows.Next() {
		m := &input_itf.MCPEntity{}
		var expiredAt, createdAt, updatedAt string

		if err := rows.Scan(&m.Name, &m.ClientID, &m.TokenEndpoint, &m.EncryptedOAuthKey,
			&m.EncryptedRefreshKey, &expiredAt, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		m.ExpiredAt = parseTime(expiredAt)
		m.CreatedAt = parseTime(createdAt)
		m.UpdatedAt = parseTime(updatedAt)

		list = append(list, m)
	}

	return list, rows.Err()
}

func (s *mcpStore) UpsertCredentials(mcp *input_itf.MCPEntity) error {
	_, err := s.db.Exec(`INSERT INTO mcp_credentials
		(name, client_id, token_endpoint, encrypted_oauth_key, encrypted_refresh_key,
		expired_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			client_id = excluded.client_id,
			token_endpoint = excluded.token_endpoint,
			encrypted_oauth_key = excluded.encrypted_oauth_key,
			encrypted_refresh_key = excluded.encrypted_refresh_key,
			expired_at = excluded.expired_at,
			updated_at = excluded.updated_at`,
		mcp.Name,
		mcp.ClientID,
		mcp.TokenEndpoint,
		mcp.EncryptedOAuthKey,
		mcp.EncryptedRefreshKey,
		formatTime(mcp.ExpiredAt),
		formatTime(mcp.CreatedAt),
		formatTime(mcp.UpdatedAt),
	)
	return err
}

func (s *mcpStore) GetCredentials(name string) (*input_itf.MCPEntity, error) {
	m := &input_itf.MCPEntity{}
	var expiredAt, createdAt, updatedAt string

	err := s.db.QueryRow(`SELECT name, client_id, token_endpoint, encrypted_oauth_key,
		encrypted_refresh_key, expired_at, created_at, updated_at
		FROM mcp_credentials WHERE name = ?`, name).
		Scan(&m.Name, &m.ClientID, &m.TokenEndpoint, &m.EncryptedOAuthKey,
			&m.EncryptedRefreshKey, &expiredAt, &createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	m.ExpiredAt = parseTime(expiredAt)
	m.CreatedAt = parseTime(createdAt)
	m.UpdatedAt = parseTime(updatedAt)

	return m, nil
}

func (s *taskStore) Create(task *input_itf.TaskEntity) error {
	return saveTask(s.db, task)
}

func (s *taskStore) CreateImplementRecord(implement *input_itf.TaskReportEntity) error {
	return saveReport(s.db, implement)
}

func (s *taskStore) Find(taskID uuid.UUID) (*input_itf.TaskEntity, error) {
	t := &input_itf.TaskEntity{}

	var id, sessionID, model, thinkingLevel, allowance string
	var systemPrompts, allowedPaths, templatePaths, childrenIDs string
	var status, prevID, nextID, lastReportID string
	var createdAt, updatedAt string

	err := s.db.QueryRow(`SELECT id, session_id, name, agent_role, preferred_model,
		thinking_level, system_prompts, auto_retry,
		file_write_allowance, allowed_file_paths, template_file_paths, extra_guidance,
		retry_count, status, prev_task_id, next_task_id, children_task_ids,
		last_report_id, created_at, updated_at
		FROM tasks WHERE id = ?`, taskID.String()).
		Scan(&id, &sessionID, &t.Name, &t.AgentRole, &model,
			&thinkingLevel, &systemPrompts, &t.AutoRetry,
			&allowance, &allowedPaths, &templatePaths, &t.ExtraGuidance,
			&t.RetryCount, &status, &prevID, &nextID, &childrenIDs,
			&lastReportID, &createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	t.ID = parseUUID(id)
	t.SessionID = parseUUID(sessionID)
	t.PreferredModel = enums.ModelName(model)
	t.ThinkingLevel = enums.ThinkingLevel(thinkingLevel)
	t.FileWriteAllowance = enums.FileAllowance(allowance)
	t.Status = enums.TaskStatus(status)
	t.PrevTaskID = parseUUID(prevID)
	t.NextTaskID = parseUUID(nextID)
	t.LastReportID = parseUUID(lastReportID)
	t.CreatedAt = parseTime(createdAt)
	t.UpdatedAt = parseTime(updatedAt)

	if err := json.Unmarshal([]byte(systemPrompts), &t.SystemPrompts); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(allowedPaths), &t.AllowedFilePaths); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(templatePaths), &t.TemplateFilePaths); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(childrenIDs), &t.ChildrenTaskIDs); err != nil {
		return nil, err
	}

	return t, nil
}

func (s *taskStore) FindLastImplementRecord(taskID uuid.UUID) *input_itf.TaskReportEntity {
	r := &input_itf.TaskReportEntity{}

	var id, tID, agentID, attemptStatus, handoverDoc string
	var startedAt, completedAt, createdAt, updatedAt string

	err := s.db.QueryRow(`SELECT id, task_id, agent_id, attempt_status, handover_doc,
		started_at, completed_at, created_at, updated_at
		FROM task_reports WHERE task_id = ? ORDER BY id DESC LIMIT 1`, taskID.String()).
		Scan(&id, &tID, &agentID, &attemptStatus, &handoverDoc,
			&startedAt, &completedAt, &createdAt, &updatedAt)
	if err != nil {
		return nil
	}

	r.ID = parseUUID(id)
	r.TaskID = parseUUID(tID)
	r.AgentID = parseUUID(agentID)
	r.AttemptStatus = enums.TaskStatus(attemptStatus)
	r.StartedAt = parseTime(startedAt)
	r.CompletedAt = parseTime(completedAt)
	r.CreatedAt = parseTime(createdAt)
	r.UpdatedAt = parseTime(updatedAt)

	docs := []*input_itf.HandoverDocEntity{}
	if err := json.Unmarshal([]byte(handoverDoc), &docs); err != nil {
		return nil
	}
	r.HandoverDocs = docs

	return r
}

func (s *taskStore) SaveTaskHistory(
	sessions []*input_itf.SessionEntity,
	tasks []*input_itf.TaskEntity,
	reports []*input_itf.TaskReportEntity,
	fileChanges []*input_itf.FileChangeEntity,
) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, sess := range sessions {
		if err := saveSession(tx, sess); err != nil {
			return err
		}
	}

	for _, t := range tasks {
		if err := saveTask(tx, t); err != nil {
			return err
		}
	}

	for _, r := range reports {
		if err := saveReport(tx, r); err != nil {
			return err
		}
	}

	for _, fc := range fileChanges {
		if err := saveFileChange(tx, fc); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func saveSession(e execer, sess *input_itf.SessionEntity) error {
	_, err := e.Exec(`INSERT OR REPLACE INTO sessions
		(id, started_at, completed_at, total_task, total_retry, revert_count, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		sess.ID.String(),
		formatTime(sess.StartedAt),
		formatTime(sess.CompletedAt),
		sess.TotalTask,
		sess.TotalRetry,
		sess.RevertCount,
		formatTime(sess.CreatedAt),
		formatTime(sess.UpdatedAt),
	)
	return err
}

func saveTask(e execer, t *input_itf.TaskEntity) error {
	systemPrompts, err := json.Marshal(t.SystemPrompts)
	if err != nil {
		return err
	}

	allowedPaths, err := json.Marshal(t.AllowedFilePaths)
	if err != nil {
		return err
	}

	templatePaths, err := json.Marshal(t.TemplateFilePaths)
	if err != nil {
		return err
	}

	childrenIDs, err := json.Marshal(t.ChildrenTaskIDs)
	if err != nil {
		return err
	}

	_, err = e.Exec(`INSERT OR REPLACE INTO tasks
		(id, session_id, name, agent_role, preferred_model, thinking_level, system_prompts,
		auto_retry, file_write_allowance,
		allowed_file_paths, template_file_paths, extra_guidance, retry_count, status,
		prev_task_id, next_task_id, children_task_ids, last_report_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID.String(),
		t.SessionID.String(),
		t.Name,
		t.AgentRole,
		string(t.PreferredModel),
		string(t.ThinkingLevel),
		string(systemPrompts),
		t.AutoRetry,
		string(t.FileWriteAllowance),
		string(allowedPaths),
		string(templatePaths),
		t.ExtraGuidance,
		t.RetryCount,
		string(t.Status),
		t.PrevTaskID.String(),
		t.NextTaskID.String(),
		string(childrenIDs),
		t.LastReportID.String(),
		formatTime(t.CreatedAt),
		formatTime(t.UpdatedAt),
	)
	return err
}

func saveReport(e execer, r *input_itf.TaskReportEntity) error {
	doc, err := json.Marshal(r.HandoverDocs)
	if err != nil {
		return err
	}

	_, err = e.Exec(`INSERT OR REPLACE INTO task_reports
		(id, task_id, agent_id, attempt_status, handover_doc,
		started_at, completed_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID.String(),
		r.TaskID.String(),
		r.AgentID.String(),
		string(r.AttemptStatus),
		string(doc),
		formatTime(r.StartedAt),
		formatTime(r.CompletedAt),
		formatTime(r.CreatedAt),
		formatTime(r.UpdatedAt),
	)
	return err
}

func saveFileChange(e execer, fc *input_itf.FileChangeEntity) error {
	_, err := e.Exec(`INSERT OR REPLACE INTO file_changes
		(id, report_id, path, old_path, change_type, additions, deletions, unified_diff)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		fc.ID.String(),
		fc.ReportID.String(),
		fc.Path,
		fc.OldPath,
		fc.ChangeType.String(),
		fc.Additions,
		fc.Deletions,
		fc.UnifiedDiff,
	)
	return err
}

func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func parseUUID(s string) uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil
	}
	return id
}
