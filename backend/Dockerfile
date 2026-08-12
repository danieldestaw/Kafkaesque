FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /streamforge ./cmd/streamforge

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=builder /streamforge /usr/local/bin/streamforge
EXPOSE 8090
CMD ["streamforge"]
