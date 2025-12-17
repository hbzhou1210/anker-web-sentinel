# Backend Dockerfile
FROM node:20-slim

# 安装系统依赖(包括 git 用于获取版本信息)
RUN apt-get update && apt-get install -y \
    git \
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

# 复制源代码(包括 .git 目录以获取版本信息)
COPY . .

# 生成版本信息文件
# 尝试从 Git 获取 commit hash,如果失败则使用 unknown
RUN GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") && \
    BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) && \
    echo "{\"git_commit\":\"$GIT_COMMIT\",\"build_date\":\"$BUILD_DATE\",\"version\":\"1.0.0\"}" > /app/version.json && \
    cat /app/version.json

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

# Chromium 稳定性环境变量
ENV PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW=1
ENV CHROMIUM_FLAGS="--disable-dev-shm-usage --no-sandbox"

# 暴露端口
EXPOSE 3000

# 启动应用
# 注意: 如果遇到浏览器崩溃问题,请在 docker run 或 docker-compose.yml 中添加:
# --shm-size=512m (增加共享内存大小)
# 或者使用卷挂载: -v /dev/shm:/dev/shm
CMD ["npm", "start"]
