# Architecture

StreamForge is a three-tier platform:

1. **React frontend** — developer-focused UI, TanStack Query, Tailwind
2. **Go backend** — Kafka admin via franz-go, REST API, JWT auth
3. **PostgreSQL** — users, clusters (encrypted secrets), audit logs

## Security

- Cluster SASL passwords encrypted at rest (AES-GCM)
- JWT session tokens
- RBAC enforced on every API route
- Message values rendered as text (never HTML)
- All publish/offset/topic mutations audited

## Kafka client

Uses `github.com/twmb/franz-go` for admin, consume, and produce operations.

## Multi-cluster

Each cluster record stores bootstrap servers and optional SASL/TLS config. The backend resolves connections per request — credentials never sent to the browser.
