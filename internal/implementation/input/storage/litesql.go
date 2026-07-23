package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

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
}

type litesql struct {
	db *sql.DB
}

func New(path string) (input_itf.HarnessStorage, error) {
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

func (s *litesql) Save(info *input_itf.HarnessInfo) error {
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

func (s *litesql) Find(name string) (*input_itf.HarnessInfo, error) {
	info := &input_itf.HarnessInfo{}
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
