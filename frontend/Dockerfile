# Frontend Dockerfile - Multi-stage build
FROM node:20-slim AS builder

# 构建参数 - 用于追踪镜像版本
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ARG VERSION=1.0.0

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 创建版本信息文件
RUN echo "{\"git_commit\":\"$GIT_COMMIT\",\"build_date\":\"$BUILD_DATE\",\"version\":\"$VERSION\"}" > /app/dist/version.json

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
