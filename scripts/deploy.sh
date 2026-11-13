#!/usr/bin/env bash
# ==============================================================================
# WINGS Social Network - Production Deployment Script
# Hỗ trợ triển khai cả kiến trúc Monolith (docker-compose.yml)
# và Microservices (docker-compose.microservices.yml)
# ==============================================================================

set -euo pipefail

# Màu sắc thông báo
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================================${NC}"
echo -e "${BLUE}  🚀 WINGS SOCIAL NETWORK - SCRIPT TRIỂN KHAI TỰ ĐỘNG (CD)       ${NC}"
echo -e "${BLUE}=================================================================${NC}"

# Thiết lập mặc định
DEPLOY_MODE="monolith"
COMPOSE_FILE="docker-compose.yml"
SKIP_MIGRATION=false
ENV_FILE="backend/.env"
HEALTH_CHECK_URL="http://127.0.0.1:5000/api/health"
MAX_HEALTH_RETRIES=15
HEALTH_INTERVAL=4

# Đọc tham số dòng lệnh
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)
      DEPLOY_MODE="$2"
      shift 2
      ;;
    --skip-migration)
      SKIP_MIGRATION=true
      shift
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --health-url)
      HEALTH_CHECK_URL="$2"
      shift 2
      ;;
    --help)
      echo "Cách sử dụng: ./scripts/deploy.sh [OPTIONS]"
      echo "Tùy chọn:"
      echo "  --mode <monolith|microservices>  Chọn kiến trúc triển khai (mặc định: monolith)"
      echo "  --skip-migration                 Bỏ qua bước chạy database migration"
      echo "  --env-file <path>                Đường dẫn tới file cấu hình môi trường"
      echo "  --health-url <url>               URL kiểm tra sức khỏe hệ thống"
      exit 0
      ;;
    *)
      echo -e "${RED}Tham số không hợp lệ: $1${NC}"
      exit 1
      ;;
  esac
done

if [ "$DEPLOY_MODE" = "microservices" ]; then
  COMPOSE_FILE="docker-compose.microservices.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

echo -e "🔹 Chế độ triển khai: ${GREEN}${DEPLOY_MODE}${NC} (File: ${COMPOSE_FILE})"

# 1. Kiểm tra Docker & Docker Compose
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Lỗi: Docker chưa được cài đặt trên hệ thống!${NC}"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo -e "${RED}❌ Lỗi: Docker Compose (v2) chưa được cài đặt!${NC}"
  exit 1
fi
echo -e "✅ Docker và Docker Compose sẵn sàng."

# 2. Kiểm tra file cấu hình môi trường
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "backend/.env.example" ]; then
    echo -e "${YELLOW}⚠️ Không tìm thấy $ENV_FILE. Đang sao chép từ backend/.env.example...${NC}"
    cp backend/.env.example "$ENV_FILE"
  fi
fi

# 3. Chạy Database Migration
if [ "$SKIP_MIGRATION" = false ]; then
  echo -e "\n${BLUE}🗄️ Đang kiểm tra và chạy Database Migration...${NC}"
  if [ -f "backend/package.json" ]; then
    (cd backend && npm run migrate || echo -e "${YELLOW}⚠️ Chạy migration gặp cảnh báo, tiếp tục deploy...${NC}")
  fi
else
  echo -e "⏭️ Bỏ qua bước Database Migration theo yêu cầu."
fi

# 4. Kéo images mới hoặc build lại
echo -e "\n${BLUE}📦 Đang cập nhật và khởi chạy các dịch vụ Docker...${NC}"
docker compose -f "$COMPOSE_FILE" pull || true
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

# 5. Dọn dẹp docker images thừa
echo -e "\n${BLUE}🧹 Dọn dẹp Docker images không còn dùng (prune)...${NC}"
docker image prune -f

# 6. Kiểm tra sức khỏe hệ thống (Healthcheck)
echo -e "\n${BLUE}🩺 Đang kiểm tra sức khỏe dịch vụ tại: ${HEALTH_CHECK_URL}...${NC}"
HEALTH_SUCCESS=false

for i in $(seq 1 $MAX_HEALTH_RETRIES); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" || true)
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "207" ]; then
    echo -e "${GREEN}✅ Hệ thống hoạt động tốt! (Mã phản hồi: HTTP $HTTP_STATUS tại lần thử $i)${NC}"
    HEALTH_SUCCESS=true
    break
  fi
  echo -e "${YELLOW}⏳ Đang đợi dịch vụ sẵn sàng... (Lần thử $i/$MAX_HEALTH_RETRIES - HTTP $HTTP_STATUS)${NC}"
  sleep "$HEALTH_INTERVAL"
done

if [ "$HEALTH_SUCCESS" = false ]; then
  echo -e "${RED}⚠️ Cảnh báo: API Gateway chưa phản hồi thành công sau thời gian chờ! Vui lòng kiểm tra logs:${NC}"
  echo -e "   docker compose -f $COMPOSE_FILE logs --tail=50"
  exit 1
fi

echo -e "\n${GREEN}=================================================================${NC}"
echo -e "${GREEN}  🎉 TRIỂN KHAI HOÀN TẤT VÀ HỆ THỐNG ĐÃ SẴN SÀNG HOẠT ĐỘNG!    ${NC}"
echo -e "${GREEN}=================================================================${NC}"
