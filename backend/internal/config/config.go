package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	defaultJWTSecret     = "change-me-in-production-kafkaesque"
	defaultEncryptionKey = "0123456789abcdef0123456789abcdef"
	minJWTSecretLen      = 32
)

type Config struct {
	Env              string
	HTTPPort         string
	DatabaseURL      string
	RedisURL         string
	RedisEnabled     bool
	JWTSecret        string
	EncryptionKey    string
	CORSOrigins      []string
	SessionTTLHours  int
	DefaultAdminUser string
	DefaultAdminPass string
	OIDCEnabled      bool
	OIDCIssuer       string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCRedirectURL  string
	OIDCDefaultRole  string
	LocalLoginEnabled bool
}

func Load() Config {
	return Config{
		Env:              getEnv("APP_ENV", "development"),
		HTTPPort:         getEnv("HTTP_PORT", "8090"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://kafkaesque:kafkaesque@localhost:5433/kafkaesque?sslmode=disable"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379/1"),
		RedisEnabled:     getEnvBool("REDIS_ENABLED", false),
		JWTSecret:        getEnv("JWT_SECRET", defaultJWTSecret),
		EncryptionKey:    getEnv("ENCRYPTION_KEY", defaultEncryptionKey),
		CORSOrigins:      strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3100"), ","),
		SessionTTLHours:  getEnvInt("SESSION_TTL_HOURS", 24),
		DefaultAdminUser: getEnv("DEFAULT_ADMIN_USER", "admin"),
		DefaultAdminPass: getEnv("DEFAULT_ADMIN_PASS", "admin"),
		OIDCEnabled:      getEnvBool("OIDC_ENABLED", false),
		OIDCIssuer:       getEnv("OIDC_ISSUER", ""),
		OIDCClientID:     getEnv("OIDC_CLIENT_ID", ""),
		OIDCClientSecret: getEnv("OIDC_CLIENT_SECRET", ""),
		OIDCRedirectURL:  getEnv("OIDC_REDIRECT_URL", ""),
		OIDCDefaultRole:   getEnv("OIDC_DEFAULT_ROLE", "VIEWER"),
		LocalLoginEnabled: getEnvBool("LOCAL_LOGIN_ENABLED", true),
	}
}

func (c Config) IsProduction() bool {
	return strings.EqualFold(c.Env, "production")
}

// Validate rejects unsafe configuration when APP_ENV=production.
func (c Config) Validate() error {
	if !c.IsProduction() {
		return nil
	}

	var problems []string

	if strings.TrimSpace(c.DatabaseURL) == "" {
		problems = append(problems, "DATABASE_URL is required")
	}
	if len(c.JWTSecret) < minJWTSecretLen {
		problems = append(problems, fmt.Sprintf("JWT_SECRET must be at least %d characters", minJWTSecretLen))
	}
	if isWeakSecret(c.JWTSecret, defaultJWTSecret, "dev-kafkaesque-secret", "dev-kafkaesque-secret-change-in-prod") {
		problems = append(problems, "JWT_SECRET must not use a development default")
	}
	if len(c.EncryptionKey) != 32 {
		problems = append(problems, "ENCRYPTION_KEY must be exactly 32 bytes (use a 64-character hex string or 32 raw bytes)")
	}
	if c.EncryptionKey == defaultEncryptionKey {
		problems = append(problems, "ENCRYPTION_KEY must not use the development default")
	}
	if c.DefaultAdminPass == "admin" {
		problems = append(problems, "DEFAULT_ADMIN_PASS must not be the default \"admin\" in production")
	}
	if len(c.CORSOrigins) == 0 || (len(c.CORSOrigins) == 1 && strings.TrimSpace(c.CORSOrigins[0]) == "") {
		problems = append(problems, "CORS_ORIGINS must list at least one allowed origin")
	}
	for _, origin := range c.CORSOrigins {
		if origin == "*" {
			problems = append(problems, "CORS_ORIGINS must not use wildcard \"*\" in production")
			break
		}
	}

	if len(problems) == 0 {
		return nil
	}
	return fmt.Errorf("production configuration invalid: %s", strings.Join(problems, "; "))
}

func isWeakSecret(value string, blocked ...string) bool {
	for _, b := range blocked {
		if value == b {
			return true
		}
	}
	return false
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		return v == "true" || v == "1"
	}
	return fallback
}
