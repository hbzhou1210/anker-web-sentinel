#!/bin/bash

###############################################################################
# 截图问题诊断脚本
# 用于快速定位生产环境中截图无法显示的问题
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SCREENSHOT_DIR="${SCREENSHOT_DIR:-/tmp/screenshots}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

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
# 1. 环境信息检查
###############################################################################
print_header "1. 环境信息"

echo "操作系统: $(uname -s)"
echo "内核版本: $(uname -r)"
echo "主机名: $(hostname)"
echo "当前用户: $(whoami)"
echo "当前目录: $(pwd)"
echo "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 检查是否在容器中
if [ -f /.dockerenv ]; then
    print_info "运行在 Docker 容器中"
elif grep -q docker /proc/1/cgroup 2>/dev/null; then
    print_info "运行在 Docker 容器中"
else
    print_info "运行在主机环境"
fi

###############################################################################
# 2. 截图目录检查
###############################################################################
print_header "2. 截图目录检查"

echo "配置的截图目录: $SCREENSHOT_DIR"

# 检查目录是否存在
if [ -d "$SCREENSHOT_DIR" ]; then
    print_success "截图目录存在"

    # 显示目录信息
    echo ""
    echo "目录详情:"
    ls -ld "$SCREENSHOT_DIR"

    # 检查权限
    if [ -r "$SCREENSHOT_DIR" ] && [ -w "$SCREENSHOT_DIR" ] && [ -x "$SCREENSHOT_DIR" ]; then
        print_success "目录权限正常 (可读、可写、可执行)"
    else
        print_error "目录权限不足"
        echo "  可读: $([ -r "$SCREENSHOT_DIR" ] && echo '是' || echo '否')"
        echo "  可写: $([ -w "$SCREENSHOT_DIR" ] && echo '是' || echo '否')"
        echo "  可执行: $([ -x "$SCREENSHOT_DIR" ] && echo '是' || echo '否')"
    fi

    # 统计截图文件
    echo ""
    echo "截图文件统计:"
    TOTAL_FILES=$(find "$SCREENSHOT_DIR" -type f -name "*.webp" 2>/dev/null | wc -l)
    echo "  WebP 文件总数: $TOTAL_FILES"

    if [ "$TOTAL_FILES" -gt 0 ]; then
        TOTAL_SIZE=$(du -sh "$SCREENSHOT_DIR" 2>/dev/null | cut -f1)
        echo "  总大小: $TOTAL_SIZE"

        echo ""
        echo "最新的 5 个截图文件:"
        find "$SCREENSHOT_DIR" -type f -name "*.webp" -printf "%T@ %p\n" 2>/dev/null | \
            sort -rn | head -5 | while read timestamp filepath; do
            filename=$(basename "$filepath")
            filesize=$(du -h "$filepath" | cut -f1)
            filetime=$(stat -c %y "$filepath" 2>/dev/null || stat -f "%Sm" "$filepath" 2>/dev/null)
            echo "  - $filename (${filesize}, $filetime)"
        done
    else
        print_warning "未找到任何 WebP 截图文件"
    fi

    # 检查子目录
    echo ""
    echo "子目录:"
    ls -la "$SCREENSHOT_DIR" 2>/dev/null | grep "^d" || echo "  (无子目录)"

else
    print_error "截图目录不存在: $SCREENSHOT_DIR"
    echo ""
    echo "尝试创建目录..."
    if mkdir -p "$SCREENSHOT_DIR" 2>/dev/null; then
        print_success "目录创建成功"
    else
        print_error "目录创建失败 (权限不足?)"
    fi
fi

###############################################################################
# 3. 后端服务检查
###############################################################################
print_header "3. 后端服务检查"

echo "后端 URL: $BACKEND_URL"

# 检查后端健康状态
echo ""
echo "检查健康端点..."
if curl -s -f -o /dev/null "$BACKEND_URL/health"; then
    print_success "后端服务健康检查通过"
    HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/health")
    echo "  响应: $HEALTH_RESPONSE"
else
    print_error "后端服务健康检查失败"
    echo "  请确保后端服务正在运行: $BACKEND_URL"
fi

# 测试截图静态文件访问
echo ""
echo "测试截图静态文件访问..."

LATEST_SCREENSHOT=$(find "$SCREENSHOT_DIR" -type f -name "*.webp" -printf "%T@ %p\n" 2>/dev/null | \
    sort -rn | head -1 | awk '{print $2}')

