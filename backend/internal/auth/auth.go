package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/kafkaesque/kafkaesque/internal/models"
	"github.com/kafkaesque/kafkaesque/internal/storage"
)

type contextKey string

const UserContextKey contextKey = "user"

type Claims struct {
	UserID       uuid.UUID   `json:"user_id"`
	Email        string      `json:"email"`
	Role         models.Role `json:"role"`
	TokenVersion int         `json:"token_version"`
	jwt.RegisteredClaims
}

type Service struct {
	store  *storage.Store
	secret []byte
	ttl    time.Duration
}

func NewService(store *storage.Store, secret string, ttlHours int) *Service {
	return &Service{
		store:  store,
		secret: []byte(secret),
		ttl:    time.Duration(ttlHours) * time.Hour,
	}
}

func (s *Service) Login(ctx context.Context, email, password, ip string) (string, *models.User, error) {
	email = storage.NormalizeEmail(email)
	user, err := s.store.GetUserByEmailAny(ctx, email)
	if err != nil {
		s.recordLoginAudit(ctx, nil, email, ip, "LOGIN_FAILURE", "invalid credentials")
		return "", nil, errors.New("invalid credentials")
	}
	if !user.IsActive {
		s.recordLoginAudit(ctx, &user.ID, email, ip, "LOGIN_FAILURE", "account disabled")
		return "", nil, errors.New("invalid credentials")
	}
	if err := storage.VerifyPassword(user.PasswordHash, password); err != nil {
		s.recordLoginAudit(ctx, &user.ID, email, ip, "LOGIN_FAILURE", "invalid credentials")
		return "", nil, errors.New("invalid credentials")
	}
	_ = s.store.UpdateLastLogin(ctx, user.ID)
	user, _ = s.store.GetUserByID(ctx, user.ID)
	token, err := s.issueToken(user)
	if err != nil {
		return "", nil, err
	}
	s.recordLoginAudit(ctx, &user.ID, email, ip, "LOGIN_SUCCESS", "")
	return token, user, nil
}

func (s *Service) recordLoginAudit(ctx context.Context, userID *uuid.UUID, email, ip, action, reason string) {
	result := "SUCCESS"
	if action == "LOGIN_FAILURE" {
		result = "FAILURE"
	}
	_ = s.store.InsertAudit(ctx, models.AuditLog{
		UserID:    userID,
		UserEmail: email,
		IPAddress: ip,
		Resource:  "auth:login",
		Action:    action,
		Result:    result,
		Reason:    reason,
	})
}

func (s *Service) issueToken(user *models.User) (string, error) {
	claims := Claims{
		UserID:       user.ID,
		Email:        user.Email,
		Role:         user.Role,
		TokenVersion: user.TokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(s.secret)
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *Service) IssueToken(user *models.User) (string, error) {
	return s.issueToken(user)
}

func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		claims, err := s.ParseToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		user, err := s.store.GetUserByID(r.Context(), claims.UserID)
		if err != nil || !user.IsActive {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if claims.TokenVersion != user.TokenVersion {
			http.Error(w, `{"error":"session revoked"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) (*models.User, bool) {
	user, ok := ctx.Value(UserContextKey).(*models.User)
	return user, ok
}
