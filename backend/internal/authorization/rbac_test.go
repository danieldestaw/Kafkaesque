package authorization_test

import (
	"testing"

	"github.com/kafkaesque/kafkaesque/internal/authorization"
	"github.com/kafkaesque/kafkaesque/internal/models"
)

func TestMatchPermission(t *testing.T) {
	granted := []string{"topic.read", "users.*"}
	if !authorization.MatchPermission(granted, "topic.read") {
		t.Fatal("exact match should work")
	}
	if !authorization.MatchPermission(granted, "users.create") {
		t.Fatal("wildcard should match")
	}
	if authorization.MatchPermission(granted, "cluster.read") {
		t.Fatal("ungranted should not match")
	}
}

func TestProductionProtection(t *testing.T) {
	if !authorization.CanModifyProduction(models.RoleAdmin, models.EnvProduction, false) {
		t.Fatal("admin can modify production")
	}
	if authorization.CanModifyProduction(models.RoleDeveloper, models.EnvProduction, false) {
		t.Fatal("developer cannot modify production")
	}
}

func TestSlugifyRoleID(t *testing.T) {
	if authorization.SlugifyRoleID("Manager Role") != "MANAGER_ROLE" {
		t.Fatal("slugify failed")
	}
}
