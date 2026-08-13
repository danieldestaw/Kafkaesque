# Production deployment

This guide covers running Kafkaesque in production using Docker Compose. For Kubernetes/Helm, see [ROADMAP.md](../ROADMAP.md) (planned v0.4).

## Overview

| Concern | Approach |
|---------|----------|
| Secrets | Required via `.env`; backend refuses weak defaults when `APP_ENV=production` |
| Database | PostgreSQL in Compose (small installs) or external managed Postgres |
| Public access | Frontend nginx only; API and DB not published |
| TLS | External load balancer **or** built-in nginx TLS overlay |
| Health | Liveness: `/health` · Readiness: `/health/ready` (includes DB ping) |
| Metrics | Prometheus `/metrics` — restrict at network or proxy layer |

## Quick start (production Compose)

### 1. Generate secrets

```bash
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh
```

### 2. Create `.env`

```bash
cp .env.production.example .env
```

Edit `.env`:

- Set `CORS_ORIGINS` to your public UI URL (e.g. `https://kafkaesque.example.com`)
- Paste generated `POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEFAULT_ADMIN_PASS`
- Set a non-default `DEFAULT_ADMIN_USER` if desired

**Important:** `ENCRYPTION_KEY` must be exactly **32 bytes** (use `openssl rand -hex 16`). Changing it after clusters are registered will break decryption of stored Kafka credentials.

### 3. Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production overlay effects:

- `APP_ENV=production` with startup validation
- PostgreSQL and API **not** exposed on host ports
- Only frontend published (default port **80**)
- `restart: unless-stopped` and memory limits
- Readiness healthcheck on backend

### 4. Verify

```bash
curl -s http://localhost/health
curl -s http://localhost/health/ready
```

Open the UI, sign in with your bootstrap admin credentials, and **change the admin password** under **Profile**.

## TLS options

### Option A — External load balancer (recommended)

Terminate TLS at AWS ALB, Cloudflare, Traefik, etc. Point it to `KAFKAESQUE_HTTP_PORT` (default 80). Set `CORS_ORIGINS` to your `https://` URL.

### Option B — nginx TLS in Compose

```bash
mkdir -p deploy/certs
# Place fullchain.pem and privkey.pem in deploy/certs/

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.prod.tls.yml \
  up -d --build
```

Set `CORS_ORIGINS=https://your-domain` and `KAFKAESQUE_HTTPS_PORT=443` in `.env`.

## External PostgreSQL

For managed Postgres, remove or disable the `kafkaesque-db` service and set in `.env`:

```env
DATABASE_URL=postgres://user:pass@your-db-host:5432/kafkaesque?sslmode=require
```

Ensure the backend container can reach the database over the network.

## Production validation (backend)

When `APP_ENV=production`, the backend **exits on startup** if:

| Check | Requirement |
|-------|-------------|
| `JWT_SECRET` | ≥ 32 characters, not a dev default |
| `ENCRYPTION_KEY` | Exactly 32 bytes, not the dev default |
| `DEFAULT_ADMIN_PASS` | Not `admin` |
| `CORS_ORIGINS` | At least one origin; no `*` wildcard |
| `DATABASE_URL` | Non-empty |

Development (`APP_ENV=development`) skips these checks so local `docker compose up` continues to work with defaults.

## Security hardening checklist

- [ ] Strong secrets in `.env` (never commit `.env`)
- [ ] Rotate bootstrap admin password after first login
- [ ] Restrict who receives `ADMIN` role; use Operator/Developer/Viewer where possible
- [ ] Place Kafkaesque in a private network with route access **only** to Kafka brokers
- [ ] Do not expose `/metrics` publicly
- [ ] Use TLS for UI and API in transit
- [ ] Use `sslmode=require` (or stricter) for external Postgres
- [ ] Back up PostgreSQL regularly (cluster metadata, users, audit, encrypted credentials)
- [ ] Register production Kafka clusters with appropriate SASL/TLS settings

## Connecting to Kafka in production

Kafkaesque connects **from the backend container** to your brokers. Bootstrap servers must be reachable from that network namespace — not from the user's browser.

Example cluster registration:

| Field | Example |
|-------|---------|
| Bootstrap servers | `kafka-1.internal:9092,kafka-2.internal:9092` |
| Environment | `PRODUCTION` |
| TLS / SASL | As required by your cluster |

Production cluster mutations (topic delete, offset reset) are permission-gated and restricted for `PRODUCTION` environment roles.

## Monitoring

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — process is running |
| `GET /health/ready` | Readiness — database reachable |
| `GET /metrics` | Prometheus metrics |

Configure your orchestrator or load balancer to use `/health/ready` for backend readiness.

## Upgrades

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Database migrations run automatically on backend startup.

## Development vs production

| | Development | Production |
|---|-------------|------------|
| Compose | `docker compose up` | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` |
| Secrets | Defaults in `docker-compose.yml` | Required in `.env` |
| Postgres port | `5433` on host | Not published |
| API port | `8090` on host | Not published |
| Validation | Relaxed | Strict startup checks |

## Limitations (v0.1)

Not included yet — plan accordingly:

- Helm chart / native Kubernetes manifests
- OIDC / SSO
- Built-in rate limiting and WAF
- High-availability multi-replica backend
- Schema Registry, Kafka Connect, ACL UI

Kafkaesque is suitable as an **internal operations tool** when deployed with the controls above. It is not a fully managed SaaS platform out of the box.
