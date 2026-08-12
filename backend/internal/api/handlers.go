package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/streamforge/streamforge/internal/auth"
	"github.com/streamforge/streamforge/internal/authorization"
	"github.com/streamforge/streamforge/internal/crypto"
	"github.com/streamforge/streamforge/internal/models"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	token, user, err := s.auth.Login(r.Context(), req.Email, req.Password, clientIP(r))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password")
		return
	}
	perms, _ := s.store.GetRolePermissions(r.Context(), string(user.Role))
	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user": map[string]any{
			"id": user.ID, "email": user.Email, "display_name": user.DisplayName,
			"role": user.Role, "is_active": user.IsActive, "permissions": perms,
		},
	})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}
	perms, _ := s.store.GetRolePermissions(r.Context(), string(user.Role))
	writeJSON(w, http.StatusOK, map[string]any{
		"id":                  user.ID,
		"email":               user.Email,
		"display_name":        user.DisplayName,
		"role":                user.Role,
		"is_active":           user.IsActive,
		"last_login_at":       user.LastLoginAt,
		"password_changed_at": user.PasswordChangedAt,
		"created_at":          user.CreatedAt,
		"permissions":         perms,
	})
}

func (s *Server) requirePerm(w http.ResponseWriter, r *http.Request, perm string) (*models.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return nil, false
	}
	perms, err := s.store.GetRolePermissions(r.Context(), string(user.Role))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to load permissions")
		return nil, false
	}
	if !authorization.HasPermission(perms, perm) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient permissions")
		return nil, false
	}
	return user, true
}

func (s *Server) audit(user *models.User, r *http.Request, clusterID *uuid.UUID, resource, action, result, reason string, meta map[string]any) {
	uid := user.ID
	_ = s.store.InsertAudit(r.Context(), models.AuditLog{
		UserID:    &uid,
		UserEmail: user.Email,
		IPAddress: r.RemoteAddr,
		ClusterID: clusterID,
		Resource:  resource,
		Action:    action,
		Result:    result,
		Reason:    reason,
		Metadata:  meta,
	})
}

func (s *Server) listClusters(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	clusters, err := s.store.ListClusters(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": clusters})
}

func (s *Server) createCluster(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "cluster.manage")
	if !ok {
		return
	}
	var req models.ClusterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	c := clusterFromRequest(req)
	if req.SASLPassword != "" {
		enc, err := crypto.Encrypt(req.SASLPassword, s.cfg.EncryptionKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ENCRYPT_ERROR", "Failed to encrypt credentials")
			return
		}
		c.SASLEncrypted = enc
	}
	if err := s.kafka.TestConnection(r.Context(), c); err != nil {
		c.Status = "UNREACHABLE"
		c.LastError = err.Error()
	} else {
		c.Status = "CONNECTED"
	}
	if err := s.store.CreateCluster(r.Context(), c); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "cluster:"+c.Name, "CREATE_CLUSTER", "SUCCESS", "", nil)
	writeJSON(w, http.StatusCreated, c)
}

func clusterFromRequest(req models.ClusterCreateRequest) *models.Cluster {
	return &models.Cluster{
		Name:              req.Name,
		BootstrapServers:  req.BootstrapServers,
		KafkaVersion:      req.KafkaVersion,
		Environment:       req.Environment,
		TLS:               req.TLS,
		SASLMechanism:     req.SASLMechanism,
		SASLUsername:      req.SASLUsername,
		SchemaRegistryURL: req.SchemaRegistryURL,
		ConnectURL:        req.ConnectURL,
		Status:            "UNKNOWN",
	}
}

