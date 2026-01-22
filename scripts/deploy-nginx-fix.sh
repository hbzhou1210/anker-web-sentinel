#!/bin/bash

###############################################################################
# Anita Project - 生产环境截图问题快速修复脚本
# 用途：自动配置Nginx以支持截图文件访问
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

###############################################################################
# 1. 检查权限
###############################################################################
print_header "1. 权限检查"

if [ "$EUID" -ne 0 ]; then
    print_warning "此脚本需要root权限才能修改Nginx配置"
    echo ""
    echo "请使用以下命令重新运行:"
    echo "  sudo $0"
    exit 1
fi

print_success "具有root权限"

###############################################################################
# 2. 检测Nginx
###############################################################################
print_header "2. 检测Nginx"

if ! command -v nginx &> /dev/null; then
    print_error "未检测到Nginx，请先安装"
    echo ""
    echo "安装命令:"
    echo "  Ubuntu/Debian: sudo apt-get install nginx"
    echo "  CentOS/RHEL:   sudo yum install nginx"
    exit 1
fi

NGINX_VERSION=$(nginx -v 2>&1 | cut -d/ -f2)
print_success "检测到 Nginx $NGINX_VERSION"

# 获取配置文件路径
NGINX_CONF=$(nginx -t 2>&1 | grep "configuration file" | awk '{print $NF}')
NGINX_CONF_DIR=$(dirname "$NGINX_CONF")

print_info "主配置文件: $NGINX_CONF"
print_info "配置目录: $NGINX_CONF_DIR"

###############################################################################
# 3. 查找现有Anita配置
###############################################################################
print_header "3. 查找现有配置"

# 可能的配置文件位置
POSSIBLE_CONFIGS=(
    "/etc/nginx/conf.d/anita-project.conf"
    "/etc/nginx/sites-enabled/anita-project"
    "/etc/nginx/sites-available/anita-project"
    "/etc/nginx/conf.d/default.conf"
)

ANITA_CONFIG=""
for conf in "${POSSIBLE_CONFIGS[@]}"; do
    if [ -f "$conf" ]; then
        # 检查是否包含10001端口
        if grep -q "listen.*10001" "$conf"; then
            ANITA_CONFIG="$conf"
            print_success "找到Anita配置: $conf"
            break
        fi
    fi
done

if [ -z "$ANITA_CONFIG" ]; then
    print_warning "未找到现有Anita配置，将创建新配置"
    ANITA_CONFIG="/etc/nginx/conf.d/anita-project.conf"
fi

###############################################################################
# 4. 检查是否已有截图配置
###############################################################################
print_header "4. 检查截图代理配置"

if [ -f "$ANITA_CONFIG" ] && grep -q "location /screenshots/" "$ANITA_CONFIG"; then
    print_info "配置文件已包含 /screenshots 配置"
    echo ""
    echo "现有配置:"
    grep -A 5 "location /screenshots/" "$ANITA_CONFIG"
    echo ""
    read -p "是否覆盖现有配置? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "保留现有配置，退出"
        exit 0
    fi
else
    print_info "未找到截图配置，将添加"
fi

###############################################################################
# 5. 备份现有配置
###############################################################################
print_header "5. 备份现有配置"

if [ -f "$ANITA_CONFIG" ]; then
    BACKUP_FILE="${ANITA_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ANITA_CONFIG" "$BACKUP_FILE"
    print_success "已备份到: $BACKUP_FILE"
else
    print_info "首次创建配置文件"
fi

###############################################################################
# 6. 添加截图配置
###############################################################################
print_header "6. 添加截图代理配置"

# 检测后端端口
BACKEND_PORT=${BACKEND_PORT:-3000}
print_info "后端端口: $BACKEND_PORT"

