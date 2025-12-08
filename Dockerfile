# Anita 项目 - 简化部署版本
# 使用传统 Docker 构建,避免 BuildKit 问题

FROM node:20-slim

# 一次性安装所有系统依赖
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libxshmfence1 \
    fonts-noto-color-emoji fonts-wqy-zenhei \
    postgresql-client nginx supervisor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制所有文件(利用 .dockerignore 排除不需要的)
COPY . .

# 安装依赖和构建(单个 RUN 命令)
RUN npm install \
    && npx playwright install chromium \
    && cd backend && npm run build && cd .. \
    && cd frontend && npm run build && cd .. \
    && mkdir -p /app/backend/screenshots /var/log/supervisor \
    && chmod +x /docker-entrypoint.sh \
    && rm -rf /root/.cache /root/.npm

# 配置 Nginx
RUN cp frontend/nginx.conf /etc/nginx/sites-available/default

# 暴露端口
EXPOSE 80 3000

# 启动
CMD ["/docker-entrypoint.sh"]
