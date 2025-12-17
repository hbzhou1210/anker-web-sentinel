#!/bin/bash

# =================================================================
# 浏览器崩溃修复部署脚本
# =================================================================
# 此脚本用于快速部署浏览器崩溃修复到生产环境
# =================================================================

set -e

echo "🔧 开始部署浏览器崩溃修复..."

# 1. 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 backend 目录下运行此脚本"
    exit 1
fi

# 2. 备份修复的关键文件
echo "📦 备份修复的文件..."
mkdir -p /tmp/crash-fix-backup
cp src/automation/BrowserPool.ts /tmp/crash-fix-backup/
cp src/services/PatrolService.ts /tmp/crash-fix-backup/
cp Dockerfile /tmp/crash-fix-backup/
echo "✓ 文件已备份到 /tmp/crash-fix-backup/"

# 3. 构建 Docker 镜像
echo "🐳 构建 Docker 镜像..."
cd ..
docker build -t anita-web-sentinel:crash-fix -f backend/Dockerfile backend/

# 4. 标记为最新版本
echo "🏷️  标记镜像..."
docker tag anita-web-sentinel:crash-fix anita-web-sentinel:latest

# 5. 提示部署选项
echo ""
echo "✅ Docker 镜像构建完成!"
echo ""
echo "📋 部署选项:"
echo ""
echo "方案 A (推荐) - 使用增加的共享内存:"
echo "  docker run -d --name anita-sentinel \\"
echo "    --shm-size=512m \\"
echo "    -p 3000:3000 \\"
echo "    -e NODE_ENV=production \\"
echo "    anita-web-sentinel:latest"
echo ""
echo "方案 B - 使用宿主机共享内存:"
echo "  docker run -d --name anita-sentinel \\"
echo "    -v /dev/shm:/dev/shm \\"
echo "    -p 3000:3000 \\"
echo "    -e NODE_ENV=production \\"
echo "    anita-web-sentinel:latest"
echo ""
echo "方案 C - 仅依赖软件修复(已在代码中实现):"
echo "  docker run -d --name anita-sentinel \\"
echo "    -p 3000:3000 \\"
echo "    -e NODE_ENV=production \\"
echo "    anita-web-sentinel:latest"
echo ""
echo "💡 提示: 推荐使用方案 A 以获得最佳性能和稳定性"
echo ""
echo "📊 监控命令:"
echo "  docker logs -f anita-sentinel           # 查看日志"
echo "  docker stats anita-sentinel              # 查看资源使用"
echo "  curl http://localhost:3000/api/v1/health # 健康检查"
echo ""
