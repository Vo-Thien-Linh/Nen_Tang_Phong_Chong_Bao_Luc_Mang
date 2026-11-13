#!/usr/bin/env bash
# ==============================================================================
# WINGS - Script triển khai trên máy chủ (được CD upload và gọi qua SSH,
# cũng có thể chạy tay). Đặt tại <DEPLOY_PATH>/scripts/deploy.sh.
#
# Chế độ registry (mặc định): kéo image dựng sẵn từ GHCR theo --tag, healthcheck,
# tự động rollback về tag chạy thành công trước đó nếu healthcheck thất bại.
# Chế độ --build-local: build trực tiếp từ mã nguồn bằng compose gốc (dev/lần đầu).
# ==============================================================================
set -euo pipefail

MODE="monolith"                 # monolith | microservices
IMAGE_PREFIX="${IMAGE_PREFIX:-}" # ví dụ: ghcr.io/<owner>
IMAGE_TAG="${IMAGE_TAG:-}"
BUILD_LOCAL=false
HEALTH_URL="http://127.0.0.1:5000/api/health"
HEALTH_RETRIES=36
HEALTH_INTERVAL=5

usage() {
  cat <<'EOF'
Cách dùng: scripts/deploy.sh [tùy chọn]
  --mode <monolith|microservices>  Kiến trúc triển khai (mặc định: monolith)
  --registry <prefix>              Tiền tố image, ví dụ ghcr.io/<owner>   (hoặc env IMAGE_PREFIX)
  --tag <tag>                      Tag image cần chạy, ví dụ a1b2c3d     (hoặc env IMAGE_TAG)
  --build-local                    Build từ mã nguồn thay vì kéo image từ registry
  --health-url <url>               URL healthcheck (mặc định http://127.0.0.1:5000/api/health)
  -h, --help                       Hiển thị trợ giúp
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)         MODE="$2"; shift 2 ;;
    --registry)     IMAGE_PREFIX="$2"; shift 2 ;;
    --tag)          IMAGE_TAG="$2"; shift 2 ;;
    --build-local)  BUILD_LOCAL=true; shift ;;
    --health-url)   HEALTH_URL="$2"; shift 2 ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "Tham số không hợp lệ: $1" >&2; usage; exit 1 ;;
  esac
done

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd)"

case "$MODE" in
  monolith)       BASE_FILE="docker-compose.yml";               PROD_FILE="docker-compose.prod.yml" ;;
  microservices)  BASE_FILE="docker-compose.microservices.yml"; PROD_FILE="docker-compose.microservices.prod.yml" ;;
  *) echo "❌ --mode phải là monolith hoặc microservices" >&2; exit 1 ;;
esac

STATE_DIR="$ROOT/.deploy-state"
STATE_FILE="$STATE_DIR/last_good_tag.$MODE"
mkdir -p "$STATE_DIR"

echo "🚀 WINGS deploy | mode=$MODE | build-local=$BUILD_LOCAL | dir=$ROOT"

# ---- Kiểm tra điều kiện tiên quyết -------------------------------------------
command -v docker >/dev/null || { echo "❌ Chưa cài Docker" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ Chưa cài Docker Compose v2" >&2; exit 1; }
[ -f "$BASE_FILE" ] || { echo "❌ Thiếu $BASE_FILE" >&2; exit 1; }

# backend/.env chứa secret thật (DATABASE_URL, JWT_SECRET_KEY, Cloudinary, SMTP...).
# Không tự sao chép từ .env.example để tránh chạy production bằng giá trị giả.
if [ ! -f backend/.env ]; then
  echo "❌ Thiếu $ROOT/backend/.env. Hãy tạo từ backend/.env.example và điền giá trị thật." >&2
  exit 1
fi

# ---- Chế độ build từ mã nguồn -------------------------------------------------
if [ "$BUILD_LOCAL" = true ]; then
  docker compose -f "$BASE_FILE" up -d --build --remove-orphans
  COMPOSE=(docker compose -f "$BASE_FILE")
else
  [ -n "$IMAGE_PREFIX" ] || { echo "❌ Thiếu --registry / IMAGE_PREFIX" >&2; exit 1; }
  [ -n "$IMAGE_TAG" ]    || { echo "❌ Thiếu --tag / IMAGE_TAG" >&2; exit 1; }
  [ -f "$PROD_FILE" ]    || { echo "❌ Thiếu $PROD_FILE" >&2; exit 1; }

  export IMAGE_PREFIX
  export AI_MODELS_ROOT="${AI_MODELS_ROOT:-/opt/wings/models}"

  # Trọng số AI không nằm trong image (bị .gitignore) nên phải có sẵn trên máy chủ.
  for d in image_moderation text_moderation; do
    if [ ! -d "$AI_MODELS_ROOT/$d" ]; then
      echo "❌ Thiếu thư mục model: $AI_MODELS_ROOT/$d (đặt đủ file weights vào đó)" >&2
      exit 1
    fi
  done

  COMPOSE=(docker compose -f "$BASE_FILE" -f "$PROD_FILE")

  apply_tag() {
    export IMAGE_TAG="$1"
    echo "📦 Triển khai tag: $IMAGE_TAG"
    "${COMPOSE[@]}" pull
    "${COMPOSE[@]}" up -d --no-build --remove-orphans
  }
fi

# ---- Healthcheck --------------------------------------------------------------
wait_healthy() {
  echo "🩺 Healthcheck: $HEALTH_URL"
  local i code
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
    # Gateway trả 200 khi mọi service UP, 207 khi có service chưa sẵn sàng.
    if [ "$code" = "200" ]; then
      echo "✅ Tất cả dịch vụ UP (lần thử $i)"
      return 0
    fi
    echo "⏳ Chờ dịch vụ... ($i/$HEALTH_RETRIES, HTTP ${code:-000})"
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

if [ "$BUILD_LOCAL" = true ]; then
  wait_healthy || { echo "❌ Healthcheck thất bại"; "${COMPOSE[@]}" logs --tail=60; exit 1; }
  exit 0
fi

PREVIOUS_TAG=""
[ -f "$STATE_FILE" ] && PREVIOUS_TAG="$(cat "$STATE_FILE")"

apply_tag "$IMAGE_TAG"

if wait_healthy; then
  echo "$IMAGE_TAG" > "$STATE_FILE"
  docker image prune -f >/dev/null
  echo "🎉 Triển khai thành công: $IMAGE_TAG"
  exit 0
fi

echo "❌ Healthcheck thất bại với tag $IMAGE_TAG" >&2
"${COMPOSE[@]}" logs --tail=60 || true

if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ]; then
  echo "↩️ Rollback về tag chạy tốt trước đó: $PREVIOUS_TAG" >&2
  apply_tag "$PREVIOUS_TAG" || true
  wait_healthy || echo "⚠️ Rollback cũng chưa healthy, cần kiểm tra thủ công" >&2
else
  echo "⚠️ Không có tag cũ để rollback" >&2
fi
exit 1
