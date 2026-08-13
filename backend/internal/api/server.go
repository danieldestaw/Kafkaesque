package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/kafkaesque/kafkaesque/internal/auth"
	"github.com/kafkaesque/kafkaesque/internal/config"
	"github.com/kafkaesque/kafkaesque/internal/kafkaclient"
	"github.com/kafkaesque/kafkaesque/internal/kafkaconnect"
	"github.com/kafkaesque/kafkaesque/internal/schemaregistry"
	"github.com/kafkaesque/kafkaesque/internal/storage"
	"golang.org/x/oauth2"
)

type Server struct {
	cfg       config.Config
	store     *storage.Store
	auth      *auth.Service
	kafka     *kafkaclient.Service
	schema    *schemaregistry.Client
	connect   *kafkaconnect.Client
	oidcOAuth *oauth2.Config
	router    chi.Router
}

func NewServer(cfg config.Config, store *storage.Store) *Server {
	s := &Server{
		cfg:     cfg,
		store:   store,
		auth:    auth.NewService(store, cfg.JWTSecret, cfg.SessionTTLHours),
		kafka:   kafkaclient.NewService(cfg.EncryptionKey),
		schema:  schemaregistry.NewClient(),
		connect: kafkaconnect.NewClient(),
	}
	if cfg.OIDCEnabled {
		issuer := strings.TrimRight(cfg.OIDCIssuer, "/")
		s.oidcOAuth = &oauth2.Config{
			ClientID:     cfg.OIDCClientID,
			ClientSecret: cfg.OIDCClientSecret,
			RedirectURL:  cfg.OIDCRedirectURL,
			Endpoint: oauth2.Endpoint{
				AuthURL:  issuer + "/authorize",
				TokenURL: issuer + "/token",
			},
			Scopes: []string{"openid", "email", "profile"},
		}
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
	r.Use(securityHeaders)
	if s.cfg.IsProduction() {
		r.Use(middleware.Timeout(60 * time.Second))
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		AllowCredentials: true,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "kafkaesque"})
	})
	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		if err := s.store.Ping(r.Context()); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"status":  "not_ready",
				"service": "kafkaesque",
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "kafkaesque"})
	})
	r.Handle("/metrics", promhttp.Handler())

	r.Get("/api/v1/auth/config", s.authConfig)
	r.Post("/api/v1/auth/login", s.login)
	r.Get("/api/v1/auth/oidc/login", s.oidcLogin)
	r.Get("/api/v1/auth/oidc/callback", s.oidcCallback)
	r.Get("/api/v1/clusters/{clusterID}/topics/{topic}/live", s.liveTailUpgrade)

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
		api.Get("/audit", s.listAudit)
		api.Get("/search", s.globalSearch)
		api.Get("/alerts/events", s.listAlertEvents)
		api.Post("/alerts/events/{eventID}/resolve", s.resolveAlertEvent)
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
				cid.Get("/schemas", s.listSchemas)
				cid.Get("/schemas/{subject}", s.getSchema)
				cid.Post("/schemas/{subject}", s.registerSchema)
				cid.Get("/connectors", s.listConnectors)
				cid.Post("/connectors", s.createConnector)
				cid.Route("/connectors/{connector}", func(conn chi.Router) {
					conn.Delete("/", s.deleteConnector)
					conn.Post("/restart", s.restartConnector)
				})
				cid.Get("/acls", s.listACLs)
				cid.Post("/acls", s.createACL)
				cid.Delete("/acls", s.deleteACL)
				cid.Get("/alert-rules", s.listAlertRules)
				cid.Post("/alert-rules", s.createAlertRule)
				cid.Post("/alert-rules/evaluate", s.evaluateAlertsNow)
				cid.Delete("/alert-rules/{ruleID}", s.deleteAlertRule)
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

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}
