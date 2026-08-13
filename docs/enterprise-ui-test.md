# UI test guide: Schemas, Connect, ACLs, Alerts

Use this after the base demo Kafka stack and Kafkaesque are running.

## 1. Start enterprise services

```bash
cd /home/fs/Kafkaesque/examples/kafka-test
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml ps
```

**Expected:** `schema-registry` and `kafka-connect` are **running (healthy)**.  
`enterprise-init` and `enterprise-acl-init` exit **0**.

Verify from your host:

```bash
curl -s http://localhost:8081/subjects
# ["orders-value"]

curl -s http://localhost:8083/connectors
# ["demo-verifiable-source"]
```

Ensure Kafkaesque backend is on the same Docker network:

```bash
cd /home/fs/Kafkaesque
docker compose -f docker-compose.yml -f docker-compose.test-kafka.yml up -d
```

## 2. Attach enterprise URLs to your cluster

Your existing **Demo kafka** cluster has no Schema Registry / Connect URLs. Update it in Postgres:

```bash
cd /home/fs/Kafkaesque
docker compose exec kafkaesque-db psql -U kafkaesque -d kafkaesque -c \
  "UPDATE clusters SET schema_registry_url='http://schema-registry:8081', connect_url='http://kafka-connect:8083' WHERE bootstrap_servers='kafka:9092';"
```

**Expected:** `UPDATE 2` (or `UPDATE 1` if you have one cluster).

Refresh the UI (hard refresh). Select **Demo kafka** in the header dropdown.

> **Alternative:** Delete the cluster in UI and re-add with the same bootstrap plus:
> - Schema Registry URL: `http://schema-registry:8081`
> - Kafka Connect URL: `http://kafka-connect:8083`

---

## 3. Test Schemas (UI)

1. Open **Schemas** in the sidebar.
2. **Expected:** Table shows subject **`orders-value`**.
3. Click **`orders-value`**.
4. **Expected:** Drawer shows Avro JSON with fields `sequence`, `type`.
5. Register another schema:
   - Subject: `events-value`
   - Schema (paste):

```json
{"type":"record","name":"Event","namespace":"demo","fields":[{"name":"id","type":"string"}]}
```

6. Click **Register** → toast **Schema registered** → subject appears in list.

---

## 4. Test Connect (UI)

1. Open **Connect**.
2. **Expected:** One connector **`demo-verifiable-source`**, state **RUNNING** (or **PAUSED** briefly after start).
3. Click restart icon (↻) if state is not RUNNING; wait ~10s and refresh.
4. **Expected:** Tasks column shows `1`.
5. Optional: **Topics** → confirm topic **`connect-demo`** exists (VerifiableSource produces to it).

---

## 5. Test ACLs (UI)

1. Open **ACLs**.
2. **Expected:** At least one ACL for principal **`User:demo-user`** on topic **`orders`** (seeded by `enterprise-acl-init`).
3. Create a new ACL:
   - Principal: `User:alice`
   - Host: `*`
   - Resource type: **TOPIC**
   - Resource name: `orders`
   - Operation: **READ**
   - Permission: **ALLOW**
4. Click **Create ACL** → toast **ACL created** → row appears.
5. Delete with trash icon → row removed.

If the list is empty, check authorizer:

```bash
cd examples/kafka-test
docker compose exec kafka /opt/kafka/bin/kafka-acls.sh --bootstrap-server localhost:9092 --list
```

---

## 6. Test Alerts (UI)

1. Open **Alerts**.
2. Add rule:
   - Name: `High consumer lag`
   - Type: **Consumer lag (max)**
   - Threshold: `50`
3. **Expected:** Rule listed under **Rules**.
4. Wait **~60 seconds** (background evaluator interval).
5. **Expected:** **Recent events** shows WARNING entries if any consumer group max lag > 50 (likely with 3 active consumers on `orders`).
6. Click **Resolve** on an event → status **RESOLVED**.

Second rule to try:

- Name: `Offline partitions`
- Type: **Offline partitions**
- Threshold: `0`

Should stay quiet while cluster is healthy.

---

## 7. Quick API cross-check (optional)

```bash
TOKEN=$(curl -s -X POST http://localhost:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin","password":"admin"}' | jq -r .token)

CID=$(curl -s http://localhost:8090/api/v1/clusters -H "Authorization: Bearer $TOKEN" \
  | jq -r '.items[] | select(.name|test("Demo";"i")) | .id' | head -1)

curl -s "http://localhost:8090/api/v1/clusters/$CID/schemas" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "http://localhost:8090/api/v1/clusters/$CID/connectors" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "http://localhost:8090/api/v1/clusters/$CID/acls" -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Schemas/Connect: "URL not configured" | Run SQL update in step 2; refresh browser |
| Schemas/Connect: connection error | `docker compose ... ps` — registry/connect must be healthy; Kafkaesque must use `docker-compose.test-kafka.yml` |
| Connect empty | Wait 90s for Connect startup; check `curl localhost:8083/connectors` |
| ACLs empty | Re-run `enterprise-acl-init`: `docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up enterprise-acl-init` |
| Alerts no events | Lower threshold to `1`; wait 60s; check **Consumers** page for lag values |
