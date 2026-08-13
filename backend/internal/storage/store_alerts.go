package storage

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/kafkaesque/kafkaesque/internal/models"
)

func (s *Store) ListAlertRules(ctx context.Context, clusterID uuid.UUID) ([]models.AlertRule, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, cluster_id, name, rule_type, threshold, enabled, created_at
		FROM alert_rules WHERE cluster_id = $1 ORDER BY created_at DESC
	`, clusterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.AlertRule
	for rows.Next() {
		var r models.AlertRule
		if err := rows.Scan(&r.ID, &r.ClusterID, &r.Name, &r.RuleType, &r.Threshold, &r.Enabled, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) CreateAlertRule(ctx context.Context, rule *models.AlertRule) error {
	if rule.ID == uuid.Nil {
		rule.ID = uuid.New()
	}
	rule.CreatedAt = time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO alert_rules (id, cluster_id, name, rule_type, threshold, enabled, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, rule.ID, rule.ClusterID, rule.Name, rule.RuleType, rule.Threshold, rule.Enabled, rule.CreatedAt)
	return err
}

func (s *Store) DeleteAlertRule(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM alert_rules WHERE id = $1`, id)
	return err
}

func (s *Store) ListAlertEvents(ctx context.Context, clusterID *uuid.UUID, limit int) ([]models.AlertEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	var rows pgxRows
	var err error
	if clusterID != nil {
		rows, err = s.pool.Query(ctx, `
			SELECT id, rule_id, cluster_id, severity, message, status, created_at, resolved_at
			FROM alert_events WHERE cluster_id = $1 ORDER BY created_at DESC LIMIT $2
		`, *clusterID, limit)
	} else {
		rows, err = s.pool.Query(ctx, `
			SELECT id, rule_id, cluster_id, severity, message, status, created_at, resolved_at
			FROM alert_events ORDER BY created_at DESC LIMIT $1
		`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAlertEvents(rows)
}

func (s *Store) InsertAlertEvent(ctx context.Context, ev *models.AlertEvent) error {
	if ev.ID == uuid.Nil {
		ev.ID = uuid.New()
	}
	ev.CreatedAt = time.Now().UTC()
	if ev.Status == "" {
		ev.Status = "ACTIVE"
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO alert_events (id, rule_id, cluster_id, severity, message, status, created_at, resolved_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, ev.ID, ev.RuleID, ev.ClusterID, ev.Severity, ev.Message, ev.Status, ev.CreatedAt, ev.ResolvedAt)
	return err
}

func (s *Store) ResolveAlertEvent(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `UPDATE alert_events SET status = 'RESOLVED', resolved_at = $2 WHERE id = $1`, id, now)
	return err
}

func (s *Store) HasActiveAlertEvent(ctx context.Context, ruleID uuid.UUID, messagePrefix string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM alert_events
			WHERE rule_id = $1 AND status = 'ACTIVE' AND message LIKE $2
		)
	`, ruleID, messagePrefix+"%").Scan(&exists)
	return exists, err
}

func (s *Store) ResolveActiveAlertsByPrefix(ctx context.Context, ruleID uuid.UUID, messagePrefix string) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE alert_events SET status = 'RESOLVED', resolved_at = $2
		WHERE rule_id = $1 AND status = 'ACTIVE' AND message LIKE $3
	`, ruleID, now, messagePrefix+"%")
	return err
}

type pgxRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
	Close()
}

func scanAlertEvents(rows pgxRows) ([]models.AlertEvent, error) {
	out := make([]models.AlertEvent, 0)
	for rows.Next() {
		var e models.AlertEvent
		if err := rows.Scan(&e.ID, &e.RuleID, &e.ClusterID, &e.Severity, &e.Message, &e.Status, &e.CreatedAt, &e.ResolvedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) ListEnabledAlertRules(ctx context.Context) ([]models.AlertRule, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, cluster_id, name, rule_type, threshold, enabled, created_at
		FROM alert_rules WHERE enabled = TRUE
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.AlertRule
	for rows.Next() {
		var r models.AlertRule
		if err := rows.Scan(&r.ID, &r.ClusterID, &r.Name, &r.RuleType, &r.Threshold, &r.Enabled, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) GetUserByEmailOrCreateOIDC(ctx context.Context, email, displayName string, defaultRole models.Role) (*models.User, error) {
	email = NormalizeEmail(email)
	user, err := s.GetUserByEmailAny(ctx, email)
	if err == nil {
		return user, nil
	}
	u := &models.User{
		ID:          uuid.New(),
		Email:       email,
		DisplayName: displayName,
		Role:        defaultRole,
		IsActive:    true,
		TokenVersion: 1,
	}
	hash, err := HashPassword(uuid.NewString())
	if err != nil {
		return nil, err
	}
	u.PasswordHash = hash
	if err := s.CreateUser(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}
