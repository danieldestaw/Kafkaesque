package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/streamforge/streamforge/internal/models"
)

func (s *Store) ListPermissions(ctx context.Context) ([]models.PermissionRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, category, action, description
		FROM permissions ORDER BY category, action
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.PermissionRecord
	for rows.Next() {
		var p models.PermissionRecord
		if err := rows.Scan(&p.ID, &p.Category, &p.Action, &p.Description); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetRolePermissions(ctx context.Context, roleID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT permission_id FROM role_permissions WHERE role_id = $1 ORDER BY permission_id
	`, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var perms []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, rows.Err()
}

func (s *Store) RoleExists(ctx context.Context, roleID string) (bool, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM roles WHERE id = $1`, roleID).Scan(&n)
	return n > 0, err
}

func (s *Store) ListRoles(ctx context.Context) ([]models.RoleRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
		       COALESCE(u.cnt, 0) AS user_count
		FROM roles r
		LEFT JOIN (
			SELECT role, COUNT(*) AS cnt FROM users GROUP BY role
		) u ON u.role = r.id
		ORDER BY r.is_system DESC, r.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []models.RoleRecord
	for rows.Next() {
		var r models.RoleRecord
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.IsSystem, &r.CreatedAt, &r.UpdatedAt, &r.UserCount); err != nil {
			return nil, err
		}
		perms, err := s.GetRolePermissions(ctx, r.ID)
		if err != nil {
			return nil, err
		}
		r.Permissions = perms
		roles = append(roles, r)
	}
	return roles, rows.Err()
}

func (s *Store) GetRole(ctx context.Context, roleID string) (*models.RoleRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
		       (SELECT COUNT(*) FROM users WHERE role = r.id) AS user_count
		FROM roles r WHERE r.id = $1
	`, roleID)
	var r models.RoleRecord
	if err := row.Scan(&r.ID, &r.Name, &r.Description, &r.IsSystem, &r.CreatedAt, &r.UpdatedAt, &r.UserCount); err != nil {
		return nil, err
	}
	perms, err := s.GetRolePermissions(ctx, r.ID)
	if err != nil {
		return nil, err
	}
	r.Permissions = perms
	return &r, nil
}

func (s *Store) CreateRole(ctx context.Context, role *models.RoleRecord, permissionIDs []string) error {
	now := time.Now().UTC()
	role.CreatedAt = now
	role.UpdatedAt = now
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
		VALUES ($1, $2, $3, FALSE, $4, $4)
	`, role.ID, role.Name, role.Description, now); err != nil {
		return err
	}
	if err := setRolePermissionsTx(ctx, tx, role.ID, permissionIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) UpdateRole(ctx context.Context, roleID, name, description string, permissionIDs []string) error {
	now := time.Now().UTC()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	res, err := tx.Exec(ctx, `
		UPDATE roles SET name = $2, description = $3, updated_at = $4 WHERE id = $1
	`, roleID, name, description, now)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("role not found")
	}
	if err := setRolePermissionsTx(ctx, tx, roleID, permissionIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteRole(ctx context.Context, roleID string) error {
	var isSystem bool
	var userCount int
	err := s.pool.QueryRow(ctx, `
		SELECT r.is_system, (SELECT COUNT(*) FROM users WHERE role = r.id)
		FROM roles r WHERE r.id = $1
	`, roleID).Scan(&isSystem, &userCount)
	if err != nil {
		return fmt.Errorf("role not found")
	}
	if isSystem {
		return fmt.Errorf("cannot delete a system role")
	}
	if userCount > 0 {
		return fmt.Errorf("role is assigned to %d user(s)", userCount)
	}
	_, err = s.pool.Exec(ctx, `DELETE FROM roles WHERE id = $1`, roleID)
	return err
}

func setRolePermissionsTx(ctx context.Context, tx pgx.Tx, roleID string, permissionIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, roleID); err != nil {
		return err
	}
	for _, pid := range permissionIDs {
		pid = strings.TrimSpace(pid)
		if pid == "" {
			continue
		}
		var exists int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM permissions WHERE id = $1`, pid).Scan(&exists); err != nil {
			return err
		}
		if exists == 0 {
			return fmt.Errorf("unknown permission: %s", pid)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, roleID, pid); err != nil {
			return err
		}
	}
	return nil
}