func (s *Server) testConnectionPreview(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	var req models.ClusterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	c := clusterFromRequest(req)
	if req.SASLPassword != "" {
		enc, err := crypto.Encrypt(req.SASLPassword, s.cfg.EncryptionKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ENCRYPT_ERROR", "Failed to encrypt credentials")
			return
		}
		c.SASLEncrypted = enc
	}
	if err := s.kafka.TestConnection(r.Context(), c); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"connected": false, "error": err.Error()})
		return
	}
	brokers, _ := s.kafka.ListBrokers(r.Context(), c)
	health, _ := s.kafka.GetHealth(r.Context(), c)
	resp := map[string]any{
		"connected":    true,
		"broker_count": len(brokers),
	}
	if health != nil {
		resp["topic_count"] = health.TopicCount
		resp["partition_count"] = health.PartitionCount
	}
	if req.KafkaVersion != "" {
		resp["kafka_version"] = req.KafkaVersion
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) getCluster(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "clusterID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Invalid cluster ID")
		return
	}
	c, err := s.store.GetCluster(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Cluster not found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) deleteCluster(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "cluster.manage")
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "clusterID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Invalid cluster ID")
		return
	}
	c, err := s.store.GetCluster(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Cluster not found")
		return
	}
	if err := s.store.DeleteCluster(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	s.audit(user, r, &id, "cluster:"+c.Name, "DELETE_CLUSTER", "SUCCESS", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) testCluster(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	if err := s.kafka.TestConnection(r.Context(), c); err != nil {
		_ = s.store.UpdateClusterStatus(r.Context(), c.ID, "UNREACHABLE", err.Error())
		writeJSON(w, http.StatusOK, map[string]any{"connected": false, "error": err.Error()})
		return
	}
	_ = s.store.UpdateClusterStatus(r.Context(), c.ID, "CONNECTED", "")
	writeJSON(w, http.StatusOK, map[string]any{"connected": true})
}

func (s *Server) clusterHealth(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	health, err := s.kafka.GetHealth(r.Context(), c)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, health)
}

func (s *Server) listBrokers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	brokers, err := s.kafka.ListBrokers(r.Context(), c)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": brokers})
}

func (s *Server) listTopics(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "topic.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	topics, err := s.kafka.ListTopics(r.Context(), c)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": topics})
}

func (s *Server) createTopic(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "topic.create")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	if !authorization.CanModifyProduction(user.Role, c.Environment, false) {
		writeError(w, http.StatusForbidden, "PRODUCTION_PROTECTED", "Production cluster modification restricted")
		return
	}
	var req struct {
		Name       string `json:"name"`
		Partitions int    `json:"partitions"`
		RF         int    `json:"replication_factor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if req.Partitions <= 0 {
		req.Partitions = 1
	}
	if req.RF <= 0 {
		req.RF = 1
	}
	if err := s.kafka.CreateTopic(r.Context(), c, req.Name, req.Partitions, req.RF, nil); err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "topic:"+req.Name, "CREATE_TOPIC", "SUCCESS", "", map[string]any{"partitions": req.Partitions})
	writeJSON(w, http.StatusCreated, map[string]string{"name": req.Name})
}

func (s *Server) deleteTopic(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "topic.delete")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	topic := chi.URLParam(r, "topic")
	if err := s.kafka.DeleteTopic(r.Context(), c, topic); err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "topic:"+topic, "DELETE_TOPIC", "SUCCESS", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listPartitions(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "topic.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	topic := chi.URLParam(r, "topic")
	parts, err := s.kafka.ListPartitions(r.Context(), c, topic)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": parts})
}

func (s *Server) fetchMessages(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "message.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	topic := chi.URLParam(r, "topic")
	partition, _ := strconv.ParseInt(r.URL.Query().Get("partition"), 10, 32)
	offsetQuery := r.URL.Query().Get("offset")
	var offset int64 = -1
	if offsetQuery != "" {
		offset, _ = strconv.ParseInt(offsetQuery, 10, 64)
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	msgs, err := s.kafka.FetchMessages(r.Context(), c, topic, int32(partition), offset, limit)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": msgs})
}

func (s *Server) publishMessage(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "message.publish")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	topic := chi.URLParam(r, "topic")
	var req struct {
		Key       string            `json:"key"`
		Value     string            `json:"value"`
		Partition *int32            `json:"partition"`
		Headers   map[string]string `json:"headers"`
		Reason    string            `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	part, off, err := s.kafka.PublishMessage(r.Context(), c, topic, req.Key, req.Value, req.Partition, req.Headers)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "topic:"+topic, "PUBLISH_MESSAGE", "SUCCESS", req.Reason, map[string]any{"partition": part, "offset": off})
	writeJSON(w, http.StatusCreated, map[string]any{"partition": part, "offset": off})
}