# 截图配置片段
SCREENSHOT_CONFIG='
    # ============================================================
    # 截图文件代理 - 由 deploy-nginx-fix.sh 自动添加
    # ============================================================
    location /screenshots/ {
        # 代理到后端Express静态文件服务
        proxy_pass http://localhost:'"$BACKEND_PORT"'/screenshots/;

        # 代理请求头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 截图缓存策略（7天）
        proxy_cache_valid 200 7d;
        proxy_cache_valid 404 1m;
        proxy_cache_bypass $http_cache_control;

        # 响应头优化
        add_header Cache-Control "public, max-age=604800";
        add_header X-Content-Type-Options "nosniff";

        # 超时设置
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
    }
'

if [ -f "$ANITA_CONFIG" ]; then
    # 如果已有配置，删除旧的截图配置并添加新的
    if grep -q "location /screenshots/" "$ANITA_CONFIG"; then
        # 删除旧的截图配置块
        sed -i.tmp '/# .*截图文件代理/,/^[[:space:]]*}/d' "$ANITA_CONFIG"
        rm -f "${ANITA_CONFIG}.tmp"
    fi

    # 在最后一个 } 之前插入新配置
    # 查找最后一个server块的结束位置
    LINE_NUM=$(grep -n "^}" "$ANITA_CONFIG" | tail -1 | cut -d: -f1)

    if [ -n "$LINE_NUM" ]; then
        # 在倒数第二行插入配置
        head -n $((LINE_NUM - 1)) "$ANITA_CONFIG" > "${ANITA_CONFIG}.new"
        echo "$SCREENSHOT_CONFIG" >> "${ANITA_CONFIG}.new"
        tail -n +$LINE_NUM "$ANITA_CONFIG" >> "${ANITA_CONFIG}.new"
        mv "${ANITA_CONFIG}.new" "$ANITA_CONFIG"
        print_success "已更新配置文件"
    else
        print_error "无法找到server块结束位置"
        exit 1
    fi
else
    # 创建新配置文件（使用模板）
    cat > "$ANITA_CONFIG" << 'EOF'
server {
    listen 10001;
    server_name _;

    # 前端静态文件
    location / {
        root /var/www/anita-project/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 请求代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

EOF
    echo "$SCREENSHOT_CONFIG" >> "$ANITA_CONFIG"
    echo "}" >> "$ANITA_CONFIG"

    print_success "已创建新配置文件"
fi

###############################################################################
# 7. 验证配置
###############################################################################
print_header "7. 验证Nginx配置"

if nginx -t 2>&1; then
    print_success "Nginx配置语法正确"
else
    print_error "Nginx配置语法错误"
    echo ""
    echo "请检查配置文件: $ANITA_CONFIG"
    echo "恢复备份: cp $BACKUP_FILE $ANITA_CONFIG"
    exit 1
fi

###############################################################################
# 8. 重启Nginx
###############################################################################
print_header "8. 重启Nginx"

if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    print_success "Nginx已重新加载"
elif service nginx status &> /dev/null; then
    service nginx reload
    print_success "Nginx已重新加载"
else
    nginx -s reload
    print_success "Nginx已重新加载"
fi

###############################################################################
# 9. 验证修复
###############################################################################
print_header "9. 验证修复"

echo ""
print_info "配置已完成，请进行以下验证:"
echo ""
echo "1. 检查后端服务是否运行:"
echo "   curl http://localhost:3000/health"
echo ""
echo "2. 测试截图URL访问（通过Nginx）:"
echo "   curl -I http://localhost:10001/screenshots/test.webp"
echo ""
echo "3. 在浏览器中访问响应式测试工具:"
echo "   http://172.16.38.135:10001/tools/responsive"
echo ""
echo "4. 运行完整诊断:"
echo "   bash /path/to/scripts/diagnose-screenshots.sh"
echo ""

# 自动测试健康端点
echo "自动测试后端健康状态..."
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    print_success "后端服务正常运行"
else
    print_warning "后端服务可能未运行，请检查"
    echo "   systemctl status backend"
    echo "   pm2 list"
fi

###############################################################################
# 10. 完成
###############################################################################
print_header "部署完成"

print_success "截图代理配置已添加到 $ANITA_CONFIG"
print_info "配置备份: $BACKUP_FILE"

echo ""
echo "如果问题仍未解决，请查看文档:"
echo "  docs/production-screenshot-fix.md"
echo ""
