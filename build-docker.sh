#!/bin/bash
# Docker 镜像构建脚本 - 确保唯一性和可追溯性

set -e

echo "========================================="
echo "  Anita Web Sentinel - Docker 构建脚本"
echo "========================================="
echo ""

# 获取 Git 信息
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VERSION="1.0.0"

echo "📦 构建信息:"
echo "  - Git Commit: $GIT_COMMIT"
echo "  - Git Branch: $GIT_BRANCH"
echo "  - Build Date: $BUILD_DATE"
echo "  - Version: $VERSION"
echo ""

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
  echo "⚠️  警告: 检测到未提交的更改!"
  echo "   建议先提交所有更改以确保镜像可追溯"
  echo ""
  read -p "是否继续构建? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 构建已取消"
    exit 1
  fi
  GIT_COMMIT="${GIT_COMMIT}-dirty"
fi

echo "🔨 开始构建 Docker 镜像..."
echo ""

# 构建镜像
docker compose build --no-cache \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg VERSION="$VERSION"

echo ""
echo "✅ 构建完成!"
echo ""

# 给镜像打标签
echo "🏷️  为镜像添加唯一标签..."
docker tag anita-project_backend:latest anita-project_backend:$GIT_COMMIT
docker tag anita-project_frontend:latest anita-project_frontend:$GIT_COMMIT
echo "   - anita-project_backend:$GIT_COMMIT"
echo "   - anita-project_frontend:$GIT_COMMIT"
echo ""

# 显示镜像列表
echo "📋 当前镜像列表:"
docker images | grep anita-project
echo ""

# 提示部署命令
echo "========================================="
echo "🚀 部署命令:"
echo "   docker compose down"
echo "   docker compose up -d"
echo ""
echo "📊 验证版本:"
echo "   docker compose exec backend cat /app/version.json"
echo "   curl http://localhost/version.json"
echo "========================================="
