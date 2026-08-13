package models

import (
	"time"

	"github.com/google/uuid"
)

type ClusterEnvironment string

const (
	EnvDevelopment ClusterEnvironment = "DEVELOPMENT"
	EnvStaging     ClusterEnvironment = "STAGING"
	EnvProduction  ClusterEnvironment = "PRODUCTION"
)

type Role string

const (
	RoleAdmin     Role = "ADMIN"
	RoleOperator  Role = "OPERATOR"
	RoleDeveloper Role = "DEVELOPER"
	RoleViewer    Role = "VIEWER"
)

type User struct {
	ID                uuid.UUID  `json:"id"`
	Email             string     `json:"email"`
	DisplayName       string     `json:"display_name"`
	PasswordHash      string     `json:"-"`
	Role              Role       `json:"role"`
	IsActive          bool       `json:"is_active"`
	TokenVersion      int        `json:"-"`
	LastLoginAt       *time.Time `json:"last_login_at,omitempty"`
	PasswordChangedAt *time.Time `json:"password_changed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type UserCreateRequest struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
	Role        Role   `json:"role"`
	IsActive    *bool  `json:"is_active"`
}

type UserUpdateRequest struct {
	DisplayName *string `json:"display_name"`
	Email       *string `json:"email"`
	Role        *Role   `json:"role"`
	IsActive    *bool   `json:"is_active"`
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
	Reason   string `json:"reason"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type RoleDefinition struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	Builtin     bool     `json:"builtin"`
}

type RoleRecord struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"is_system"`
	UserCount   int       `json:"user_count,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PermissionRecord struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Action      string `json:"action"`
	Description string `json:"description"`
}

type PermissionGroup struct {
	Category    string             `json:"category"`
	Permissions []PermissionRecord `json:"permissions"`
}

type RoleCreateRequest struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

type RoleUpdateRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

type Cluster struct {
	ID                 uuid.UUID          `json:"id"`
	Name               string             `json:"name"`
	BootstrapServers   string             `json:"bootstrap_servers"`
	KafkaVersion       string             `json:"kafka_version,omitempty"`
	Environment        ClusterEnvironment `json:"environment"`
	TLS                bool               `json:"tls"`
	SASLMechanism      string             `json:"sasl_mechanism,omitempty"`
	SASLUsername       string             `json:"-"`
	SASLEncrypted      string             `json:"-"`
	SchemaRegistryURL  string             `json:"schema_registry_url,omitempty"`
	ConnectURL         string             `json:"connect_url,omitempty"`
	Status             string             `json:"status"`
	LastConnectedAt    *time.Time         `json:"last_connected_at,omitempty"`
	LastError          string             `json:"last_error,omitempty"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}

type ClusterCreateRequest struct {
	Name              string             `json:"name"`
	BootstrapServers  string             `json:"bootstrap_servers"`
	KafkaVersion      string             `json:"kafka_version,omitempty"`
	Environment       ClusterEnvironment `json:"environment"`
	TLS               bool               `json:"tls"`
	SASLMechanism     string             `json:"sasl_mechanism,omitempty"`
	SASLUsername      string             `json:"sasl_username,omitempty"`
	SASLPassword      string             `json:"sasl_password,omitempty"`
	SchemaRegistryURL string             `json:"schema_registry_url,omitempty"`
	ConnectURL        string             `json:"connect_url,omitempty"`
}

type AuditLog struct {
	ID         uuid.UUID `json:"id"`
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	UserEmail  string    `json:"user_email,omitempty"`
	IPAddress  string    `json:"ip_address,omitempty"`
	ClusterID  *uuid.UUID `json:"cluster_id,omitempty"`
	Resource   string    `json:"resource"`
	Action     string    `json:"action"`
	Result     string    `json:"result"`
	Reason     string    `json:"reason,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type AlertRule struct {
	ID          uuid.UUID `json:"id"`
	ClusterID   uuid.UUID `json:"cluster_id"`
	Name        string    `json:"name"`
	RuleType    string    `json:"rule_type"`
	Threshold   float64   `json:"threshold"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
}

type AlertEvent struct {
	ID        uuid.UUID `json:"id"`
	RuleID    uuid.UUID `json:"rule_id"`
	ClusterID uuid.UUID `json:"cluster_id"`
	Severity  string    `json:"severity"`
	Message   string    `json:"message"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}
