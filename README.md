# Kafkaesque

**Kafkaesque** is an open-source Kafka management and observability platform.

Kafka management & observability

Apache License 2.0

## Features (v0.1)

- Multi-cluster management with encrypted credentials (server-side only)
- Real Kafka connectivity via Go backend (franz-go)
- Topics: list, create, delete, partition inspection
- Message browser and producer with audit logging
- Consumer groups and lag monitoring
- Dashboard with live cluster health metrics
- RBAC (Admin, Operator, Developer, Viewer)
- Audit log for sensitive operations
- Dark/light mode
- Docker Compose deployment
- Connects to external Kafka clusters (e.g. banking-service)

## Quick Start

```bash
cd streamforge
docker compose up -d --build
```

Open http://localhost:3100

**Default login:** `admin` / `admin`

## Connect to Banking Service Kafka

1. Ensure `banking-service` Kafka is running (`banking-service_banking-net` network)
2. Start StreamForge: `docker compose up -d --build`
3. Open http://localhost:3100 and sign in (`admin` / `admin`)
4. Go to **Clusters** → Add cluster:
   - Name: `Banking Kafka`
   - Bootstrap: `kafka:9092` (Docker DNS on the shared network — not `localhost`)
   - Environment: `DEVELOPMENT`

StreamForge backend joins the `banking-service_banking-net` external network. The metadata database uses the service name `streamforge-db` to avoid DNS conflicts with banking-service's `postgres` container.

## Acceptance workflow

After `docker compose up -d`:

1. Login at http://localhost:3100
2. Add cluster `kafka:9092`
3. Verify brokers, topics, consumer groups, and dashboard metrics
4. Browse messages on any topic with traffic (or publish to `streamforge-test`)
5. Confirm publish appears in the audit log

## Architecture

```
Browser → React UI (nginx) → Go API → Kafka Cluster
                              ↓
                         PostgreSQL (metadata, audit, users)
```

The browser **never** connects directly to Kafka.

## Development

```bash
# Backend (requires Go 1.23+)
cd backend && go run ./cmd/streamforge

# Frontend
cd frontend && npm install && npm run dev
```

## Testing against banking-service

With banking-service running:

```bash
docker compose up -d --build
curl -X POST http://localhost:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin","password":"admin"}'
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for Schema Registry, Kafka Connect, ACLs, Helm, and alerting.

## License

Apache License 2.0 — see [LICENSE](LICENSE)
