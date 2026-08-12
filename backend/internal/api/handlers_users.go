package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/streamforge/streamforge/internal/auth"
	"github.com/streamforge/streamforge/internal/authorization"
	"github.com/streamforge/streamforge/internal/models"
	"github.com/streamforge/streamforge/internal/storage"
)

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if len(req.NewPassword) < 6 {
		writeError(w, http.StatusBadRequest, "WEAK_PASSWORD", "Password must be at least 6 characters")
		return
	}
	if err := storage.VerifyPassword(user.PasswordHash, req.CurrentPassword); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PASSWORD", "Current password is incorrect")
		return
	}
	hash, err := storage.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "HASH_ERROR", "Failed to hash password")
		return
	}
	if err := s.store.ResetPassword(r.Context(), user.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(user, r, nil, "user:"+user.Email, "PASSWORD_CHANGED", "SUCCESS", "self-service", nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "users.read"); !ok {
		return
	}
	users, err := s.store.ListUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": users})
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "users.create")
	if !ok {
		return
	}
	var req models.UserCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	req.Email = storage.NormalizeEmail(req.Email)
	if req.Email == "" || req.DisplayName == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION", "Email, display name, and password are required")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "WEAK_PASSWORD", "Password must be at least 6 characters")
		return
	}
	exists, err := s.store.RoleExists(r.Context(), string(req.Role))
	if err != nil || !exists {
		writeError(w, http.StatusBadRequest, "INVALID_ROLE", "Invalid role")
		return
	}
	if _, err := s.store.GetUserByEmailAny(r.Context(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "EMAIL_EXISTS", "Email already in use")
		return
	}
	hash, err := storage.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "HASH_ERROR", "Failed to hash password")
		return
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	u := &models.User{
		Email:        req.Email,
		DisplayName:  req.DisplayName,
		PasswordHash: hash,
		Role:         req.Role,
		IsActive:     active,
	}
	if err := s.store.CreateUser(r.Context(), u); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(actor, r, nil, "user:"+u.Email, "USER_CREATED", "SUCCESS", "", map[string]any{"role": u.Role})
	writeJSON(w, http.StatusCreated, publicUser(u))
}

func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "users.read"); !ok {
		return
	}
	u, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	writeJSON(w, http.StatusOK, publicUser(u))
}

func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "users.update")
	if !ok {
		return
	}
	target, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	var req models.UserUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	email := target.Email
	displayName := target.DisplayName
	role := target.Role
	isActive := target.IsActive

	if req.Email != nil {
		email = storage.NormalizeEmail(*req.Email)
		if email == "" {
			writeError(w, http.StatusBadRequest, "VALIDATION", "Email cannot be empty")
			return
		}
		if existing, err := s.store.GetUserByEmailAny(r.Context(), email); err == nil && existing.ID != target.ID {
			writeError(w, http.StatusConflict, "EMAIL_EXISTS", "Email already in use")
			return
		}
	}
	if req.DisplayName != nil {
		displayName = *req.DisplayName
	}
	if req.Role != nil {
		if exists, err := s.store.RoleExists(r.Context(), string(*req.Role)); err != nil || !exists {
			writeError(w, http.StatusBadRequest, "INVALID_ROLE", "Invalid role")
			return
		}
		actorPerms, _ := s.store.GetRolePermissions(r.Context(), string(actor.Role))
		if !authorization.HasPermission(actorPerms, "roles.assign") && *req.Role != target.Role {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "Cannot assign roles")
			return
		}
		role = *req.Role
	}
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	if err := s.guardLastAdmin(r.Context(), target, role, isActive, actor.ID); err != nil {
		writeError(w, http.StatusBadRequest, "LAST_ADMIN", err.Error())
		return
	}

	if err := s.store.UpdateUser(r.Context(), target.ID, email, displayName, role, isActive); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	updated, _ := s.store.GetUserByID(r.Context(), target.ID)
	s.audit(actor, r, nil, "user:"+updated.Email, "USER_UPDATED", "SUCCESS", "", map[string]any{
		"role": updated.Role, "is_active": updated.IsActive,
	})
	writeJSON(w, http.StatusOK, publicUser(updated))
}

