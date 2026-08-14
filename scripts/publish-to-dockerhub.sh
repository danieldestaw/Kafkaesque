#!/usr/bin/env bash
#
# Publish Kafkaesque to Docker Hub — one script, end to end.
#
# Usage:
#   chmod +x scripts/publish-to-dockerhub.sh
#   ./scripts/publish-to-dockerhub.sh
#
# Or with env overrides:
#   DOCKERHUB_USER=myuser VERSION=1.0.0 ./scripts/publish-to-dockerhub.sh
#   MULTIARCH=1 ./scripts/publish-to-dockerhub.sh
#   MODE=split ./scripts/publish-to-dockerhub.sh
#
set -euo pipefail

# ── Configure (override via environment) ─────────────────────────────────────
DOCKERHUB_USER="${DOCKERHUB_USER:-kafkaesqueapp}"
VERSION="${VERSION:-1.0.0}"          # set empty to push only :latest
MODE="${MODE:-single}"               # single | split
MULTIARCH="${MULTIARCH:-0}"          # 1 = amd64 + arm64 via buildx
SKIP_LOGIN="${SKIP_LOGIN:-0}"        # 1 = skip docker login prompt
TEST_PULL="${TEST_PULL:-0}"          # 1 = pull image after push to verify

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Prerequisites ────────────────────────────────────────────────────────────
log "Checking Docker..."
docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker and retry."

if [[ "${SKIP_LOGIN}" != "1" ]]; then
  log "Docker Hub login (skip with SKIP_LOGIN=1 if already logged in)..."
  docker login || die "docker login failed"
fi

# ── Build tags ─────────────────────────────────────────────────────────────────
build_and_push_single() {
  local image="${DOCKERHUB_USER}/kafkaesque"
  local tags=(-t "${image}:latest")
  [[ -n "${VERSION}" ]] && tags+=(-t "${image}:${VERSION}")

  log "Building single image: ${image}"
  if [[ "${MULTIARCH}" == "1" ]]; then
    docker buildx create --use --name kafkaesque-builder 2>/dev/null || docker buildx use kafkaesque-builder
    docker buildx build --platform linux/amd64,linux/arm64 "${tags[@]}" --push -f "${ROOT}/Dockerfile" "${ROOT}"
  else
    docker build "${tags[@]}" -f "${ROOT}/Dockerfile" "${ROOT}"
    docker push "${image}:latest"
    [[ -n "${VERSION}" ]] && docker push "${image}:${VERSION}"
  fi

  echo ""
  echo "Published:"
  echo "  ${image}:latest"
  [[ -n "${VERSION}" ]] && echo "  ${image}:${VERSION}"
  echo ""
  echo "Hub page: https://hub.docker.com/r/${DOCKERHUB_USER}/kafkaesque"
  echo "Run:      docker compose -f docker-compose.single.hub.yml up -d"
  [[ -n "${VERSION}" ]] && echo "Pin tag:  KAFKAESQUE_IMAGE_TAG=${VERSION} docker compose -f docker-compose.single.hub.yml up -d"

  if [[ "${TEST_PULL}" == "1" && "${MULTIARCH}" != "1" ]]; then
    log "Verifying pull..."
    docker pull "${image}:latest"
  fi
}

build_and_push_split() {
  local backend="${DOCKERHUB_USER}/kafkaesque-backend"
  local frontend="${DOCKERHUB_USER}/kafkaesque-frontend"
  local tags_b=(-t "${backend}:latest")
  local tags_f=(-t "${frontend}:latest")
  [[ -n "${VERSION}" ]] && tags_b+=(-t "${backend}:${VERSION}")
  [[ -n "${VERSION}" ]] && tags_f+=(-t "${frontend}:${VERSION}")

  log "Building split images..."
  if [[ "${MULTIARCH}" == "1" ]]; then
    docker buildx create --use --name kafkaesque-builder 2>/dev/null || docker buildx use kafkaesque-builder
    docker buildx build --platform linux/amd64,linux/arm64 "${tags_b[@]}" --push "${ROOT}/backend"
    docker buildx build --platform linux/amd64,linux/arm64 "${tags_f[@]}" --push "${ROOT}/frontend"
  else
    docker build "${tags_b[@]}" "${ROOT}/backend"
    docker build "${tags_f[@]}" "${ROOT}/frontend"
    docker push "${backend}:latest"
    docker push "${frontend}:latest"
    [[ -n "${VERSION}" ]] && docker push "${backend}:${VERSION}"
    [[ -n "${VERSION}" ]] && docker push "${frontend}:${VERSION}"
  fi

  echo ""
  echo "Published:"
  echo "  ${backend}:latest"
  echo "  ${frontend}:latest"
  [[ -n "${VERSION}" ]] && echo "  ${backend}:${VERSION}"
  [[ -n "${VERSION}" ]] && echo "  ${frontend}:${VERSION}"
  echo ""
  echo "Run: docker compose -f docker-compose.hub.yml up -d"
}

# ── Run ────────────────────────────────────────────────────────────────────────
log "Kafkaesque Docker Hub publish"
echo "  User:     ${DOCKERHUB_USER}"
echo "  Version:  ${VERSION:-<latest only>}"
echo "  Mode:     ${MODE}"
echo "  Multiarch: ${MULTIARCH}"

case "${MODE}" in
  single) build_and_push_single ;;
  split)  build_and_push_split ;;
  *)
    die "Unknown MODE=${MODE}. Use single or split."
    ;;
esac

log "Done."
