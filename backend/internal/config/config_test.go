package config_test

import (
	"os"
	"testing"

	"github.com/kafkaesque/kafkaesque/internal/config"
)

func TestValidateDevelopmentAllowsDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected no error in development, got: %v", err)
	}
}

func TestValidateProductionRejectsDefaults(t *testing.T) {
	env := map[string]string{
		"APP_ENV":            "production",
		"DATABASE_URL":       "postgres://user:pass@db:5432/kafkaesque?sslmode=require",
		"JWT_SECRET":         "change-me-in-production-kafkaesque",
		"ENCRYPTION_KEY":     "0123456789abcdef0123456789abcdef",
		"DEFAULT_ADMIN_PASS": "admin",
		"CORS_ORIGINS":       "http://localhost:3100",
	}
	for k, v := range env {
		t.Setenv(k, v)
	}
	cfg := config.Load()
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected production validation error")
	}
}

func TestValidateProductionAcceptsStrongConfig(t *testing.T) {
	env := map[string]string{
		"APP_ENV":            "production",
		"DATABASE_URL":       "postgres://user:pass@db:5432/kafkaesque?sslmode=require",
		"JWT_SECRET":         "super-secret-jwt-key-at-least-32-chars-long",
		"ENCRYPTION_KEY":     "fedcba9876543210fedcba9876543210",
		"DEFAULT_ADMIN_PASS": "Str0ng!InitPass",
		"CORS_ORIGINS":       "https://kafkaesque.example.com",
	}
	for k, v := range env {
		t.Setenv(k, v)
	}
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected valid production config, got: %v", err)
	}
}

func TestValidateProductionRejectsWildcardCORS(t *testing.T) {
	for k := range os.Environ() {
		// reset not needed; t.Setenv overrides per test
		_ = k
	}
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://user:pass@db:5432/kafkaesque?sslmode=require")
	t.Setenv("JWT_SECRET", "super-secret-jwt-key-at-least-32-chars-long")
	t.Setenv("ENCRYPTION_KEY", "fedcba9876543210fedcba9876543210")
	t.Setenv("DEFAULT_ADMIN_PASS", "Str0ng!InitPass")
	t.Setenv("CORS_ORIGINS", "*")

	cfg := config.Load()
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected wildcard CORS to be rejected")
	}
}