func (s *Server) deleteUser(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "users.delete")
	if !ok {
		return
	}
	target, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	if target.ID == actor.ID {
		writeError(w, http.StatusBadRequest, "SELF_DELETE", "Cannot delete your own account")
		return
	}
	if err := s.guardLastAdmin(r.Context(), target, target.Role, false, actor.ID); err != nil {
		writeError(w, http.StatusBadRequest, "LAST_ADMIN", err.Error())
		return
	}
	if err := s.store.DeleteUser(r.Context(), target.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(actor, r, nil, "user:"+target.Email, "USER_DELETED", "SUCCESS", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) disableUser(w http.ResponseWriter, r *http.Request) {
	s.setUserActive(w, r, false, "USER_DISABLED")
}

func (s *Server) enableUser(w http.ResponseWriter, r *http.Request) {
	s.setUserActive(w, r, true, "USER_ENABLED")
}

func (s *Server) setUserActive(w http.ResponseWriter, r *http.Request, active bool, action string) {
	perm := "users.disable"
	if active {
		perm = "users.update"
	}
	actor, ok := s.requirePerm(w, r, perm)
	if !ok {
		return
	}
	target, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	if target.ID == actor.ID && !active {
		writeError(w, http.StatusBadRequest, "SELF_DISABLE", "Cannot disable your own account")
		return
	}
	if err := s.guardLastAdmin(r.Context(), target, target.Role, active, actor.ID); err != nil {
		writeError(w, http.StatusBadRequest, "LAST_ADMIN", err.Error())
		return
	}
	if err := s.store.SetUserActive(r.Context(), target.ID, active); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	if !active {
		_ = s.store.RevokeUserSessions(r.Context(), target.ID)
	}
	s.audit(actor, r, nil, "user:"+target.Email, action, "SUCCESS", "", nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) resetUserPassword(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "users.reset_password")
	if !ok {
		return
	}
	target, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	var req models.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "WEAK_PASSWORD", "Password must be at least 6 characters")
		return
	}
	hash, err := storage.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "HASH_ERROR", "Failed to hash password")
		return
	}
	if err := s.store.ResetPassword(r.Context(), target.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(actor, r, nil, "user:"+target.Email, "PASSWORD_RESET", "SUCCESS", req.Reason, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) revokeUserSessions(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "users.update")
	if !ok {
		return
	}
	target, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	if err := s.store.RevokeUserSessions(r.Context(), target.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(actor, r, nil, "user:"+target.Email, "SESSION_REVOKED", "SUCCESS", "", nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) userAudit(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "audit.read"); !ok {
		return
	}
	target, err := s.loadUser(w, r)
	if err != nil {
		return
	}
	logs, err := s.store.ListAuditByUser(r.Context(), target.ID, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": logs})
}

func (s *Server) loadUser(w http.ResponseWriter, r *http.Request) (*models.User, error) {
	id, err := uuid.Parse(chi.URLParam(r, "userID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Invalid user ID")
		return nil, err
	}
	u, err := s.store.GetUserByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
		return nil, err
	}
	return u, nil
}

func (s *Server) guardLastAdmin(ctx context.Context, target *models.User, newRole models.Role, newActive bool, actorID uuid.UUID) error {
	if target.Role != models.RoleAdmin {
		return nil
	}
	if newRole == models.RoleAdmin && newActive {
		return nil
	}
	n, err := s.store.CountActiveAdmins(ctx)
	if err != nil {
		return err
	}
	if n <= 1 {
		return errLastAdmin
	}
	return nil
}

var errLastAdmin = errors.New("cannot remove or disable the last active administrator")

func publicUser(u *models.User) map[string]any {
	return map[string]any{
		"id":                  u.ID,
		"email":               u.Email,
		"display_name":        u.DisplayName,
		"role":                u.Role,
		"is_active":           u.IsActive,
		"last_login_at":       u.LastLoginAt,
		"password_changed_at": u.PasswordChangedAt,
		"created_at":          u.CreatedAt,
		"updated_at":          u.UpdatedAt,
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	return r.RemoteAddr
}
