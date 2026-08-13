FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /kafkaesque ./cmd/kafkaesque

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget \
  && addgroup -S kafkaesque && adduser -S kafkaesque -G kafkaesque
WORKDIR /app
COPY --from=builder /kafkaesque /usr/local/bin/kafkaesque
USER kafkaesque
EXPOSE 8090
CMD ["kafkaesque"]
