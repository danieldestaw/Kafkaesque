package storage

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kafkaesque/kafkaesque/internal/models"
	"golang.org/x/crypto/bcrypt"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

const userSelectCols = `id, email, display_name, password_hash, role, is_active,
	COALESCE(token_version, 1), last_login_at, password_changed_at, created_at, updated_at`

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}
	s := &Store{pool: pool}
	if err := s.runMigrations(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) runMigrations(ctx context.Context) error {
	entries, err := fs.Glob(migrationFS, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(entries)
	for _, name := range entries {
		data, err := migrationFS.ReadFile(name)
		if err != nil {
			return err
		}
		if _, err := s.pool.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}

func scanUser(row pgx.Row) (*models.User, error) {
	u := &models.User{}
	err := row.Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.Role, &u.IsActive,
		&u.TokenVersion, &u.LastLoginAt, &u.PasswordChangedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	return u, err
}

func (s *Store) EnsureAdmin(ctx context.Context, email, password string) error {
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	id := uuid.New()
	now := time.Now().UTC()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO users (id, email, display_name, password_hash, role, is_active, password_changed_at, token_version)
		VALUES ($1, $2, $3, $4, 'ADMIN', TRUE, $5, 1)
	`, id, email, "Administrator", string(hash), now)
	return err
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+userSelectCols+` FROM users WHERE email = $1 AND is_active = TRUE
	`, email)
	return scanUser(row)
}

func (s *Store) GetUserByEmailAny(ctx context.Context, email string) (*models.User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+userSelectCols+` FROM users WHERE email = $1
	`, email)
	return scanUser(row)
}

func (s *Store) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+userSelectCols+` FROM users WHERE id = $1
	`, id)
	return scanUser(row)
}

func (s *Store) ListUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, email, display_name, role, is_active, last_login_at, password_changed_at, created_at, updated_at
		FROM users ORDER BY email
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(
			&u.ID, &u.Email, &u.DisplayName, &u.Role, &u.IsActive,
			&u.LastLoginAt, &u.PasswordChangedAt, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) CreateUser(ctx context.Context, u *models.User) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	now := time.Now().UTC()
	u.CreatedAt = now
	u.UpdatedAt = now
	u.PasswordChangedAt = &now
	if u.TokenVersion == 0 {
		u.TokenVersion = 1
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, email, display_name, password_hash, role, is_active, password_changed_at, token_version)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, u.ID, u.Email, u.DisplayName, u.PasswordHash, u.Role, u.IsActive, u.PasswordChangedAt, u.TokenVersion)
	return err
}

func (s *Store) UpdateUser(ctx context.Context, id uuid.UUID, email, displayName string, role models.Role, isActive bool) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET email = $2, display_name = $3, role = $4, is_active = $5, updated_at = $6
		WHERE id = $1
	`, id, email, displayName, role, isActive, now)
	return err
}

func (s *Store) SetUserActive(ctx context.Context, id uuid.UUID, active bool) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET is_active = $2, updated_at = $3 WHERE id = $1
	`, id, active, now)
	return err
}

func (s *Store) DeleteUser(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func (s *Store) ResetPassword(ctx context.Context, id uuid.UUID, hash string) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET password_hash = $2, password_changed_at = $3, updated_at = $3, token_version = token_version + 1
		WHERE id = $1
	`, id, hash, now)
	return err
}

func (s *Store) RevokeUserSessions(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET token_version = token_version + 1, updated_at = $2 WHERE id = $1
	`, id, now)
	return err
}

func (s *Store) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET last_login_at = $2, updated_at = $2 WHERE id = $1
	`, id, now)
	return err
}

