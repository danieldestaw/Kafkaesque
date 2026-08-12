package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/streamforge/streamforge/internal/auth"
	"github.com/streamforge/streamforge/internal/config"
	"github.com/streamforge/streamforge/internal/kafkaclient"
	"github.com/streamforge/streamforge/internal/storage"
)

type Server struct {
	cfg    config.Config
	store  *storage.Store
	auth   *auth.Service
	kafka  *kafkaclient.Service
	router chi.Router
}

func NewServer(cfg config.Config, store *storage.Store) *Server {
	s := &Server{
		cfg:   cfg,
		store: store,
		auth:  auth.NewService(store, cfg.JWTSecret, cfg.SessionTTLHours),
		kafka: kafkaclient.NewService(cfg.EncryptionKey),
	}
	s.buildRouter()
	return s
}

func (s *Server) Router() chi.Router { return s.router }

func (s *Server) buildRouter() {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		AllowCredentials: true,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "streamforge"})
	})
	r.Handle("/metrics", promhttp.Handler())

	r.Post("/api/v1/auth/login", s.login)

	r.Route("/api/v1", func(api chi.Router) {
		api.Use(s.auth.Middleware)
		api.Get("/me", s.me)
		api.Post("/me/password", s.changePassword)
		api.Route("/users", func(ur chi.Router) {
			ur.Get("/", s.listUsers)
			ur.Post("/", s.createUser)
			ur.Route("/{userID}", func(uid chi.Router) {
				uid.Get("/", s.getUser)
				uid.Put("/", s.updateUser)
				uid.Delete("/", s.deleteUser)
				uid.Post("/disable", s.disableUser)
				uid.Post("/enable", s.enableUser)
				uid.Post("/reset-password", s.resetUserPassword)
				uid.Post("/revoke-sessions", s.revokeUserSessions)
				uid.Get("/audit", s.userAudit)
			})
		})
		api.Get("/permissions", s.listPermissions)
		api.Route("/roles", func(rr chi.Router) {
			rr.Get("/", s.listRoles)
			rr.Post("/", s.createRole)
			rr.Route("/{roleID}", func(rid chi.Router) {
				rid.Get("/", s.getRole)
				rid.Put("/", s.updateRole)
				rid.Delete("/", s.deleteRole)
			})
		})
		api.Route("/clusters", func(cr chi.Router) {
			cr.Get("/", s.listClusters)
			cr.Post("/", s.createCluster)
			cr.Post("/test-connection", s.testConnectionPreview)
			cr.Route("/{clusterID}", func(cid chi.Router) {
				cid.Get("/", s.getCluster)
				cid.Delete("/", s.deleteCluster)
				cid.Post("/test", s.testCluster)
				cid.Get("/health", s.clusterHealth)
				cid.Get("/brokers", s.listBrokers)
				cid.Get("/topics", s.listTopics)
				cid.Post("/topics", s.createTopic)
				cid.Route("/topics/{topic}", func(tr chi.Router) {
					tr.Delete("/", s.deleteTopic)
					tr.Get("/partitions", s.listPartitions)
					tr.Get("/messages", s.fetchMessages)
					tr.Post("/messages", s.publishMessage)
				})
				cid.Get("/consumer-groups", s.listConsumerGroups)
				cid.Route("/consumer-groups/{groupID}", func(gr chi.Router) {
					gr.Post("/reset-offsets", s.resetOffsets)
				})
			})
		})
		api.Get("/audit", s.listAudit)
		api.Get("/search", s.globalSearch)
	})

	s.router = r
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
