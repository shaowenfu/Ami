#!/usr/bin/env bash
set -euo pipefail

cat > .env.production <<EOF
APP_NAME=${APP_NAME}
APP_VERSION=${APP_VERSION}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=${CORS_ORIGINS}
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
MONGO_URI=${MONGODB_ATLAS_URI}
MONGO_DATABASE=${MONGO_DATABASE}
MEMORY_ENABLED=false
DEFAULT_MODEL_PROVIDER=custom
LLM_API_KEY=${LLM_API_KEY:-}
LLM_BASE_URL=${LLM_BASE_URL}
LLM_MODEL=${LLM_MODEL}
EOF

echo "${ACR_PASSWORD}" | docker login "${ACR_REGISTRY}" -u "${ACR_USERNAME}" --password-stdin

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
