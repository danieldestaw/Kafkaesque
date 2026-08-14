# Single image: React UI (nginx) + Go API in one container.
# PostgreSQL runs separately (see docker-compose.single.yml).

FROM golang:1.23-alpine AS backend-build
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY backend/ .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /kafkaesque ./cmd/kafkaesque

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache ca-certificates wget \
  && addgroup -S kafkaesque && adduser -S kafkaesque -G kafkaesque

COPY --from=backend-build /kafkaesque /usr/local/bin/kafkaesque
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY deploy/nginx.single.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENV HTTP_PORT=8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -q -O - http://127.0.0.1:8090/health/ready || exit 1

ENTRYPOINT ["/entrypoint.sh"]