func (s *Server) listConsumerGroups(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "consumer.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	groups, err := s.kafka.ListConsumerGroups(r.Context(), c)
	if err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": groups})
}

func (s *Server) resetOffsets(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requirePerm(w, r, "consumer.manage")
	if !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	group := chi.URLParam(r, "groupID")
	var req struct {
		Topic     string `json:"topic"`
		Partition int32  `json:"partition"`
		Offset    int64  `json:"offset"`
		Reason    string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if err := s.kafka.ResetOffsets(r.Context(), c, group, req.Topic, req.Partition, req.Offset); err != nil {
		writeError(w, http.StatusBadGateway, "KAFKA_ERROR", err.Error())
		return
	}
	cid := c.ID
	s.audit(user, r, &cid, "consumer:"+group, "RESET_OFFSET", "SUCCESS", req.Reason, map[string]any{"topic": req.Topic, "offset": req.Offset})
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "audit.read"); !ok {
		return
	}
	logs, err := s.store.ListAuditLogs(r.Context(), 200)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": logs})
}

func (s *Server) globalSearch(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "cluster.read"); !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	clusterIDStr := r.URL.Query().Get("cluster_id")

	type searchResult struct {
		Type      string `json:"type"`
		ID        string `json:"id"`
		Label     string `json:"label"`
		ClusterID string `json:"cluster_id,omitempty"`
	}
	var results []searchResult

	clusters, _ := s.store.ListClusters(r.Context())
	for _, c := range clusters {
		if q == "" || containsFold(c.Name, q) || containsFold(c.BootstrapServers, q) {
			results = append(results, searchResult{
				Type: "cluster", ID: c.ID.String(), Label: c.Name, ClusterID: c.ID.String(),
			})
		}
	}

	var searchClusters []*models.Cluster
	if clusterIDStr != "" {
		id, err := uuid.Parse(clusterIDStr)
		if err == nil {
			if c, err := s.store.GetCluster(r.Context(), id); err == nil {
				searchClusters = append(searchClusters, c)
			}
		}
	} else if q != "" {
		for i := range clusters {
			if clusters[i].Status == "CONNECTED" {
				searchClusters = append(searchClusters, &clusters[i])
			}
		}
	}

	if q != "" {
		for _, c := range searchClusters {
			if topics, err := s.kafka.ListTopics(r.Context(), c); err == nil {
				for _, t := range topics {
					if containsFold(t.Name, q) {
						results = append(results, searchResult{
							Type: "topic", ID: t.Name, Label: t.Name, ClusterID: c.ID.String(),
						})
					}
				}
			}
			if brokers, err := s.kafka.ListBrokers(r.Context(), c); err == nil {
				for _, b := range brokers {
					label := fmt.Sprintf("Broker %d (%s:%d)", b.ID, b.Host, b.Port)
					idStr := fmt.Sprintf("%d", b.ID)
					if containsFold(label, q) || containsFold(idStr, q) || containsFold(b.Host, q) {
						results = append(results, searchResult{
							Type: "broker", ID: idStr, Label: label, ClusterID: c.ID.String(),
						})
					}
				}
			}
			if groups, err := s.kafka.ListConsumerGroups(r.Context(), c); err == nil {
				for _, g := range groups {
					if containsFold(g.GroupID, q) {
						results = append(results, searchResult{
							Type: "consumer_group", ID: g.GroupID, Label: g.GroupID, ClusterID: c.ID.String(),
						})
					}
				}
			}
		}
	}

	if len(results) > 50 {
		results = results[:50]
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": results})
}

func (s *Server) loadCluster(w http.ResponseWriter, r *http.Request) (*models.Cluster, error) {
	id, err := uuid.Parse(chi.URLParam(r, "clusterID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Invalid cluster ID")
		return nil, err
	}
	c, err := s.store.GetCluster(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Cluster not found")
		return nil, err
	}
	return c, nil
}

func containsFold(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && (s == sub || len(sub) > 0 && searchFold(s, sub)))
}

func searchFold(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if equalFold(s[i:i+len(sub)], sub) {
			return true
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}
