# Kafkaesque

**Kafkaesque** is an open-source Kafka management and observability platform. It provides a web UI and REST API for managing multiple Apache Kafka clusters, with role-based access control, audit logging, and a live operations dashboard.

The browser **never** connects directly to Kafka. All cluster credentials are stored encrypted on the server and used only by the Go backend.

**License:** [Apache License 2.0](LICENSE) · **GitHub:** [github.com/mrdrobotE/Kafkaesque](https://github.com/mrdrobotE/Kafkaesque)

---

## Features (v1.0 Enterprise)

- **Multi-cluster management** — TLS, PLAIN, SCRAM-SHA-256/512, Schema Registry & Connect URLs per cluster; test connection; remove from Kafkaesque without touching the real cluster
- **Operations dashboard** — one-screen KPI cards, cluster overview (inventory + live activity), health donut, top topics, recent audit activity, cluster load bars, status footer (version, uptime, auto-refresh)
- **Brokers & topics** — list brokers with role/controller/partition counts; topic partition & ISR details; internal topics clearly marked; row action menus
- **Messages** — tail latest messages, cursor pagination, **WebSocket live tail**
- **Schema Registry** — list subjects, view schemas, register Avro/JSON schemas
- **Kafka Connect** — list connectors with task/worker status, restart, delete; connector detail drawer
- **ACLs** — list, create, delete Kafka ACLs with filters and broad-permission warnings (when cluster authorization is enabled)
- **Alerts** — consumer lag and offline-partition rules with background evaluator
- **Consumer groups** — list groups with lag, reset offsets (permission-gated)
- **Authentication** — JWT sessions, bootstrap admin, **OIDC/SSO** (optional)
- **Users & IAM** — user CRUD, enable/disable, password reset, session revocation
- **RBAC** — database-backed roles and permissions (Admin, Operator, Developer, Viewer)
- **Audit log** — sensitive operations recorded; notification bell in header
- **Production** — hardened Docker Compose, readiness probes, **Helm chart** (`deploy/helm/kafkaesque`)
- **Global search** — command palette (`Ctrl+K` / `⌘K`)
- **UI** — royal-blue design system, collapsible sidebar, dark/light mode, responsive layout (desktop through mobile)

See [ROADMAP.md](ROADMAP.md) for upcoming v1.1+ items.

---

## Architecture

```
Browser → React UI (nginx) → Go REST API → Kafka Cluster
                              ↓
                         PostgreSQL (metadata, users, audit, RBAC)
```

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, TanStack Query, Tailwind CSS, Recharts |
| Backend | Go 1.23, chi router, franz-go, JWT, bcrypt, Prometheus |
| Database | PostgreSQL 16 |
| Deployment | Docker Compose, nginx |

More detail: [docs/architecture.md](docs/architecture.md)

---

## Project structure

```
Kafkaesque/
├── backend/
│   ├── cmd/kafkaesque/           # Application entrypoint
│   └── internal/
│       ├── api/                  # HTTP handlers and router
│       ├── auth/                 # JWT authentication
│       ├── authorization/        # RBAC permission matching
│       ├── crypto/               # AES-GCM for cluster secrets
│       ├── kafkaclient/          # franz-go Kafka operations
│       ├── models/               # Domain types
│       └── storage/              # PostgreSQL store and SQL migrations
├── examples/
│   └── kafka-test/               # Self-contained multi-service Kafka demo
├── frontend/
│   └── src/
│       ├── api/                  # Typed API client
│       ├── auth/                 # Permission hooks
│       ├── components/           # UI, dashboard, dialogs, RBAC
│       ├── context/              # Cluster, toast, dialog providers
│       ├── layouts/              # App shell and navigation
│       └── pages/                # Route pages (including admin/)
├── docs/
│   ├── architecture.md
│   └── production.md
├── docker-compose.yml
├── docker-compose.prod.yml      # Production overlay (secrets, no public DB/API ports)
├── docker-compose.prod.tls.yml  # Optional TLS at nginx
├── docker-compose.test-kafka.yml
├── Dockerfile                   # Single image (UI + API)
├── docker-compose.single.yml
├── docker-compose.single.hub.yml
├── docker-compose.hub.yml       # Split images from Docker Hub
├── .env.production.example
├── scripts/generate-secrets.sh
├── scripts/publish-dockerhub.sh
├── LICENSE
└── ROADMAP.md
```

---

## Installation (Docker Compose)

### Prerequisites

- Docker and Docker Compose v2+
- Ports **3100** (UI) and **8090** (API) available

### Quick start

```bash
cd Kafkaesque
docker compose up -d --build
```

Open **http://localhost:3100**

| Field | Default |
|-------|---------|
| Username / email | `admin` |
| Password | `admin` |

Change default credentials in production (see Configuration).

### Acceptance workflow

1. Sign in at http://localhost:3100
2. Go to **Clusters** → add a cluster (see [Multi-Service Kafka Test Environment](#multi-service-kafka-test-environment) below)
3. Verify **Brokers**, **Topics**, **Consumers**, and **Dashboard**
4. Browse or publish a message; confirm the action appears in **Audit**

---

## Multi-Service Kafka Test Environment

A self-contained demo stack lives in `examples/kafka-test/`. It uses synthetic data only — no external projects or business-specific payloads.

```
Producer
   ↓
Kafka (topic: orders, 3 partitions)
   ├── Service A  (consumer-group-a)
   ├── Service B  (consumer-group-b)
   └── Service C  (consumer-group-c)
```

| Component | Description |
|-----------|-------------|
| `kafka` | Single-node KRaft broker (`apache/kafka:3.8.0`) |
| `producer` | Emits synthetic `order.created` JSON events every 2s |
| `service-a/b/c` | Independent console consumers, each with its own consumer group |

### 1. Start the test Kafka environment

```bash
cd examples/kafka-test
docker compose up -d
```

Verify services are running:

```bash
docker compose ps
docker compose logs -f producer service-a
```

Kafka is exposed on **localhost:9092** and creates Docker network **`kafkaesque-test`**.

### 2. Start Kafkaesque connected to the test cluster

From the project root (start the test environment first):

```bash
docker compose -f docker-compose.yml -f docker-compose.test-kafka.yml up -d --build
```

The override file attaches the Kafkaesque backend to `kafkaesque-test` so it can reach the broker at `kafka:9092`.

### 3. Register the cluster in Kafkaesque

1. Open **http://localhost:3100** and sign in (`admin` / `admin`)
2. Go to **Clusters** → **Add cluster**
3. Use these settings:

| Field | Value |
|-------|-------|
| Name | `Demo Kafka` |
| Bootstrap servers | `kafka:9092` |
| Environment | `DEVELOPMENT` |
| Security | PLAINTEXT (no SASL/TLS) |

4. Click **Test connection**, then save

**Local backend dev** (Go running on the host, not in Docker): use bootstrap `localhost:9092` instead.

### 4. Explore in Kafkaesque

| View | Where |
|------|-------|
| Dashboard | **Dashboard** — KPIs, cluster overview, health, top topics, audit feed, cluster load |
| Clusters | **Clusters** — add/test/remove connections (actions menu on each row) |
| Brokers | **Brokers** — broker ID, host, controller role, partition leadership |
| Topics | **Topics** — partitions, RF, internal vs user topics; browse/produce from actions menu |
| Partitions | **Topics** → View → partition table (leader, ISR, message counts) |
| Consumer groups | **Consumers** — `consumer-group-a`, `-b`, `-c` |
| Consumer lag | **Consumers** → select a group; **Dashboard** cluster load widget |
| Connect | **Connect** — connector state, tasks, workers (requires `connect_url` on cluster) |
| ACLs | **ACLs** — when authorization is enabled on the broker |
| Messages | **Messages** → topic `orders` (tail latest by default; see [Messages](#messages)) |

See [Test Messages with the demo Kafka environment](#test-messages-with-the-demo-kafka-environment) for a step-by-step walkthrough.

### 5. Generate and recover consumer lag

Stop Service B while the producer keeps running:

```bash
cd examples/kafka-test
docker compose stop service-b
```

Wait ~30 seconds, then in Kafkaesque open **Consumers** → `consumer-group-b` and note the increasing lag.

Restart Service B and watch lag decrease:

```bash
docker compose start service-b
docker compose logs -f service-b
```

Services A and C continue consuming independently throughout.

### 6. Produce additional messages

**Via the demo producer** — already running; adjust rate:

```bash
docker compose up -d producer
```

**Via Kafkaesque UI** — open **Messages**, select topic `orders`, and use **Produce message**. See [Messages](#messages) for tail and lookup browsing.

**Via Kafka CLI** (from the kafka container):

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server kafka:9092 --topic orders
```

### 7. Tear down

```bash
# Stop demo stack
cd examples/kafka-test && docker compose down

# Stop Kafkaesque
cd ../.. && docker compose down
```

---

## Configuration

### Backend environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | Environment label |
| `HTTP_PORT` | `8090` | API listen port |
| `DATABASE_URL` | `postgres://kafkaesque:kafkaesque@localhost:5433/kafkaesque?sslmode=disable` | PostgreSQL DSN |
| `JWT_SECRET` | (dev default) | JWT signing secret — **change in production** |
| `ENCRYPTION_KEY` | 32-byte hex | AES-GCM key for cluster SASL passwords — **change in production** |
| `CORS_ORIGINS` | `http://localhost:3100` | Comma-separated allowed origins |
| `SESSION_TTL_HOURS` | `24` | JWT session lifetime |
| `DEFAULT_ADMIN_USER` | `admin` | Bootstrap admin username (first run only) |
| `DEFAULT_ADMIN_PASS` | `admin` | Bootstrap admin password (first run only) |
| `REDIS_URL` | `redis://localhost:6379/1` | Optional Redis URL |
| `REDIS_ENABLED` | `false` | Enable Redis (optional) |

Values are set in `docker-compose.yml` for the containerized stack.

### Docker services

| Service | Host port | Description |
|---------|-----------|-------------|
| `frontend` | 3100 | React SPA (nginx) |
| `backend` | 8090 | Go API |
| `kafkaesque-db` | 5433 | PostgreSQL |

---

## Local development

### Database only (Docker)

```bash
docker compose up -d kafkaesque-db
```

### Backend (Go 1.23+)

```bash
cd backend

export DATABASE_URL="postgres://kafkaesque:kafkaesque@localhost:5433/kafkaesque?sslmode=disable"
export JWT_SECRET="dev-kafkaesque-secret"
export ENCRYPTION_KEY="0123456789abcdef0123456789abcdef"
export HTTP_PORT=8090
export CORS_ORIGINS="http://localhost:3100"

go run ./cmd/kafkaesque
```

Migrations run automatically on startup.

### Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173 — proxies API to :8090
npm run build  # production build → frontend/dist/
```

Vite dev server proxies `/api` and `/health` to `http://localhost:8090` (see `frontend/vite.config.ts`). The Docker frontend is served on **http://localhost:3100**.

### Enterprise demo overlay (Schema Registry, Connect, ACLs)

```bash
cd examples/kafka-test
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d

cd ../..
docker compose -f docker-compose.yml -f docker-compose.test-kafka.yml up -d --build
```

Register a cluster with bootstrap `kafka:9092` and optional Schema Registry / Connect URLs from the enterprise compose file. See [docs/enterprise-ui-test.md](docs/enterprise-ui-test.md) for a UI verification checklist.

---

## Kafka / cluster management

1. Sign in and open **Clusters**
2. **Add cluster** — name, bootstrap servers, environment (`DEVELOPMENT`, `STAGING`, `PRODUCTION`), optional TLS/SASL
3. **Test connection** before saving
4. Select the cluster from the header dropdown

For a local demo cluster, use the [Multi-Service Kafka Test Environment](#multi-service-kafka-test-environment).

---

## Messages

The **Messages** page lets you inspect and publish records for a selected topic. All reads go through the backend (`message.read` permission); publishing requires `message.publish` (included in Admin, Operator, and Developer roles by default).

### Default: tail latest (all partitions)

When **Partition** and **Offset** are both empty — the default on page load — Kafkaesque runs in **tail mode**:

- Fetches the **latest 50 messages** across **all partitions** of the selected topic
- Merges results and sorts them **newest first** by timestamp
- Displays: **“Showing latest 50 messages across all partitions”**
- Shows partition, offset, timestamp, key, and value for each record
- Click a row to open the **message drawer** (formatted JSON or raw value, plus headers)

If more history exists, a **Show older messages** button appears below the table. Each click loads the next 50 older messages and **appends** them to the table (duplicates are skipped). The status line updates to show the total count loaded. **Refresh** resets tail pagination and reloads from the latest messages.

Select a topic from the dropdown, or open **Messages** from **Topics** (link includes `?topic=…` in the URL).

### Lookup mode: partition and offset

Fill in **Partition** and/or **Offset** to switch to **lookup mode** for precise inspection of a single partition:

| Partition | Offset | Behavior |
|-----------|--------|----------|
| empty | empty | **Tail mode** — latest 50 across all partitions |
| `0` | empty | Partition 0, from the earliest available offset, up to 50 messages |
| empty | `123` | Partition 0, starting at offset `123`, up to 50 messages |
| `2` | `50` | Partition 2, starting at offset `50`, up to 50 messages |

Clear both fields to return to tail mode. Changing topic, partition, or offset resets tail pagination.

Internal topics (e.g. `__consumer_offsets`) appear in the topic list but are usually not useful for message browsing.

### Produce messages

Click **Produce message** (header action) to open the publish dialog. Choose a topic, optional key and partition, and a JSON value. Published records appear in the audit log. After publishing, use **Refresh** on the Messages page to see new records in tail mode.

Requires the `message.publish` permission.

### REST API

```
GET  /api/v1/clusters/{clusterID}/topics/{topic}/messages
POST /api/v1/clusters/{clusterID}/topics/{topic}/messages
```

**Tail mode** (no `partition` or `offset` query params):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `50` | Max messages to return (max 500) |
| `cursor` | — | Opaque pagination token from a previous tail response |

Response includes `"mode": "tail"`, `"has_more": true/false`, and `"cursor"` for the next page.

**Lookup mode** (when `partition` and/or `offset` is set):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `partition` | `0` if omitted | Partition to read |
| `offset` | earliest | Starting offset; omit to read from the beginning of the partition |
| `limit` | `100` | Max messages to return (max 500) |

Response includes `"mode": "lookup"`.

Example — tail latest messages on the demo `orders` topic:

```bash
TOKEN=$(curl -s -X POST http://localhost:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin","password":"admin"}' | jq -r .token)

CLUSTER_ID=$(curl -s http://localhost:8090/api/v1/clusters \
  -H "Authorization: Bearer $TOKEN" | jq -r '.items[0].id')

curl -s "http://localhost:8090/api/v1/clusters/$CLUSTER_ID/topics/orders/messages?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Example — read partition 0 from offset 0:

```bash
curl -s "http://localhost:8090/api/v1/clusters/$CLUSTER_ID/topics/orders/messages?partition=0&offset=0&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Test Messages with the demo Kafka environment

After completing [steps 1–3](#1-start-the-test-kafka-environment) of the multi-service test setup (Kafka stack running, Kafkaesque connected, **Demo Kafka** cluster registered):

1. Ensure the demo **producer** is running (`docker compose ps` in `examples/kafka-test/` — the `producer` service should be up). It writes synthetic JSON events to the `orders` topic every 2 seconds across 3 partitions.

2. In Kafkaesque, select **Demo Kafka** from the cluster dropdown.

3. Open **Messages**. Leave **Partition** and **Offset** empty (tail mode default).

4. Choose topic **`orders`** from the dropdown (or go to **Topics** → click `orders`).

5. Confirm you see:
   - Status text: **“Showing latest 50 messages across all partitions”**
   - Rows with timestamps, partition numbers (0–2), offsets, and JSON values
   - Messages sorted newest first

6. Click **Show older messages** to load additional history. Repeat until the button disappears (all available messages loaded).

7. **Lookup mode** — enter partition `0` and click **Refresh**. You should see up to 50 messages from partition 0 only, starting at the earliest offset. Add an offset (e.g. `5`) to start at a specific position.

8. **Produce via UI** — click **Produce message**, select `orders`, enter JSON such as `{"type":"order.created","sequence":9999}`, and publish. Click **Refresh** and confirm the new record appears near the top in tail mode.

9. **Verify via CLI** (optional) — compare with the demo consumer:

   ```bash
   cd examples/kafka-test
   docker compose logs -f service-a
   ```

   CLI output should show the same synthetic events Kafkaesque displays in the Messages table.

---

## Dashboard

The dashboard (home page) shows live metrics for the selected cluster in a single-screen layout on desktop (responsive on tablet and mobile):

| Section | Description |
|---------|-------------|
| **KPI cards** | Brokers, topics, partitions, consumer groups, under-replicated and offline partitions |
| **Cluster overview** | Horizontal inventory bars + live activity chart (messages in/out from lag deltas and audit) |
| **Cluster health** | Donut gauge, broker/partition/replication/disk stats, link to brokers |
| **Top topics** | Donut chart by partition distribution among user topics |
| **Recent activity** | Latest audit log entries with success badges |
| **Cluster load** | Partition density, consumer lag, and replication stress bars |
| **Status footer** | Kafka version, cluster ID, connection uptime, auto-refresh interval |

Data is fetched from `/api/v1/clusters/{id}/health`, topics, consumer groups, and audit APIs. Use the refresh control or wait for the 10-second auto-refresh cycle.

---

## Admin pages (daily operations)

Each major entity page uses **row action menus** (⋯) for common tasks:

| Page | Actions | Notes |
|------|---------|-------|
| **Clusters** | View, Edit, Test connection, Delete | Delete removes the Kafkaesque record only — not your Kafka cluster |
| **Brokers** | View details, View partitions, Refresh | Status column shows online/offline |
| **Topics** | View, Browse messages, Produce, Configuration, Delete | Internal topics (`__*`, `_connect.*`) are labeled; optional hide filter |
| **Connect** | View details, Restart, Delete | Task table shows state and worker per task |
| **ACLs** | View, Delete | Create form supports all resource types; warns on `ALL` / `*` permissions |

Topic partition details (leader, ISR, message counts) load from `GET .../topics/{topic}/partitions`.

---

## Authentication

- **Login:** `POST /api/v1/auth/login` with `{"email":"<username or email>","password":"..."}`
- Bootstrap account: `admin` / `admin` (username does not require `@`)
- **JWT** bearer token stored in `localStorage` (`sf_token`) by the frontend
- **Session revocation:** admins can revoke all sessions for a user (increments `token_version`)
- **Password change:** `POST /api/v1/me/password` for the authenticated user

---

## Users, RBAC, and permissions

### Default roles (system, editable)

| Role | Purpose |
|------|---------|
| `ADMIN` | Full access including users and roles |
| `OPERATOR` | Kafka infrastructure management |
| `DEVELOPER` | Inspect and publish; create topics |
| `VIEWER` | Read-only |

Roles and permissions are stored in PostgreSQL (`003_rbac.sql` seed). Admins can create custom roles and edit permission matrices under **Administration → Roles**.

### User management (admin)

- Create, edit, disable, delete users
- Reset passwords and revoke sessions
- Per-user audit history

API routes are under `/api/v1/users`, `/api/v1/roles`, and `/api/v1/permissions`. Every protected route checks permissions via `requirePerm` in the backend.

---

## Testing

```bash
cd backend
go test ./...
```

Existing tests:

- `internal/authorization/rbac_test.go` — permission matching
- `internal/api/handlers_users_test.go` — user handler integration tests

Frontend:

```bash
cd frontend
npm run test    # vitest
npm run build   # production build check
```

---

## API

Base URL (default): `http://localhost:8090`

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | No | Liveness probe |
| `GET /health/ready` | No | Readiness probe (includes DB check) |
| `GET /metrics` | No | Prometheus metrics |
| `POST /api/v1/auth/login` | No | Obtain JWT |
| `GET /api/v1/me` | Yes | Current user + permissions |
| `GET/POST /api/v1/clusters/...` | Yes | Cluster CRUD and Kafka ops |
| `GET /api/v1/audit` | Yes | Audit log |
| `GET /api/v1/search` | Yes | Global search |
| `GET /api/v1/clusters/{id}/topics/{topic}/messages` | Yes | Browse messages (tail or lookup mode) |
| `POST /api/v1/clusters/{id}/topics/{topic}/messages` | Yes | Publish a message |

Authenticated requests require:

```
Authorization: Bearer <token>
```

Cluster-scoped routes live under `/api/v1/clusters/{clusterID}/` (brokers, topics, messages, consumer-groups, health). See `backend/internal/api/server.go` for the full route map.

Example:

```bash
curl -X POST http://localhost:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin","password":"admin"}'
```

---

## Deployment

See **[docs/production.md](docs/production.md)** for the full production guide (secrets, TLS, external Postgres, monitoring).

### Docker Hub (pre-built images)

#### Single image (recommended) — UI + API in one container

| Image | Description |
|-------|-------------|
| `kafkaesqueapp/kafkaesque` | nginx (UI) + Go API on port `80` |

PostgreSQL still runs as a separate container (database is not bundled in the app image).

**Try it:**

```bash
git clone https://github.com/danieldestaw/Kafkaesque.git
cd Kafkaesque
docker compose -f docker-compose.single.yml up -d --build
```

Open **http://localhost:3100** — login `admin` / `admin`.

**From Docker Hub (no build):**

```bash
docker compose -f docker-compose.single.hub.yml up -d
```

#### Split images (optional) — backend + frontend separately

| Image | Description |
|-------|-------------|
| `kafkaesqueapp/kafkaesque-backend` | Go API (`8090`) |
| `kafkaesqueapp/kafkaesque-frontend` | React UI + nginx (`80` → host `3100`) |

```bash
docker compose -f docker-compose.hub.yml up -d
```

Pin a release tag:

```bash
KAFKAESQUE_IMAGE_TAG=1.0.0 docker compose -f docker-compose.single.hub.yml up -d
```

#### Publish to Docker Hub (maintainers)

1. Create a repository on [Docker Hub](https://hub.docker.com): **`kafkaesque`** (single image)
2. Log in: `docker login`
3. Build and push:

```bash
export DOCKERHUB_USER=kafkaesqueapp
export VERSION=1.0.0
chmod +x scripts/publish-dockerhub.sh
./scripts/publish-dockerhub.sh single
```

For separate backend/frontend images: `./scripts/publish-dockerhub.sh split`

Multi-platform (amd64 + arm64): `MULTIARCH=1 ./scripts/publish-dockerhub.sh single`

Do **not** bake secrets into images — set `JWT_SECRET`, `ENCRYPTION_KEY`, and passwords via environment / `.env` at runtime.

### Production (Docker Compose — build from source)

```bash
cp .env.production.example .env
./scripts/generate-secrets.sh   # paste output into .env
# Set CORS_ORIGINS to your public URL

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production overlay:

- Validates secrets at backend startup (`APP_ENV=production`)
- Publishes **frontend only** (API and Postgres stay on the internal network)
- Uses `/health/ready` for readiness checks
- Applies nginx security headers and proxy hardening

Optional TLS at nginx:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.prod.tls.yml up -d --build
```

### Production checklist

- Set strong `JWT_SECRET` (≥ 32 chars) and `ENCRYPTION_KEY` (32 bytes) in `.env`
- Set `DEFAULT_ADMIN_PASS` before first boot; rotate admin password after login
- Use managed PostgreSQL with backups for larger deployments
- Restrict `CORS_ORIGINS` to your domain
- Terminate TLS at a load balancer or use `docker-compose.prod.tls.yml`
- Restrict network access to Kafka brokers; do not expose `/metrics` publicly

### Build artifacts

```bash
# Backend binary
cd backend && go build -o kafkaesque ./cmd/kafkaesque

# Frontend static assets
cd frontend && npm ci && npm run build
# Output: frontend/dist/ (served by nginx in Docker)
```

---

## Security

- Cluster SASL passwords encrypted at rest (AES-GCM)
- JWT sessions with revocable `token_version`
- RBAC enforced on API routes; permissions loaded from database
- Message values rendered as plain text in the UI (not HTML)
- Publish, topic mutations, and admin actions audit-logged
- Default credentials are for development only

Report security issues responsibly to the project maintainers.

---

## Contributing

1. Fork the repository
2. Create a feature branch from `master`
3. Make focused changes with tests where appropriate
4. Run `go test ./...` and `npm run build`
5. Open a pull request with a clear description

Follow existing code conventions in each package. Do not commit secrets, `.env` files, `node_modules/`, or `frontend/dist/`.

---

## Documentation

- [Architecture overview](docs/architecture.md)
- [Production deployment](docs/production.md)
- [Enterprise UI test checklist](docs/enterprise-ui-test.md)
- [Roadmap](ROADMAP.md)

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).
