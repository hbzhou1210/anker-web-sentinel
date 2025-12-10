#!/bin/bash
# 本地构建 Docker 镜像并推送到 Launch 平台

set -e

echo "========================================="
echo "🐳 Anita 项目 - 本地构建 Docker 镜像"
echo "========================================="

# 配置
IMAGE_NAME="anita-web-sentinel"
IMAGE_TAG="latest"
# TODO: 替换为你的 Launch 平台镜像仓库地址
REGISTRY="your-registry.launch.anker-in.com"

echo ""
echo "📦 步骤 1/4: 构建 Docker 镜像..."
echo "镜像名称: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# 禁用 BuildKit
export DOCKER_BUILDKIT=0

docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo ""
echo "✅ 镜像构建成功!"
echo ""

echo "📋 步骤 2/4: 查看镜像信息..."
docker images | grep ${IMAGE_NAME}

echo ""
echo "🏷️  步骤 3/4: 给镜像打标签..."
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}

echo ""
echo "📤 步骤 4/4: 推送镜像到 Launch 平台..."
echo "推送地址: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# 登录镜像仓库(如果需要)
# docker login ${REGISTRY}

# 推送镜像
docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}

echo ""
echo "========================================="
echo "✅ 镜像构建和推送完成!"
echo "========================================="
echo "镜像地址: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "下一步:"
echo "1. 在 Launch 平台选择 '镜像部署' 模式"
echo "2. 填写镜像地址: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "3. 点击部署"
echo "========================================="