if [ -n "$LATEST_SCREENSHOT" ]; then
    FILENAME=$(basename "$LATEST_SCREENSHOT")
    SCREENSHOT_URL="$BACKEND_URL/screenshots/$FILENAME"

    echo "测试 URL: $SCREENSHOT_URL"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SCREENSHOT_URL")

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "截图文件可访问 (HTTP $HTTP_CODE)"

        # 获取文件信息
        CONTENT_TYPE=$(curl -s -I "$SCREENSHOT_URL" | grep -i "content-type" | cut -d: -f2 | tr -d ' \r\n')
        CONTENT_LENGTH=$(curl -s -I "$SCREENSHOT_URL" | grep -i "content-length" | cut -d: -f2 | tr -d ' \r\n')

        echo "  Content-Type: $CONTENT_TYPE"
        echo "  Content-Length: $CONTENT_LENGTH bytes"

        if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
            print_success "文件有内容 ($(numfmt --to=iec $CONTENT_LENGTH 2>/dev/null || echo $CONTENT_LENGTH))"
        else
            print_warning "文件大小为 0"
        fi

    elif [ "$HTTP_CODE" = "404" ]; then
        print_error "截图文件不可访问 (HTTP 404 Not Found)"
        echo "  可能原因:"
        echo "    1. Express 静态文件中间件未正确配置"
        echo "    2. 路由路径配置错误"
        echo "    3. Nginx 代理配置问题"
    elif [ "$HTTP_CODE" = "403" ]; then
        print_error "截图文件访问被拒绝 (HTTP 403 Forbidden)"
        echo "  可能原因:"
        echo "    1. 文件权限不足"
        echo "    2. 目录权限不足"
    elif [ "$HTTP_CODE" = "000" ]; then
        print_error "无法连接到后端服务"
        echo "  请检查后端服务是否正在运行"
    else
        print_error "截图文件访问异常 (HTTP $HTTP_CODE)"
    fi
else
    print_warning "未找到截图文件进行测试"
fi

###############################################################################
# 4. Nginx 配置检查 (如果适用)
###############################################################################
print_header "4. Nginx 配置检查"

# 检查 Nginx 是否运行
if command -v nginx &> /dev/null; then
    print_info "检测到 Nginx 已安装"

    NGINX_VERSION=$(nginx -v 2>&1 | cut -d/ -f2)
    echo "Nginx 版本: $NGINX_VERSION"

    # 检查 Nginx 是否运行
    if pgrep -x nginx > /dev/null; then
        print_success "Nginx 正在运行"

        # 尝试查找配置文件
        echo ""
        echo "查找 Nginx 配置文件..."

        NGINX_CONF=$(nginx -t 2>&1 | grep "configuration file" | awk '{print $NF}')
        if [ -f "$NGINX_CONF" ]; then
            echo "配置文件: $NGINX_CONF"

            # 检查是否配置了 /screenshots 路径
            echo ""
            echo "检查 /screenshots 路径配置..."
            if grep -r "location.*screenshots" /etc/nginx/ 2>/dev/null; then
                print_success "找到 /screenshots 路径配置"
            else
                print_warning "未找到 /screenshots 路径配置"
                echo ""
                echo "建议添加以下配置到 Nginx:"
                echo ""
                echo "  location /screenshots/ {"
                echo "      proxy_pass http://backend:3000;"
                echo "      proxy_set_header Host \$host;"
                echo "      proxy_set_header X-Real-IP \$remote_addr;"
                echo "      proxy_cache_valid 200 7d;"
                echo "      add_header Cache-Control \"public, max-age=604800\";"
                echo "  }"
            fi
        fi
    else
        print_warning "Nginx 未运行"
    fi
else
    print_info "未检测到 Nginx (可能使用其他反向代理)"
fi

###############################################################################
# 5. 网络连通性测试
###############################################################################
print_header "5. 网络连通性测试"

# 测试后端端口
echo "测试后端服务端口..."
BACKEND_HOST=$(echo "$BACKEND_URL" | sed -e 's|http[s]*://||' -e 's|/.*||' -e 's|:.*||')
BACKEND_PORT=$(echo "$BACKEND_URL" | grep -o ':[0-9]*' | tr -d ':')
BACKEND_PORT=${BACKEND_PORT:-3000}

if command -v nc &> /dev/null; then
    if nc -z "$BACKEND_HOST" "$BACKEND_PORT" 2>/dev/null; then
        print_success "后端端口 $BACKEND_PORT 可访问"
    else
        print_error "后端端口 $BACKEND_PORT 不可访问"
    fi
