#!/bin/bash

# Anita 项目快速部署脚本
# 使用方法: ./deploy.sh

set -e  # 遇到错误立即退出

echo "========================================"
echo "  Anita 项目部署脚本"
echo "========================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker 已安装"
echo "✓ Docker Compose 已安装"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件,从模板复制..."
    if [ -f .env.production ]; then
        cp .env.production .env
        echo "✓ 已创建 .env 文件"
        echo ""
        echo "⚠️  重要: 请编辑 .env 文件,修改以下配置:"
        echo "   - POSTGRES_PASSWORD (数据库密码)"
        echo "   - FRONTEND_URL (前端访问地址)"
        echo "   - APP_URL (应用访问地址)"
        echo ""
        read -p "按回车键继续,或按 Ctrl+C 退出编辑配置..."
    else
        echo "❌ 错误: 未找到 .env.production 模板文件"
        exit 1
    fi
fi

# 读取配置
source .env

# 检查必要配置
if [ "$POSTGRES_PASSWORD" == "your_secure_password_here" ]; then
    echo "⚠️  警告: 你还在使用默认数据库密码!"
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 已取消部署"
        exit 1
    fi
fi

echo "========================================"
echo "开始部署..."
echo "========================================"
echo ""

# 停止旧容器（如果存在）
echo "1. 停止旧容器..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || echo "没有运行中的容器"
echo ""

# 构建镜像
echo "2. 构建 Docker 镜像..."
docker compose build || docker-compose build
echo ""

# 启动服务
echo "3. 启动服务..."
docker compose up -d || docker-compose up -d
echo ""

# 等待服务启动
echo "4. 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "========================================"
echo "服务状态检查"
echo "========================================"
docker compose ps || docker-compose ps
echo ""

# 健康检查
echo "5. 健康检查..."
echo ""

# 检查 PostgreSQL
if docker exec anita-postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✓ PostgreSQL: 健康"
else
    echo "✗ PostgreSQL: 未就绪"
fi

# 检查后端 API
sleep 5
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo "✓ 后端 API: 健康"
else
    echo "✗ 后端 API: 未就绪"
fi

# 检查前端
if curl -s http://localhost/health | grep -q "healthy"; then
    echo "✓ 前端: 健康"
else
    echo "✗ 前端: 未就绪"
fi

echo ""
echo "========================================"
echo "部署完成!"
echo "========================================"
echo ""
echo "访问地址: http://localhost"
echo ""
echo "常用命令:"
echo "  查看日志: docker compose logs -f"
echo "  重启服务: docker compose restart"
echo "  停止服务: docker compose down"
echo ""
echo "详细文档请查看: DEPLOYMENT.md"
echo ""
