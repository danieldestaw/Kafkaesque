#!/usr/bin/env bash
# Build and push Kafkaesque images to Docker Hub.
#
# Single all-in-one image (recommended):
#   ./scripts/publish-dockerhub.sh single
#
# Separate backend + frontend images:
#   ./scripts/publish-dockerhub.sh split
#
# Environment:
#   DOCKERHUB_USER=youruser   (default: kafkaesqueapp)
#   VERSION=1.0.0             (optional version tag)
#   MULTIARCH=1               (build amd64 + arm64)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKERHUB_USER="${DOCKERHUB_USER:-kafkaesqueapp}"
VERSION="${VERSION:-}"
MODE="${1:-single}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker and retry." >&2
  exit 1
fi

publish_single() {
  local tags=(-t "${DOCKERHUB_USER}/kafkaesque:latest")
  [[ -n "${VERSION}" ]] && tags+=(-t "${DOCKERHUB_USER}/kafkaesque:${VERSION}")

  if [[ "${MULTIARCH:-0}" == "1" ]]; then
    docker buildx create --use --name kafkaesque-builder 2>/dev/null || docker buildx use kafkaesque-builder
    docker buildx build --platform linux/amd64,linux/arm64 "${tags[@]}" --push -f "${ROOT}/Dockerfile" "${ROOT}"
  else
    docker build "${tags[@]}" -f "${ROOT}/Dockerfile" "${ROOT}"
    docker push "${DOCKERHUB_USER}/kafkaesque:latest"
    [[ -n "${VERSION}" ]] && docker push "${DOCKERHUB_USER}/kafkaesque:${VERSION}"
  fi

  echo ""
  echo "Single image published: ${DOCKERHUB_USER}/kafkaesque:latest"
  echo "Run: docker compose -f docker-compose.single.hub.yml up -d"
}

publish_split() {
  local tags_backend=(-t "${DOCKERHUB_USER}/kafkaesque-backend:latest")
  local tags_frontend=(-t "${DOCKERHUB_USER}/kafkaesque-frontend:latest")
  [[ -n "${VERSION}" ]] && tags_backend+=(-t "${DOCKERHUB_USER}/kafkaesque-backend:${VERSION}")
  [[ -n "${VERSION}" ]] && tags_frontend+=(-t "${DOCKERHUB_USER}/kafkaesque-frontend:${VERSION}")

  if [[ "${MULTIARCH:-0}" == "1" ]]; then
    docker buildx create --use --name kafkaesque-builder 2>/dev/null || docker buildx use kafkaesque-builder
    docker buildx build --platform linux/amd64,linux/arm64 "${tags_backend[@]}" --push "${ROOT}/backend"
    docker buildx build --platform linux/amd64,linux/arm64 "${tags_frontend[@]}" --push "${ROOT}/frontend"
  else
    docker build "${tags_backend[@]}" "${ROOT}/backend"
    docker build "${tags_frontend[@]}" "${ROOT}/frontend"
    docker push "${DOCKERHUB_USER}/kafkaesque-backend:latest"
    docker push "${DOCKERHUB_USER}/kafkaesque-frontend:latest"
    [[ -n "${VERSION}" ]] && docker push "${DOCKERHUB_USER}/kafkaesque-backend:${VERSION}"
    [[ -n "${VERSION}" ]] && docker push "${DOCKERHUB_USER}/kafkaesque-frontend:${VERSION}"
  fi

  echo ""
  echo "Split images published."
  echo "Run: docker compose -f docker-compose.hub.yml up -d"
}

case "${MODE}" in
  single) publish_single ;;
  split)  publish_split ;;
  *)
    echo "Usage: $0 [single|split]" >&2
    exit 1
    ;;
esac