elif command -v telnet &> /dev/null; then
    if timeout 2 telnet "$BACKEND_HOST" "$BACKEND_PORT" 2>/dev/null | grep -q "Connected"; then
        print_success "后端端口 $BACKEND_PORT 可访问"
    else
        print_error "后端端口 $BACKEND_PORT 不可访问"
    fi
else
    print_warning "未找到 nc 或 telnet 命令，跳过端口测试"
fi

###############################################################################
# 6. 环境变量检查
###############################################################################
print_header "6. 环境变量检查"

echo "关键环境变量:"
echo "  SCREENSHOT_DIR: ${SCREENSHOT_DIR:-未设置}"
echo "  NODE_ENV: ${NODE_ENV:-未设置}"
echo "  PORT: ${PORT:-未设置}"

###############################################################################
# 7. 进程检查
###############################################################################
print_header "7. 进程检查"

echo "Node.js 进程:"
ps aux | grep -E "node|npm" | grep -v grep | head -5 || echo "  未找到 Node.js 进程"

###############################################################################
# 8. 日志检查 (最近的错误)
###############################################################################
print_header "8. 日志检查"

# 尝试查找常见日志位置
LOG_LOCATIONS=(
    "/var/log/nginx/error.log"
    "/var/log/nginx/access.log"
    "/var/log/app/error.log"
    "./logs/error.log"
    "./backend/logs/error.log"
)

echo "搜索最近的错误日志..."
for log_file in "${LOG_LOCATIONS[@]}"; do
    if [ -f "$log_file" ]; then
        echo ""
        echo "检查: $log_file"
        RECENT_ERRORS=$(tail -50 "$log_file" | grep -i "screenshot\|error\|404" | tail -5)
        if [ -n "$RECENT_ERRORS" ]; then
            echo "$RECENT_ERRORS"
        else
            echo "  (最近 50 行无相关错误)"
        fi
    fi
done

###############################################################################
# 9. 生成测试报告
###############################################################################
print_header "9. 诊断总结"

echo ""
echo "问题诊断清单:"
echo ""

# 目录存在性
if [ -d "$SCREENSHOT_DIR" ]; then
    print_success "截图目录存在"
else
    print_error "截图目录不存在 → 需要创建目录"
fi

# 目录权限
if [ -r "$SCREENSHOT_DIR" ] && [ -w "$SCREENSHOT_DIR" ] && [ -x "$SCREENSHOT_DIR" ]; then
    print_success "目录权限正常"
else
    print_error "目录权限不足 → 需要修改权限: chmod 755 $SCREENSHOT_DIR"
fi

# 文件数量
if [ "$TOTAL_FILES" -gt 0 ]; then
    print_success "存在截图文件 ($TOTAL_FILES 个)"
else
    print_warning "无截图文件 → 可能测试尚未运行"
fi

# 后端健康
if curl -s -f -o /dev/null "$BACKEND_URL/health"; then
    print_success "后端服务正常"
else
    print_error "后端服务异常 → 检查服务是否启动"
fi

# 静态文件访问
if [ -n "$LATEST_SCREENSHOT" ] && [ "$HTTP_CODE" = "200" ]; then
    print_success "截图文件可通过后端访问"
elif [ -n "$LATEST_SCREENSHOT" ] && [ "$HTTP_CODE" = "404" ]; then
    print_error "截图文件返回 404 → 检查 Express 静态文件配置或 Nginx 代理"
elif [ -n "$LATEST_SCREENSHOT" ]; then
    print_error "截图文件访问异常 (HTTP $HTTP_CODE) → 检查服务配置"
fi

###############################################################################
# 10. 建议操作
###############################################################################
print_header "10. 建议操作"

echo ""
echo "如果截图无法显示，请按以下步骤排查:"
echo ""
echo "1. 确认截图目录存在且有权限:"
echo "   mkdir -p $SCREENSHOT_DIR"
echo "   chmod 755 $SCREENSHOT_DIR"
echo ""
echo "2. 确认 Express 静态文件配置正确 (backend/src/api/middleware/staticFiles.ts):"
echo "   app.use('/screenshots', express.static('$SCREENSHOT_DIR'))"
echo ""
echo "3. 如果使用 Nginx，添加代理配置:"
echo "   location /screenshots/ {"
echo "       proxy_pass http://backend:3000;"
echo "   }"
echo ""
echo "4. 重启服务:"
echo "   # 重启后端"
echo "   pm2 restart backend"
echo "   # 或重启 Docker 容器"
echo "   docker-compose restart backend"
echo ""
echo "5. 查看实时日志:"
echo "   tail -f /var/log/nginx/error.log"
echo "   pm2 logs backend"
echo ""

print_header "诊断完成"

echo ""
echo "报告生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
