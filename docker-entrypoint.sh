#!/bin/bash
set -e

echo "==================================="
echo "🚀 Anita 项目启动中..."
echo "==================================="

# 如果环境变量未设置,从 backend/.env 读取
if [ -z "$DATABASE_STORAGE" ] && [ -f "/app/backend/.env" ]; then
    export $(grep -v '^#' /app/backend/.env | grep DATABASE_STORAGE | xargs)
fi

# 检查数据存储模式(默认使用 bitable)
if [ "$DATABASE_STORAGE" = "bitable" ] || [ -z "$DATABASE_STORAGE" ]; then
    echo "📊 使用 Bitable 存储模式,跳过 PostgreSQL 检查和迁移"

    # 确保环境变量设置为 bitable
    export DATABASE_STORAGE=bitable
else
    # 检查必需的环境变量
    if [ -z "$DATABASE_URL" ]; then
        echo "⚠️  警告: DATABASE_URL 未设置"
        echo "使用默认值: postgresql://postgres:postgres@localhost:5432/web_automation_checker"
        export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/web_automation_checker"
    fi

    # 等待数据库就绪(如果使用外部数据库)
    echo "📊 检查 PostgreSQL 连接..."
    for i in {1..30}; do
        if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
            echo "✅ 数据库连接成功"
            break
        fi
        echo "⏳ 等待数据库... ($i/30)"
        sleep 2
    done

    # 运行数据库迁移
    echo "🔄 运行数据库迁移..."
    cd /app/backend
    npm run migrate || echo "⚠️  数据库迁移失败,可能已经执行过"
fi

# 复制前端构建文件到 Nginx 目录
echo "📦 复制前端文件..."
rm -rf /usr/share/nginx/html/*
cp -r /app/dist/frontend/* /usr/share/nginx/html/

# 更新 Nginx 配置
echo "⚙️  配置 Nginx..."
cat > /etc/nginx/sites-available/default <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理到后端
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3000;
    }

    # 截图文件
    location /screenshots {
        proxy_pass http://localhost:3000;
    }

    # SPA 路由处理
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 启动 Nginx
echo "🌐 启动 Nginx..."
nginx -t
nginx

# 启动后端服务
echo "⚡ 启动后端 API..."
cd /app/backend
npm start &

BACKEND_PID=$!

echo "==================================="
echo "✅ 启动完成!"
echo "==================================="
echo "前端: http://localhost:80"
echo "后端: http://localhost:3000"
echo "健康检查: http://localhost:80/health"
echo "==================================="

# 保持容器运行
wait $BACKEND_PID
