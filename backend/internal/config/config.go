package config

import (
	"os"
	"strconv"
	"strings"
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
}

func Load() Config {
	return Config{
		Env:              getEnv("APP_ENV", "development"),
		HTTPPort:         getEnv("HTTP_PORT", "8090"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://streamforge:streamforge@localhost:5433/streamforge?sslmode=disable"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379/1"),
		RedisEnabled:     getEnvBool("REDIS_ENABLED", false),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production-streamforge"),
		EncryptionKey:    getEnv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef"),
		CORSOrigins:      strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3100"), ","),
		SessionTTLHours:  getEnvInt("SESSION_TTL_HOURS", 24),
		DefaultAdminUser: getEnv("DEFAULT_ADMIN_USER", "admin"),
		DefaultAdminPass: getEnv("DEFAULT_ADMIN_PASS", "admin"),
	}
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
