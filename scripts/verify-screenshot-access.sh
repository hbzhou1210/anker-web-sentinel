#!/bin/bash

###############################################################################
# 截图访问快速验证脚本
# 用于测试截图URL在生产环境是否可以正常访问
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

# 配置
BACKEND_URL=${BACKEND_URL:-"http://localhost:3000"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:10001"}
SCREENSHOT_DIR=${SCREENSHOT_DIR:-"/tmp/screenshots"}

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}   截图访问验证工具${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

###############################################################################
# 1. 检查截图目录
###############################################################################
echo -e "${BLUE}[1/5] 检查截图目录${NC}"

if [ ! -d "$SCREENSHOT_DIR" ]; then
    print_error "截图目录不存在: $SCREENSHOT_DIR"
    exit 1
fi

print_success "截图目录存在: $SCREENSHOT_DIR"

# 查找最新的截图文件
LATEST_SCREENSHOT=$(find "$SCREENSHOT_DIR" -type f -name "*.webp" -printf "%T@ %p\n" 2>/dev/null | \
    sort -rn | head -1 | awk '{print $2}')

if [ -z "$LATEST_SCREENSHOT" ]; then
    print_warning "未找到任何截图文件"
    echo ""
    print_info "请先运行响应式测试以生成截图"
    exit 0
fi

FILENAME=$(basename "$LATEST_SCREENSHOT")
FILESIZE=$(du -h "$LATEST_SCREENSHOT" | cut -f1)

print_success "找到最新截图: $FILENAME (${FILESIZE})"

###############################################################################
# 2. 测试后端直接访问
###############################################################################
echo ""
echo -e "${BLUE}[2/5] 测试后端直接访问${NC}"

BACKEND_SCREENSHOT_URL="${BACKEND_URL}/screenshots/${FILENAME}"
print_info "测试URL: $BACKEND_SCREENSHOT_URL"

BACKEND_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_SCREENSHOT_URL")

if [ "$BACKEND_HTTP_CODE" = "200" ]; then
    print_success "后端直接访问成功 (HTTP $BACKEND_HTTP_CODE)"

    # 获取文件大小
    CONTENT_LENGTH=$(curl -s -I "$BACKEND_SCREENSHOT_URL" | grep -i "content-length" | awk '{print $2}' | tr -d '\r\n')
    if [ -n "$CONTENT_LENGTH" ]; then
        SIZE_KB=$((CONTENT_LENGTH / 1024))
        print_info "文件大小: ${SIZE_KB}KB"
    fi
else
    print_error "后端直接访问失败 (HTTP $BACKEND_HTTP_CODE)"

    if [ "$BACKEND_HTTP_CODE" = "404" ]; then
        print_warning "可能原因: Express静态文件中间件未配置"
    elif [ "$BACKEND_HTTP_CODE" = "000" ]; then
        print_warning "可能原因: 后端服务未运行"
    fi
fi

###############################################################################
# 3. 测试前端代理访问
###############################################################################
echo ""
echo -e "${BLUE}[3/5] 测试前端代理访问${NC}"

FRONTEND_SCREENSHOT_URL="${FRONTEND_URL}/screenshots/${FILENAME}"
print_info "测试URL: $FRONTEND_SCREENSHOT_URL"

FRONTEND_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_SCREENSHOT_URL")

if [ "$FRONTEND_HTTP_CODE" = "200" ]; then
    print_success "前端代理访问成功 (HTTP $FRONTEND_HTTP_CODE)"
else
    print_error "前端代理访问失败 (HTTP $FRONTEND_HTTP_CODE)"

    if [ "$FRONTEND_HTTP_CODE" = "404" ]; then
        print_warning "可能原因: Nginx未配置/screenshots代理"
        echo ""
        echo "解决方案:"
        echo "  1. 运行修复脚本: sudo ./scripts/deploy-nginx-fix.sh"
        echo "  2. 手动添加Nginx配置:"
        echo ""
        echo "     location /screenshots/ {"
        echo "         proxy_pass http://localhost:3000/screenshots/;"
        echo "         proxy_set_header Host \$host;"
        echo "     }"
    elif [ "$FRONTEND_HTTP_CODE" = "502" ] || [ "$FRONTEND_HTTP_CODE" = "503" ]; then
        print_warning "可能原因: 后端服务未运行或Nginx配置错误"
    elif [ "$FRONTEND_HTTP_CODE" = "000" ]; then
        print_warning "可能原因: 前端服务未运行"
    fi
fi

###############################################################################
# 4. 检查后端健康状态
###############################################################################
echo ""
echo -e "${BLUE}[4/5] 检查后端健康状态${NC}"

HEALTH_URL="${BACKEND_URL}/health"

if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
    print_success "后端服务健康"
    print_info "响应: $HEALTH_RESPONSE"
else
    print_error "后端服务异常"
    echo ""
    echo "检查后端服务:"
    echo "  systemctl status backend"
    echo "  pm2 list"
    echo "  docker ps | grep backend"
fi

###############################################################################
# 5. 检查Nginx配置
###############################################################################
echo ""
echo -e "${BLUE}[5/5] 检查Nginx配置${NC}"

if command -v nginx &> /dev/null; then
    print_success "检测到Nginx"

    # 查找截图配置
    if grep -r "location /screenshots/" /etc/nginx/ 2>/dev/null | head -1; then
        print_success "找到/screenshots配置"
    else
        print_warning "未找到/screenshots配置"
        echo ""
        echo "建议运行: sudo ./scripts/deploy-nginx-fix.sh"
    fi
else
    print_info "未检测到Nginx（可能使用其他反向代理）"
fi

###############################################################################
# 总结
###############################################################################
echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}   验证总结${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

SUCCESS_COUNT=0
TOTAL_CHECKS=3

# 检查1: 截图目录
if [ -d "$SCREENSHOT_DIR" ] && [ -n "$LATEST_SCREENSHOT" ]; then
    print_success "截图文件存在"
    ((SUCCESS_COUNT++))
else
    print_error "截图文件不存在"
fi

# 检查2: 后端直接访问
if [ "$BACKEND_HTTP_CODE" = "200" ]; then
    print_success "后端直接访问正常"
    ((SUCCESS_COUNT++))
else
    print_error "后端直接访问失败 (HTTP $BACKEND_HTTP_CODE)"
fi

# 检查3: 前端代理访问
if [ "$FRONTEND_HTTP_CODE" = "200" ]; then
    print_success "前端代理访问正常"
    ((SUCCESS_COUNT++))
else
    print_error "前端代理访问失败 (HTTP $FRONTEND_HTTP_CODE)"
fi

echo ""
echo "通过检查: $SUCCESS_COUNT/$TOTAL_CHECKS"

if [ "$SUCCESS_COUNT" -eq "$TOTAL_CHECKS" ]; then
    echo ""
    print_success "所有检查通过！截图功能正常工作"
    echo ""
elif [ "$BACKEND_HTTP_CODE" = "200" ] && [ "$FRONTEND_HTTP_CODE" != "200" ]; then
    echo ""
    print_warning "后端正常但前端访问失败 → Nginx配置问题"
    echo ""
    echo "快速修复:"
    echo "  sudo ./scripts/deploy-nginx-fix.sh"
    echo ""
else
    echo ""
    print_warning "存在问题，请查看上述详细信息"
    echo ""
    echo "完整诊断:"
    echo "  ./scripts/diagnose-screenshots.sh"
    echo ""
fi
