# Roadmap

## v1.0 — Enterprise (current)

- **Auth:** Local login + OIDC/SSO (`OIDC_ENABLED`, optional `LOCAL_LOGIN_ENABLED=false`)
- **Kafka:** TLS, PLAIN, SCRAM-SHA-256/512 cluster connections
- **Schema Registry:** List subjects, view versions, register schemas
- **Kafka Connect:** List connectors, restart, delete
- **ACLs:** List, create, delete via Kafka Admin API
- **Alerts:** Lag and offline-partition rules with background evaluator
- **Messages:** Tail mode, cursor pagination, WebSocket live tail
- **Ops:** Production Docker Compose, readiness probe, Helm chart
- **RBAC:** Roles, permissions, audit log, user management

## v1.1 (planned)

- Alert webhooks (Slack, PagerDuty, email)
- Schema Registry compatibility checks and diff view
- Connect connector create/edit UI
- mTLS client certificates for Kafka clusters
- Grafana dashboards bundle

## v1.2 (planned)

- Multi-tenant organizations
- Plugin architecture for custom integrations
- Kafka Streams / ksqlDB observability
