package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/kafkaesque/kafkaesque/internal/models"
)

func (s *Server) oidcLogin(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.OIDCEnabled || s.oidcOAuth == nil {
		writeError(w, http.StatusNotFound, "NOT_ENABLED", "OIDC is not enabled")
		return
	}
	state := randomState()
	http.SetCookie(w, &http.Cookie{
		Name:     "oidc_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   600,
		SameSite: http.SameSiteLaxMode,
	})
	url := s.oidcOAuth.AuthCodeURL(state)
	http.Redirect(w, r, url, http.StatusFound)
}

func (s *Server) oidcCallback(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.OIDCEnabled || s.oidcOAuth == nil {
		writeError(w, http.StatusNotFound, "NOT_ENABLED", "OIDC is not enabled")
		return
	}
	stateCookie, err := r.Cookie("oidc_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		writeError(w, http.StatusBadRequest, "INVALID_STATE", "OIDC state mismatch")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		writeError(w, http.StatusBadRequest, "NO_CODE", "Missing authorization code")
		return
	}
	token, err := s.oidcOAuth.Exchange(r.Context(), code)
	if err != nil {
		writeError(w, http.StatusBadGateway, "OIDC_ERROR", err.Error())
		return
	}
	email, name, err := s.fetchOIDCUserInfo(r.Context(), token.AccessToken)
	if err != nil {
		writeError(w, http.StatusBadGateway, "OIDC_ERROR", err.Error())
		return
	}
	role := models.Role(strings.ToUpper(s.cfg.OIDCDefaultRole))
	if role == "" {
		role = models.RoleViewer
	}
	user, err := s.store.GetUserByEmailOrCreateOIDC(r.Context(), email, name, role)
	if err != nil || !user.IsActive {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Unable to provision user")
		return
	}
	jwt, err := s.auth.IssueToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "TOKEN_ERROR", "Failed to issue token")
		return
	}
	redirectBase := "http://localhost:3100"
	if len(s.cfg.CORSOrigins) > 0 && strings.TrimSpace(s.cfg.CORSOrigins[0]) != "" {
		redirectBase = strings.TrimRight(s.cfg.CORSOrigins[0], "/")
	}
	http.Redirect(w, r, redirectBase+"/login?token="+jwt, http.StatusFound)
}

func (s *Server) fetchOIDCUserInfo(ctx context.Context, accessToken string) (email, name string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(s.cfg.OIDCIssuer, "/")+"/userinfo", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer res.Body.Close()
	var info map[string]any
	if err := json.NewDecoder(res.Body).Decode(&info); err != nil {
		return "", "", err
	}
	email, _ = info["email"].(string)
	name, _ = info["name"].(string)
	if name == "" {
		name = email
	}
	if email == "" {
		return "", "", fmt.Errorf("oidc userinfo missing email")
	}
	return email, name, nil
}

func randomState() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
