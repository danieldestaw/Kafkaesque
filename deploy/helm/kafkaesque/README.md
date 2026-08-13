# Kafkaesque Helm Chart

Deploy Kafkaesque to Kubernetes.

## Prerequisites

- Kubernetes 1.25+
- Helm 3
- PostgreSQL (bundled Bitnami chart optional) or external `DATABASE_URL`

## Install

```bash
# Generate secrets (32+ char JWT, 32-byte encryption key)
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 16)

helm upgrade --install kafkaesque ./deploy/helm/kafkaesque \
  --set secrets.jwtSecret="$JWT_SECRET" \
  --set secrets.encryptionKey="$ENCRYPTION_KEY" \
  --set env.CORS_ORIGINS="https://kafkaesque.example.com" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=kafkaesque.example.com
```

## Enterprise configuration

| Value | Description |
|-------|-------------|
| `env.OIDC_ENABLED` | Enable SSO login |
| `env.LOCAL_LOGIN_ENABLED` | Allow password login alongside OIDC |
| `postgresql.*` | Database credentials |

Set OIDC via additional env vars on the backend deployment (issuer, client ID, secret, redirect URL) — extend `values.yaml` or use `helm --set-file` for your IdP.

## Health checks

- Liveness: `GET /health`
- Readiness: `GET /health/ready` (includes DB ping)
