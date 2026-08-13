package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/kafkaesque/kafkaesque/internal/api"
	"github.com/kafkaesque/kafkaesque/internal/config"
	"github.com/kafkaesque/kafkaesque/internal/storage"
)

func testServer(t *testing.T) *api.Server {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	store, err := storage.New(ctx, url)
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	t.Cleanup(store.Close)

	if err := store.EnsureAdmin(ctx, "admin", "admin"); err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	cfg := config.Config{
		JWTSecret:       "test-secret",
		SessionTTLHours: 24,
		CORSOrigins:     []string{"*"},
		EncryptionKey:   "0123456789abcdef0123456789abcdef",
	}
	return api.NewServer(cfg, store)
}

func adminToken(t *testing.T, srv *api.Server) string {
	t.Helper()
	return loginToken(t, srv, "admin", "admin")
}

func loginToken(t *testing.T, srv *api.Server, email, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("login status %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	return resp.Token
}

func authRequest(method, path, token string, body any) *http.Request {
	var r *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	} else {
		r = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, r)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestUsersCRUD(t *testing.T) {
	srv := testServer(t)
	token := adminToken(t, srv)

	// Create user
	createBody := map[string]any{
		"email":        "dev@kafkaesque.local",
		"display_name": "Dev User",
		"password":     "secret12",
		"role":         "DEVELOPER",
	}
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodPost, "/api/v1/users", token, createBody))
	if rec.Code != http.StatusCreated {
		t.Fatalf("create user: %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&created)

	// List users
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodGet, "/api/v1/users", token, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("list users: %d", rec.Code)
	}

	// Reset password
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodPost, "/api/v1/users/"+created.ID+"/reset-password", token, map[string]string{
		"password": "newpass1",
		"reason":   "test",
	}))
	if rec.Code != http.StatusOK {
		t.Fatalf("reset password: %d %s", rec.Code, rec.Body.String())
	}

	// Disable user
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodPost, "/api/v1/users/"+created.ID+"/disable", token, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("disable: %d", rec.Code)
	}

	// Delete user
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodDelete, "/api/v1/users/"+created.ID, token, nil))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", rec.Code)
	}
}

func TestListRoles(t *testing.T) {
	srv := testServer(t)
	token := adminToken(t, srv)
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodGet, "/api/v1/roles", token, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("roles: %d %s", rec.Code, rec.Body.String())
	}
}

func TestChangeOwnPassword(t *testing.T) {
	srv := testServer(t)
	admin := adminToken(t, srv)

	// Create a user to test self-service password change (non-admin role).
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodPost, "/api/v1/users", admin, map[string]any{
		"email": "pwtest@kafkaesque.local", "display_name": "PW Test",
		"password": "oldpass1", "role": "VIEWER",
	}))
	if rec.Code != http.StatusCreated {
		t.Fatalf("create user: %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&created)
	defer func() {
		rec = httptest.NewRecorder()
		srv.Router().ServeHTTP(rec, authRequest(http.MethodDelete, "/api/v1/users/"+created.ID, admin, nil))
	}()

	token := loginToken(t, srv, "pwtest@kafkaesque.local", "oldpass1")

	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodPost, "/api/v1/me/password", token, map[string]string{
		"current_password": "oldpass1",
		"new_password":     "newpass1",
	}))
	if rec.Code != http.StatusOK {
		t.Fatalf("change password: %d %s", rec.Code, rec.Body.String())
	}

	// Old token should be revoked
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodGet, "/api/v1/me", token, nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected revoked token, got %d", rec.Code)
	}

	// New password works
	newToken := loginToken(t, srv, "pwtest@kafkaesque.local", "newpass1")
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, authRequest(http.MethodGet, "/api/v1/me", newToken, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("me after password change: %d", rec.Code)
	}
}
