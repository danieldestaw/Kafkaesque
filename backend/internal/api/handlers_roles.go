package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/kafkaesque/kafkaesque/internal/authorization"
	"github.com/kafkaesque/kafkaesque/internal/models"
)

func (s *Server) listPermissions(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "roles.read"); !ok {
		return
	}
	perms, err := s.store.ListPermissions(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	groups := map[string][]models.PermissionRecord{}
	order := []string{}
	for _, p := range perms {
		if _, ok := groups[p.Category]; !ok {
			order = append(order, p.Category)
		}
		groups[p.Category] = append(groups[p.Category], p)
	}
	out := make([]models.PermissionGroup, 0, len(order))
	for _, cat := range order {
		out = append(out, models.PermissionGroup{Category: cat, Permissions: groups[cat]})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func (s *Server) listRoles(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "roles.read"); !ok {
		return
	}
	roles, err := s.store.ListRoles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": roles})
}

func (s *Server) getRole(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "roles.read"); !ok {
		return
	}
	roleID := chi.URLParam(r, "roleID")
	role, err := s.store.GetRole(r.Context(), roleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Role not found")
		return
	}
	writeJSON(w, http.StatusOK, role)
}

func (s *Server) createRole(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "roles.create")
	if !ok {
		return
	}
	var req models.RoleCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION", "Role name is required")
		return
	}
	id := strings.TrimSpace(req.ID)
	if id == "" {
		id = authorization.SlugifyRoleID(req.Name)
	} else {
		id = strings.ToUpper(id)
	}
	if id == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION", "Invalid role identifier")
		return
	}
	exists, err := s.store.RoleExists(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	if exists {
		writeError(w, http.StatusConflict, "ROLE_EXISTS", "Role ID already exists")
		return
	}
	role := &models.RoleRecord{
		ID:          id,
		Name:        req.Name,
		Description: strings.TrimSpace(req.Description),
	}
	if err := s.store.CreateRole(r.Context(), role, req.Permissions); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	created, _ := s.store.GetRole(r.Context(), id)
	s.audit(actor, r, nil, "role:"+id, "ROLE_CREATED", "SUCCESS", "", nil)
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) updateRole(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "roles.update")
	if !ok {
		return
	}
	roleID := chi.URLParam(r, "roleID")
	existing, err := s.store.GetRole(r.Context(), roleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Role not found")
		return
	}
	var req models.RoleUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION", "Role name is required")
		return
	}
	if err := s.store.UpdateRole(r.Context(), roleID, name, strings.TrimSpace(req.Description), req.Permissions); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	updated, _ := s.store.GetRole(r.Context(), roleID)
	s.audit(actor, r, nil, "role:"+roleID, "ROLE_UPDATED", "SUCCESS", "", map[string]any{
		"previous_name": existing.Name,
	})
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteRole(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requirePerm(w, r, "roles.delete")
	if !ok {
		return
	}
	roleID := chi.URLParam(r, "roleID")
	role, err := s.store.GetRole(r.Context(), roleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Role not found")
		return
	}
	if err := s.store.DeleteRole(r.Context(), roleID); err != nil {
		if strings.Contains(err.Error(), "system role") || strings.Contains(err.Error(), "assigned") {
			writeError(w, http.StatusBadRequest, "ROLE_PROTECTED", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(actor, r, nil, "role:"+roleID, "ROLE_DELETED", "SUCCESS", role.Name, nil)
	w.WriteHeader(http.StatusNoContent)
}
