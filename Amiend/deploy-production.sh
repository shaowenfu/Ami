#!/usr/bin/env bash
set -euo pipefail

write_env() {
  printf '%s=%s\n' "$1" "$2" >> .env.production
}

: > .env.production
write_env JWT_SECRET_KEY "${JWT_SECRET_KEY}"
write_env CORS_ORIGINS "${CORS_ORIGINS}"
write_env REDIS_HOST redis
write_env REDIS_PASSWORD "${REDIS_PASSWORD}"
write_env MONGO_URI "${MONGODB_ATLAS_URI}"
write_env MEM0_ENABLED "${MEM0_ENABLED:-false}"
write_env MEM0_API_KEY "${MEM0_API_KEY:-}"
write_env LLM_API_KEY "${LLM_API_KEY:-}"
write_env SMTP_HOST "${SMTP_HOST:-}"
write_env SMTP_USERNAME "${SMTP_USERNAME:-}"
write_env SMTP_PASSWORD "${SMTP_PASSWORD:-}"
write_env SMTP_FROM "${SMTP_FROM:-}"

echo "${ACR_PASSWORD}" | docker login "${ACR_REGISTRY}" -u "${ACR_USERNAME}" --password-stdin

trim_value() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

validate_image_ref() {
  local name="$1"
  local value="$2"

  if [ -z "${value}" ]; then
    echo "${name} is empty" >&2
    exit 1
  fi

  if printf '%s' "${value}" | grep -q '[[:space:]]'; then
    echo "${name} contains whitespace: ${value}" >&2
    exit 1
  fi

  if ! printf '%s' "${value}" | grep -Eq '^[^/[:space:]]+(\.[^/[:space:]]+|:[0-9]+)?/[^:[:space:]]+:[^:[:space:]]+$'; then
    echo "${name} must be a full image reference with registry, repository and tag: ${value}" >&2
    exit 1
  fi
}

IMAGE_REF=$(trim_value "${IMAGE_REF}")
REDIS_IMAGE=$(trim_value "${REDIS_IMAGE}")

validate_image_ref IMAGE_REF "${IMAGE_REF}"
validate_image_ref REDIS_IMAGE "${REDIS_IMAGE}"
echo "deploy_image=${IMAGE_REF}"
echo "redis_image=${REDIS_IMAGE}"

OLD_IMAGE_REF=$(docker inspect -f '{{.Config.Image}}' ami-api 2>/dev/null || true)
OLD_IMAGE_ID=""
if [ -n "${OLD_IMAGE_REF}" ]; then
  OLD_IMAGE_ID=$(docker image inspect "${OLD_IMAGE_REF}" --format '{{.Id}}' 2>/dev/null || true)
fi

export IMAGE_REF REDIS_IMAGE REDIS_PASSWORD
docker compose -f docker-compose.production.yml config --images
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d redis

CANDIDATE_CONTAINER=ami-api-candidate
docker rm -f "${CANDIDATE_CONTAINER}" || true
docker run -d \
  --name "${CANDIDATE_CONTAINER}" \
  --network ami_backend_network \
  --env-file .env.production \
  -e REDIS_HOST=redis \
  "${IMAGE_REF}" \
  uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=*

for i in $(seq 1 30); do
  CODE=$(docker exec "${CANDIDATE_CONTAINER}" curl --silent --output /dev/null --write-out "%{http_code}" http://127.0.0.1:8000/health || true)
  if [ "${CODE}" = "200" ]; then
    echo "candidate_ready"
    break
  fi
  if [ "${i}" = "30" ]; then
    docker logs --tail=200 "${CANDIDATE_CONTAINER}" || true
    docker rm -f "${CANDIDATE_CONTAINER}" || true
    exit 1
  fi
  echo "candidate_health=${CODE}"
  sleep 2
done

docker compose -f docker-compose.production.yml up -d --no-deps api || {
  if [ -n "${OLD_IMAGE_REF}" ]; then
    echo "deploy_failed_rollback_to=${OLD_IMAGE_REF}"
    export IMAGE_REF="${OLD_IMAGE_REF}"
    docker compose -f docker-compose.production.yml up -d --no-deps api || true
  fi
  docker rm -f "${CANDIDATE_CONTAINER}" || true
  exit 1
}
docker rm -f "${CANDIDATE_CONTAINER}" || true

for i in $(seq 1 30); do
  CODE=$(curl --silent --output /dev/null --write-out "%{http_code}" http://127.0.0.1:8000/health || true)
  if [ "${CODE}" = "200" ]; then
    echo "deploy_ready"
    break
  fi
  if [ "${i}" = "30" ]; then
    if [ -n "${OLD_IMAGE_REF}" ]; then
      echo "health_check_failed_rollback_to=${OLD_IMAGE_REF}"
      export IMAGE_REF="${OLD_IMAGE_REF}"
      docker compose -f docker-compose.production.yml up -d --no-deps api || true
    fi
    docker compose -f docker-compose.production.yml ps
    docker compose -f docker-compose.production.yml logs --tail=200
    exit 1
  fi
  echo "health=${CODE}"
  sleep 2
done

CURRENT_IMAGE_ID=$(docker image inspect "${IMAGE_REF}" --format '{{.Id}}')
docker image ls "${ACR_IMAGE_NAME}" --format '{{.Repository}}:{{.Tag}}' | while read -r IMAGE_TAG; do
  IMAGE_ID=$(docker image inspect "${IMAGE_TAG}" --format '{{.Id}}' 2>/dev/null || true)
  if [ -z "${IMAGE_ID}" ]; then
    continue
  fi
  if [ "${IMAGE_ID}" = "${CURRENT_IMAGE_ID}" ] || [ "${IMAGE_ID}" = "${OLD_IMAGE_ID}" ]; then
    continue
  fi
  docker rmi "${IMAGE_TAG}" || true
done
