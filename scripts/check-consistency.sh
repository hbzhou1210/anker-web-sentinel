#!/bin/bash

###############################################################################
# 生产环境一致性检查脚本
# 用途: 检查生产环境与本地环境是否一致
# 用法: ./scripts/check-consistency.sh [production-url]
###############################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PRODUCTION_URL=${1:-"http://your-production-domain.com"}
LOCAL_URL="http://localhost:3000"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}环境一致性检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

###############################################################################
# 1. 检查本地环境
###############################################################################
echo -e "${GREEN}[本地环境]${NC}"
echo "  Git Commit: $(git rev-parse --short HEAD)"
echo "  Git Branch: $(git branch --show-current)"
echo "  提交信息: $(git log -1 --pretty=%B | head -1)"
echo "  Node 版本: $(node --version)"
echo "  修改状态: $(git status --porcelain | wc -l | tr -d ' ') 个文件有修改"

if [ -f "deployment-info.json" ]; then
    echo ""
    echo -e "${GREEN}[最近部署]${NC}"
    cat deployment-info.json | jq -r '"  时间: \(.deployTime)\n  Commit: \(.commitShort)\n  分支: \(.branch)"'
fi

###############################################################################
# 2. 检查本地服务
###############################################################################
echo ""
echo -e "${GREEN}[本地服务]${NC}"

if curl -s $LOCAL_URL/health > /dev/null 2>&1; then
    LOCAL_HEALTH=$(curl -s $LOCAL_URL/health)
    echo "  状态: ✅ 运行中"
    echo "  响应: $LOCAL_HEALTH"
else
    echo "  状态: ❌ 未运行"
fi

###############################################################################
# 3. 检查依赖版本
###############################################################################
echo ""
echo -e "${GREEN}[依赖版本]${NC}"

# 检查 package-lock.json 是否存在
if [ -f "package-lock.json" ]; then
    LOCK_HASH=$(md5 -q package-lock.json 2>/dev/null || md5sum package-lock.json | cut -d' ' -f1)
    echo "  package-lock.json: ${LOCK_HASH:0:8}"
else
    echo "  package-lock.json: ⚠️  不存在"
fi

# 检查 node_modules
if [ -d "node_modules" ]; then
    NODE_MODULES_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l | tr -d ' ')
    echo "  node_modules: $NODE_MODULES_COUNT 个包"
else
    echo "  node_modules: ❌ 不存在"
fi

###############################################################################
# 4. 检查构建文件
###############################################################################
echo ""
echo -e "${GREEN}[构建文件]${NC}"

if [ -d "backend/dist" ]; then
    BACKEND_BUILD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" backend/dist 2>/dev/null || stat -c "%y" backend/dist | cut -d'.' -f1)
    echo "  后端构建: ✅ 存在 (时间: $BACKEND_BUILD_TIME)"
else
    echo "  后端构建: ❌ 不存在"
fi

if [ -d "frontend/dist" ]; then
    FRONTEND_BUILD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" frontend/dist 2>/dev/null || stat -c "%y" frontend/dist | cut -d'.' -f1)
    echo "  前端构建: ✅ 存在 (时间: $FRONTEND_BUILD_TIME)"
else
    echo "  前端构建: ❌ 不存在"
fi

###############################################################################
# 5. 检查环境变量
###############################################################################
echo ""
echo -e "${GREEN}[环境变量]${NC}"

if [ -f ".env" ]; then
    echo "  .env: ✅ 存在"

    # 检查关键配置
    if grep -q "FEISHU_APP_ID" .env; then
        FEISHU_CONFIGURED="✅ 已配置"
    else
        FEISHU_CONFIGURED="❌ 未配置"
    fi
    echo "  飞书配置: $FEISHU_CONFIGURED"

    if grep -q "REDIS_ENABLED" .env; then
        REDIS_STATUS=$(grep "REDIS_ENABLED" .env | cut -d'=' -f2)
        echo "  Redis 状态: $REDIS_STATUS"
    else
        echo "  Redis 状态: ⚠️  未设置"
    fi

    if grep -q "DATABASE_STORAGE" .env; then
        DB_STORAGE=$(grep "DATABASE_STORAGE" .env | cut -d'=' -f2)
        echo "  数据存储: $DB_STORAGE"
    else
        echo "  数据存储: ⚠️  未设置"
    fi
else
    echo "  .env: ❌ 不存在"
fi

###############################################################################
# 6. Docker 状态（如果使用）
###############################################################################
if command -v docker &> /dev/null; then
    echo ""
    echo -e "${GREEN}[Docker 状态]${NC}"

    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "anker-sentinel"; then
        echo "  容器状态:"
        docker ps --format "  - {{.Names}}: {{.Status}}" | grep "anker-sentinel"

        # 检查镜像构建时间
        echo ""
        echo "  镜像信息:"
        docker images --format "  - {{.Repository}}:{{.Tag}} ({{.CreatedSince}})" | grep "anker-sentinel" || echo "  ⚠️  未找到镜像"
    else
        echo "  Docker: ⚠️  未运行或未使用 Docker"
    fi
fi

###############################################################################
# 7. 生成建议
###############################################################################
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}建议操作${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查是否有未提交的修改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  有未提交的修改，建议:"
    echo "   1. git add ."
    echo "   2. git commit -m 'your message'"
    echo "   3. git push"
fi

# 检查是否有构建文件
if [ ! -d "backend/dist" ] || [ ! -d "frontend/dist" ]; then
    echo "⚠️  缺少构建文件，建议:"
    echo "   ./scripts/deploy-production.sh"
fi

echo ""
echo "✅ 确保一致性的步骤:"
echo "   1. 提交所有本地修改"
echo "   2. 推送到远程仓库"
echo "   3. 在生产环境拉取最新代码"
echo "   4. 运行 ./scripts/deploy-production.sh"
echo "   5. 验证部署: ./verify-deployment.sh"
echo ""
