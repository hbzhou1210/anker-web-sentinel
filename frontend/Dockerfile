# Frontend Dockerfile - Multi-stage build
FROM node:20-slim AS builder

# 安装 git 用于获取版本信息
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码(包括 .git 目录)
COPY . .

# 生成版本信息文件到 public 目录(会被复制到 dist)
RUN mkdir -p /app/public && \
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") && \
    BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) && \
    echo "{\"git_commit\":\"$GIT_COMMIT\",\"build_date\":\"$BUILD_DATE\",\"version\":\"1.0.0\"}" > /app/public/version.json && \
    cat /app/public/version.json

# 构建应用
RUN npm run build

# 生产环境镜像 - 使用 nginx 提供静态文件
FROM nginx:alpine

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从 builder 复制构建产物(包含version.json)
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