func (s *Store) CountActiveAdmins(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = TRUE
	`).Scan(&n)
	return n, err
}

func (s *Store) ListAuditByUser(ctx context.Context, userID uuid.UUID, limit int) ([]models.AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, COALESCE(user_email,''), COALESCE(ip_address,''), cluster_id,
		       resource, action, result, COALESCE(reason,''), metadata, created_at
		FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAuditRows(rows)
}

func scanAuditRows(rows pgx.Rows) ([]models.AuditLog, error) {
	var out []models.AuditLog
	for rows.Next() {
		var a models.AuditLog
		if err := rows.Scan(&a.ID, &a.UserID, &a.UserEmail, &a.IPAddress, &a.ClusterID,
			&a.Resource, &a.Action, &a.Result, &a.Reason, &a.Metadata, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// --- clusters (unchanged queries, updated only migration runner above) ---

func (s *Store) ListClusters(ctx context.Context) ([]models.Cluster, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, bootstrap_servers, COALESCE(kafka_version,''), environment,
		       tls, COALESCE(sasl_mechanism,''), COALESCE(sasl_username,''), COALESCE(sasl_encrypted,''),
		       COALESCE(schema_registry_url,''), COALESCE(connect_url,''), status,
		       last_connected_at, COALESCE(last_error,''), created_at, updated_at
		FROM clusters ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Cluster
	for rows.Next() {
		var c models.Cluster
		if err := rows.Scan(
			&c.ID, &c.Name, &c.BootstrapServers, &c.KafkaVersion, &c.Environment,
			&c.TLS, &c.SASLMechanism, &c.SASLUsername, &c.SASLEncrypted,
			&c.SchemaRegistryURL, &c.ConnectURL, &c.Status,
			&c.LastConnectedAt, &c.LastError, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) GetCluster(ctx context.Context, id uuid.UUID) (*models.Cluster, error) {
	c := &models.Cluster{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, bootstrap_servers, COALESCE(kafka_version,''), environment,
		       tls, COALESCE(sasl_mechanism,''), COALESCE(sasl_username,''), COALESCE(sasl_encrypted,''),
		       COALESCE(schema_registry_url,''), COALESCE(connect_url,''), status,
		       last_connected_at, COALESCE(last_error,''), created_at, updated_at
		FROM clusters WHERE id = $1
	`, id).Scan(
		&c.ID, &c.Name, &c.BootstrapServers, &c.KafkaVersion, &c.Environment,
		&c.TLS, &c.SASLMechanism, &c.SASLUsername, &c.SASLEncrypted,
		&c.SchemaRegistryURL, &c.ConnectURL, &c.Status,
		&c.LastConnectedAt, &c.LastError, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Store) CreateCluster(ctx context.Context, c *models.Cluster) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now
	_, err := s.pool.Exec(ctx, `
		INSERT INTO clusters (id, name, bootstrap_servers, kafka_version, environment, tls,
			sasl_mechanism, sasl_username, sasl_encrypted, schema_registry_url, connect_url, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`, c.ID, c.Name, c.BootstrapServers, c.KafkaVersion, c.Environment, c.TLS,
		c.SASLMechanism, c.SASLUsername, c.SASLEncrypted, c.SchemaRegistryURL, c.ConnectURL, c.Status)
	return err
}

func (s *Store) DeleteCluster(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM clusters WHERE id = $1`, id)
	return err
}

func (s *Store) UpdateClusterStatus(ctx context.Context, id uuid.UUID, status, lastError string) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE clusters SET status = $2, last_error = $3, last_connected_at = $4, updated_at = $4 WHERE id = $1
	`, id, status, lastError, now)
	return err
}

func (s *Store) InsertAudit(ctx context.Context, log models.AuditLog) error {
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO audit_logs (id, user_id, user_email, ip_address, cluster_id, resource, action, result, reason, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, log.ID, log.UserID, log.UserEmail, log.IPAddress, log.ClusterID, log.Resource, log.Action, log.Result, log.Reason, log.Metadata)
	return err
}

func (s *Store) ListAuditLogs(ctx context.Context, limit int) ([]models.AuditLog, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, COALESCE(user_email,''), COALESCE(ip_address,''), cluster_id,
		       resource, action, result, COALESCE(reason,''), metadata, created_at
		FROM audit_logs ORDER BY created_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAuditRows(rows)
}

func VerifyPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
