package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/kafkaesque/kafkaesque/internal/alerts"
	"github.com/kafkaesque/kafkaesque/internal/kafkaclient"
	"github.com/kafkaesque/kafkaesque/internal/models"
)

func (s *Server) listSchemas(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "schema.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	if c.SchemaRegistryURL == "" {
		writeError(w, http.StatusBadRequest, "NO_REGISTRY", "Schema Registry URL not configured for cluster")
		return
	}
	subjects, err := s.schema.ListSubjects(r.Context(), c.SchemaRegistryURL)
	if err != nil {
		writeError(w, http.StatusBadGateway, "REGISTRY_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": subjects})
}

func (s *Server) getSchema(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "schema.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	subject := chi.URLParam(r, "subject")
	version := 0
	if v := r.URL.Query().Get("version"); v != "" && v != "latest" {
		if n, err := strconv.Atoi(v); err == nil {
			version = n
		}
	}
	if version <= 0 {
		vers, err := s.schema.GetSubjectVersions(r.Context(), c.SchemaRegistryURL, subject)
		if err != nil || len(vers) == 0 {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "schema version not found")
			return
		}
		version = vers[len(vers)-1]
	}
	schema, err := s.schema.GetSchema(r.Context(), c.SchemaRegistryURL, subject, version)
	if err != nil {
		writeError(w, http.StatusBadGateway, "REGISTRY_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, schema)
}

func (s *Server) registerSchema(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "schema.write")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	subject := chi.URLParam(r, "subject")
	var req struct {
		Schema     string `json:"schema"`
		SchemaType string `json:"schema_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	id, err := s.schema.RegisterSchema(r.Context(), c.SchemaRegistryURL, subject, req.Schema, req.SchemaType)
	if err != nil {
		writeError(w, http.StatusBadGateway, "REGISTRY_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "schema:"+subject, "REGISTER_SCHEMA", "SUCCESS", "", map[string]any{"id": id})
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) listConnectors(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "connect.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	if c.ConnectURL == "" {
		writeError(w, http.StatusBadRequest, "NO_CONNECT", "Kafka Connect URL not configured for cluster")
		return
	}
	names, err := s.connect.ListConnectors(r.Context(), c.ConnectURL)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECT_ERROR", err.Error())
		return
	}
	items := make([]any, 0)
	for _, name := range names {
		info, err := s.connect.GetConnector(r.Context(), c.ConnectURL, name)
		if err != nil {
			items = append(items, map[string]string{"name": name, "state": "UNKNOWN"})
			continue
		}
		items = append(items, info)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) createConnector(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "connect.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	var req struct {
		Name   string            `json:"name"`
		Config map[string]string `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if err := s.connect.CreateConnector(r.Context(), c.ConnectURL, req.Name, req.Config); err != nil {
		writeError(w, http.StatusBadGateway, "CONNECT_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "connect:"+req.Name, "CREATE_CONNECTOR", "SUCCESS", "", nil)
	writeJSON(w, http.StatusCreated, map[string]string{"name": req.Name})
}

func (s *Server) deleteConnector(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "connect.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	name := chi.URLParam(r, "connector")
	if err := s.connect.DeleteConnector(r.Context(), c.ConnectURL, name); err != nil {
		writeError(w, http.StatusBadGateway, "CONNECT_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "connect:"+name, "DELETE_CONNECTOR", "SUCCESS", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) restartConnector(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "connect.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	name := chi.URLParam(r, "connector")
	if err := s.connect.RestartConnector(r.Context(), c.ConnectURL, name); err != nil {
		writeError(w, http.StatusBadGateway, "CONNECT_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "connect:"+name, "RESTART_CONNECTOR", "SUCCESS", "", nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "restarted"})
}

func (s *Server) listACLs(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "acl.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	acls, err := s.kafka.ListACLs(r.Context(), c, r.URL.Query().Get("resource_type"), r.URL.Query().Get("resource_name"))
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": acls})
}

func (s *Server) createACL(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "acl.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	var req kafkaclient.ACLCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if err := s.kafka.ValidateACLRequest(req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	if err := s.kafka.CreateACL(r.Context(), c, req); err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "acl:"+req.ResourceName, "CREATE_ACL", "SUCCESS", "", map[string]any{"principal": req.Principal})
	writeJSON(w, http.StatusCreated, map[string]string{"status": "created"})
}

func (s *Server) deleteACL(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "acl.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	var req kafkaclient.ACLCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if err := s.kafka.DeleteACL(r.Context(), c, req); err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "acl:"+req.ResourceName, "DELETE_ACL", "SUCCESS", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listAlertRules(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "alert.manage"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	rules, err := s.store.ListAlertRules(r.Context(), c.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": rules})
}

func (s *Server) createAlertRule(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "alert.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	var req struct {
		Name      string  `json:"name"`
		RuleType  string  `json:"rule_type"`
		Threshold float64 `json:"threshold"`
		Enabled   *bool   `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	rule := &models.AlertRule{
		ID:        uuid.New(),
		ClusterID: c.ID,
		Name:      req.Name,
		RuleType:  req.RuleType,
		Threshold: req.Threshold,
		Enabled:   enabled,
	}
	if err := s.store.CreateAlertRule(r.Context(), rule); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "alert:"+rule.Name, "CREATE_ALERT_RULE", "SUCCESS", "", nil)
	writeJSON(w, http.StatusCreated, rule)
}

func (s *Server) deleteAlertRule(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "alert.manage"); !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "ruleID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Invalid rule ID")
		return
	}
	if err := s.store.DeleteAlertRule(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listAlertEvents(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "alert.manage"); !ok {
		return
	}
	var clusterID *uuid.UUID
	if cid := r.URL.Query().Get("cluster_id"); cid != "" {
		id, err := uuid.Parse(cid)
		if err == nil {
			clusterID = &id
		}
	}
	events, err := s.store.ListAlertEvents(r.Context(), clusterID, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": events})
}

func (s *Server) resolveAlertEvent(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "alert.manage"); !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Invalid event ID")
		return
	}
	if err := s.store.ResolveAlertEvent(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resolved"})
}

func (s *Server) evaluateAlertsNow(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "alert.manage"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	alerts.NewEvaluator(s.store, s.kafka, 0).EvaluateCluster(r.Context(), c.ID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "evaluated"})
}

func (s *Server) authConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"oidc_enabled": s.cfg.OIDCEnabled,
		"local_login":  s.cfg.LocalLoginEnabled,
		"oidc_login_url": "/api/v1/auth/oidc/login",
	})
}
