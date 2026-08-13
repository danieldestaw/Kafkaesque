package authorization

import (
	"strings"

	"github.com/kafkaesque/kafkaesque/internal/models"
)

func MatchPermission(granted []string, required string) bool {
	for _, p := range granted {
		if p == required {
			return true
		}
		if len(p) > 2 && p[len(p)-2:] == ".*" {
			prefix := p[:len(p)-1]
			if len(required) >= len(prefix) && required[:len(prefix)] == prefix {
				return true
			}
		}
	}
	return false
}

func HasPermission(granted []string, required string) bool {
	return MatchPermission(granted, required)
}

func CanModifyProduction(role models.Role, env models.ClusterEnvironment, readOnly bool) bool {
	if readOnly {
		return false
	}
	if env != models.EnvProduction {
		return true
	}
	return role == models.RoleAdmin || role == models.RoleOperator
}

func SlugifyRoleID(name string) string {
	var b strings.Builder
	prevUnderscore := false
	for _, r := range strings.ToUpper(strings.TrimSpace(name)) {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevUnderscore = false
			continue
		}
		if !prevUnderscore && b.Len() > 0 {
			b.WriteRune('_')
			prevUnderscore = true
		}
	}
	return strings.Trim(b.String(), "_")
}
