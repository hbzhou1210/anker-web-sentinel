# Anita 项目 - 完整部署 (前端 + 后端)
# 适用于 Launch 平台 Docker 部署

FROM node:20-slim

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    # Playwright 浏览器依赖
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libxshmfence1 \
    # 字体支持
    fonts-noto-color-emoji fonts-wqy-zenhei \
    # PostgreSQL 客户端
    postgresql-client \
    # Nginx (用于前端)
    nginx \
    # 进程管理
    supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 安装根目录依赖和 Playwright 浏览器（合并以减少层数）
RUN npm install && \
    npx playwright install chromium && \
    rm -rf /root/.cache

# 复制源码
COPY backend ./backend
COPY frontend ./frontend

# 构建后端和前端（合并以减少层数）
WORKDIR /app/backend
RUN npm run build

WORKDIR /app/frontend
RUN npm run build && \
    mkdir -p /var/log/supervisor

# 配置 Nginx 和创建必要目录
WORKDIR /app
RUN mkdir -p /app/backend/screenshots
COPY frontend/nginx.conf /etc/nginx/sites-available/default

# 复制 Supervisor 配置
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 暴露端口
# 80: 前端 Nginx
# 3000: 后端 API
EXPOSE 80 3000

# 启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /app

CMD ["/docker-entrypoint.sh"]
