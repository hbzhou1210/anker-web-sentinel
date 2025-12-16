# Backend Dockerfile
FROM node:20-slim

# 安装 Playwright 依赖
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-noto-color-emoji \
    fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 安装 Playwright 浏览器
RUN npx playwright install chromium

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 安装 tools 目录下的依赖
RUN cd /app/tools/function-discount-checker && \
    npm install --production && \
    cd /app

# 创建必要的运行时目录
RUN mkdir -p /app/screenshots && \
    mkdir -p /app/tools/function-discount-checker/output

# 设置环境变量禁用不必要的服务
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null
ENV FONTCONFIG_PATH=/etc/fonts

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
