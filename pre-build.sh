#!/bin/bash
# Launch 平台部署前的自动钩子脚本
# 此脚本会在 docker compose build 之前自动执行

set -e

echo "========================================="
echo "  准备 Docker 构建环境"
echo "========================================="

# 获取 Git 信息
if [ -d .git ]; then
  GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
else
  GIT_COMMIT="unknown"
  GIT_BRANCH="unknown"
fi

BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VERSION="1.0.0"

echo "📦 构建信息:"
echo "  - Git Commit: $GIT_COMMIT"
echo "  - Git Branch: $GIT_BRANCH"
echo "  - Build Date: $BUILD_DATE"
echo "  - Version: $VERSION"

# 写入 .env.build 文件供 docker-compose 使用
cat > .env.build << EOF
# 自动生成于: $BUILD_DATE
GIT_COMMIT=$GIT_COMMIT
BUILD_DATE=$BUILD_DATE
VERSION=$VERSION
EOF

echo "✓ 版本信息已写入 .env.build"
echo "========================================="
