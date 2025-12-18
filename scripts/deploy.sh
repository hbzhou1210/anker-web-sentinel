#!/bin/bash

# Deployment Script - 部署到生产环境
# 这是一个示例脚本,根据实际部署方式调整

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
DEPLOY_ENV="${1:-production}"  # 部署环境: production, staging
APP_NAME="anita-qa-system"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🚀 Deploying ${APP_NAME} to ${DEPLOY_ENV}${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 检查必要的环境变量
check_env_vars() {
  local missing=0

  if [ -z "$DEPLOY_HOST" ]; then
    echo -e "${RED}❌ DEPLOY_HOST not set${NC}"
    missing=1
  fi

  if [ -z "$DEPLOY_USER" ]; then
    echo -e "${RED}❌ DEPLOY_USER not set${NC}"
    missing=1
  fi

  if [ $missing -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}💡 Please set the following environment variables:${NC}"
    echo -e "   export DEPLOY_HOST='your-server-ip'"
    echo -e "   export DEPLOY_USER='your-ssh-user'"
    echo -e "   export DEPLOY_PATH='/path/to/app'"
    echo ""
    exit 1
  fi
}

# ===========================
# 部署方式 1: Docker Compose
# ===========================
deploy_docker_compose() {
  echo -e "${YELLOW}📦 Deploying via Docker Compose...${NC}"

  # 构建 Docker 镜像
  echo -e "${BLUE}Building Docker image...${NC}"
  docker-compose build

  # 停止旧容器
  echo -e "${BLUE}Stopping old containers...${NC}"
  docker-compose down

  # 启动新容器
  echo -e "${BLUE}Starting new containers...${NC}"
  docker-compose up -d

  # 清理旧镜像
  echo -e "${BLUE}Cleaning up old images...${NC}"
  docker image prune -f

  echo -e "${GREEN}✅ Docker Compose deployment completed${NC}"
}

# ===========================
# 部署方式 2: SSH + PM2
# ===========================
deploy_ssh_pm2() {
  echo -e "${YELLOW}📡 Deploying via SSH + PM2...${NC}"

  check_env_vars

  DEPLOY_PATH="${DEPLOY_PATH:-/var/www/${APP_NAME}}"

  echo -e "${BLUE}Connecting to ${DEPLOY_USER}@${DEPLOY_HOST}...${NC}"

  ssh "${DEPLOY_USER}@${DEPLOY_HOST}" << EOF
    set -e

    echo "📂 Navigating to app directory..."
    cd ${DEPLOY_PATH}

    echo "🔄 Pulling latest code..."
    git pull origin master

    echo "📦 Installing backend dependencies..."
    cd backend
    npm ci --production

    echo "🔨 Building backend..."
    npm run build

    echo "📦 Installing frontend dependencies..."
    cd ../frontend
    npm ci

    echo "🔨 Building frontend..."
    npm run build

    echo "🔄 Restarting PM2 processes..."
    cd ..
    pm2 restart ${APP_NAME} || pm2 start backend/dist/index.js --name ${APP_NAME}

    echo "✅ Deployment completed!"
EOF

  echo -e "${GREEN}✅ SSH + PM2 deployment completed${NC}"
}

# ===========================
# 部署方式 3: Docker Registry
# ===========================
deploy_docker_registry() {
  echo -e "${YELLOW}🐳 Deploying via Docker Registry...${NC}"

  # 构建并推送镜像
  GIT_COMMIT=$(git rev-parse --short HEAD)
  IMAGE_TAG="${DEPLOY_ENV}-${GIT_COMMIT}"

  echo -e "${BLUE}Building image: ${APP_NAME}:${IMAGE_TAG}${NC}"
  docker build -t "${APP_NAME}:${IMAGE_TAG}" \
    --build-arg GIT_COMMIT="${GIT_COMMIT}" \
    --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    .

  # 如果有 Docker Registry
  if [ -n "$DOCKER_REGISTRY" ]; then
    echo -e "${BLUE}Pushing to registry: ${DOCKER_REGISTRY}${NC}"
    docker tag "${APP_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"

    # 更新 latest 标签
    if [ "$DEPLOY_ENV" = "production" ]; then
      docker tag "${APP_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${APP_NAME}:latest"
      docker push "${DOCKER_REGISTRY}/${APP_NAME}:latest"
    fi
  fi

  echo -e "${GREEN}✅ Docker Registry deployment completed${NC}"
}

# ===========================
# 健康检查
# ===========================
health_check() {
  echo ""
  echo -e "${YELLOW}🏥 Running health check...${NC}"

  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if curl -s -f "http://${DEPLOY_HOST}:3000/health" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Health check passed!${NC}"
      return 0
    fi

    echo -e "${BLUE}Attempt $attempt/$max_attempts - waiting for service...${NC}"
    sleep 2
    attempt=$((attempt + 1))
  done

  echo -e "${RED}❌ Health check failed after $max_attempts attempts${NC}"
  return 1
}

# ===========================
# 回滚
# ===========================
rollback() {
  echo -e "${RED}🔄 Rolling back deployment...${NC}"

  # 根据部署方式执行回滚
  # 这里是示例,需要根据实际情况调整

  echo -e "${YELLOW}Reverting to previous version...${NC}"
  # git reset --hard HEAD~1
  # docker-compose down && docker-compose up -d

  echo -e "${GREEN}✅ Rollback completed${NC}"
}

# ===========================
# 主逻辑
# ===========================
main() {
  # 确认部署
  echo -e "${YELLOW}⚠️  You are about to deploy to ${DEPLOY_ENV}${NC}"
  echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
  read -r

  # 选择部署方式
  DEPLOY_METHOD="${DEPLOY_METHOD:-docker-compose}"

  case "$DEPLOY_METHOD" in
    docker-compose)
      deploy_docker_compose
      ;;
    ssh-pm2)
      deploy_ssh_pm2
      ;;
    docker-registry)
      deploy_docker_registry
      ;;
    *)
      echo -e "${RED}❌ Unknown deployment method: ${DEPLOY_METHOD}${NC}"
      echo -e "${YELLOW}Available methods: docker-compose, ssh-pm2, docker-registry${NC}"
      exit 1
      ;;
  esac

  # 健康检查
  if [ -n "$DEPLOY_HOST" ]; then
    if ! health_check; then
      echo -e "${RED}❌ Deployment failed health check${NC}"
      echo -e "${YELLOW}Do you want to rollback? (y/n)${NC}"
      read -r response
      if [ "$response" = "y" ]; then
        rollback
      fi
      exit 1
    fi
  fi

  # 成功
  echo ""
  echo -e "${BLUE}======================================${NC}"
  echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
  echo -e "${BLUE}======================================${NC}"
  echo -e "${BLUE}Environment: ${DEPLOY_ENV}${NC}"
  echo -e "${BLUE}Method: ${DEPLOY_METHOD}${NC}"
  echo -e "${BLUE}Timestamp: $(date)${NC}"
  echo ""
}

# 运行主逻辑
main

