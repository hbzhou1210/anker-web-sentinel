#!/bin/bash

###############################################################################
# PageSpeed Insights API 配额检查脚本
# 用途: 检查 PageSpeed API 的配额使用情况和可用性
# 用法: ./scripts/check-pagespeed-quota.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

echo ""
echo "=========================================="
echo "PageSpeed Insights API 配额检查"
echo "=========================================="
echo ""

###############################################################################
# 1. 检查 API Key 配置
###############################################################################
log_info "步骤 1: 检查 API Key 配置"
echo ""

# 从 .env.production 读取
if [ -f "backend/.env.production" ]; then
    API_KEY=$(grep "^PAGESPEED_API_KEY=" backend/.env.production | cut -d'=' -f2)
    if [ -z "$API_KEY" ]; then
        log_error "backend/.env.production 中未配置 PAGESPEED_API_KEY"
        exit 1
    else
        log_success "找到 API Key: ${API_KEY:0:20}..."
    fi
else
    log_error "未找到 backend/.env.production 文件"
    exit 1
fi

echo ""

###############################################################################
# 2. 测试 API 可用性
###############################################################################
log_info "步骤 2: 测试 API 可用性"
echo ""

TEST_URL="https://www.example.com"
log_info "测试 URL: $TEST_URL"

# 调用 API
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$TEST_URL&strategy=mobile&category=performance&key=$API_KEY" \
  2>&1)

# 分离响应体和状态码
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
TOTAL_LINES=$(echo "$RESPONSE" | wc -l)
BODY_LINES=$((TOTAL_LINES - 1))
RESPONSE_BODY=$(echo "$RESPONSE" | head -n $BODY_LINES)

echo "HTTP 状态码: $HTTP_CODE"

# 检查状态码
if [ "$HTTP_CODE" = "200" ]; then
    log_success "API 调用成功!"

    # 检查是否有性能分数
    PERF_SCORE=$(echo "$RESPONSE_BODY" | grep -o '"score":[0-9.]*' | head -1 | cut -d':' -f2)
    if [ ! -z "$PERF_SCORE" ]; then
        PERF_SCORE_INT=$(echo "$PERF_SCORE * 100" | bc | cut -d'.' -f1)
        log_success "性能分数: $PERF_SCORE_INT/100"
    fi

elif [ "$HTTP_CODE" = "429" ]; then
    log_error "API 配额已用完! (HTTP 429 - Too Many Requests)"
    echo ""
    echo "配额信息:"
    echo "  - 免费配额: 25,000 次/天"
    echo "  - 已用完或接近上限"
    echo ""
    echo "解决方案:"
    echo "  1. 等待配额重置(每天 UTC 午夜)"
    echo "  2. 在 Google Cloud Console 增加配额"
    echo "  3. 使用其他 API Key"
    echo ""
    echo "错误详情:"
    echo "$RESPONSE_BODY" | grep -i "error" | head -10
    exit 1

elif [ "$HTTP_CODE" = "403" ]; then
    log_error "API Key 认证失败! (HTTP 403 - Forbidden)"
    echo ""
    echo "可能原因:"
    echo "  1. API Key 无效或已过期"
    echo "  2. API Key 没有启用 PageSpeed Insights API"
    echo "  3. API Key 的域名/IP 限制"
    echo ""
    echo "错误详情:"
    echo "$RESPONSE_BODY" | grep -i "error" | head -10
    exit 1

elif [ "$HTTP_CODE" = "400" ]; then
    log_error "请求参数错误! (HTTP 400 - Bad Request)"
    echo ""
    echo "错误详情:"
    echo "$RESPONSE_BODY" | grep -i "error" | head -10
    exit 1

else
    log_error "API 调用失败! (HTTP $HTTP_CODE)"
    echo ""
    echo "响应详情:"
    echo "$RESPONSE_BODY" | head -30
    exit 1
fi

echo ""

###############################################################################
# 3. 连续测试(检查配额状态)
###############################################################################
log_info "步骤 3: 连续测试配额状态"
echo ""

read -p "是否进行 5 次连续测试来评估配额状态? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SUCCESS_COUNT=0
    FAIL_COUNT=0

    for i in {1..5}; do
        log_info "测试 $i/5..."

        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
          "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$TEST_URL&strategy=mobile&category=performance&key=$API_KEY")

        if [ "$HTTP_CODE" = "200" ]; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            echo "  ✓ 成功 (HTTP $HTTP_CODE)"
        elif [ "$HTTP_CODE" = "429" ]; then
            FAIL_COUNT=$((FAIL_COUNT + 1))
            echo "  ✗ 配额已满 (HTTP $HTTP_CODE)"
            break
        else
            FAIL_COUNT=$((FAIL_COUNT + 1))
            echo "  ✗ 失败 (HTTP $HTTP_CODE)"
        fi

        # 间隔 2 秒
        if [ $i -lt 5 ]; then
            sleep 2
        fi
    done

    echo ""
    echo "测试结果:"
    echo "  成功: $SUCCESS_COUNT/5"
    echo "  失败: $FAIL_COUNT/5"

    if [ $SUCCESS_COUNT -eq 5 ]; then
        log_success "API 配额充足,可以正常使用"
    elif [ $SUCCESS_COUNT -gt 0 ]; then
        log_warning "API 部分可用,可能接近配额上限"
    else
        log_error "API 配额已用完或不可用"
    fi
fi

echo ""

###############################################################################
# 4. 配额管理建议
###############################################################################
log_info "步骤 4: 配额管理建议"
echo ""

echo "PageSpeed Insights API 配额信息:"
echo "  📊 免费配额: 25,000 次/天"
echo "  🔄 重置时间: 每天 UTC 午夜 (北京时间 8:00)"
echo "  💰 付费配额: 可在 Google Cloud Console 增加"
echo ""
echo "查看配额使用情况:"
echo "  1. 访问 Google Cloud Console"
echo "  2. 导航到: APIs & Services → Dashboard"
echo "  3. 选择: PageSpeed Insights API"
echo "  4. 查看 Quota 标签页"
echo ""
echo "优化建议:"
echo "  ✓ 合理安排测试时间,避免短时间大量调用"
echo "  ✓ 使用缓存机制,避免重复测试相同 URL"
echo "  ✓ 考虑使用 WebPageTest API 作为备选"
echo "  ✓ 生产环境考虑申请更高配额"

echo ""

###############################################################################
# 5. 检查 Google Cloud Console 配置
###############################################################################
log_info "步骤 5: Google Cloud Console 配置检查"
echo ""

echo "访问以下链接查看详细配置:"
echo ""
echo "📍 API 配额和使用情况:"
echo "   https://console.cloud.google.com/apis/api/pagespeedonline.googleapis.com/quotas"
echo ""
echo "📍 API 凭据管理:"
echo "   https://console.cloud.google.com/apis/credentials"
echo ""
echo "📍 获取新的 API Key:"
echo "   https://developers.google.com/speed/docs/insights/v5/get-started"

echo ""

###############################################################################
# 6. 本地服务配置检查
###############################################################################
log_info "步骤 6: 本地服务配置检查"
echo ""

# 检查后端配置
log_info "检查后端 PageSpeedService 配置..."

if [ -f "backend/src/services/PageSpeedService.ts" ]; then
    log_success "PageSpeedService.ts 存在"

    # 检查重试机制
    if grep -q "MAX_RETRIES = 3" backend/src/services/PageSpeedService.ts; then
        log_success "重试机制: 3 次"
    fi

    # 检查超时设置
    if grep -q "timeout: 120000" backend/src/services/PageSpeedService.ts; then
        log_success "超时设置: 120 秒"
    fi

    # 检查错误处理
    if grep -q "status === 429" backend/src/services/PageSpeedService.ts; then
        log_success "包含 429 配额错误处理"
    fi

    if grep -q "status === 403" backend/src/services/PageSpeedService.ts; then
        log_success "包含 403 认证错误处理"
    fi
else
    log_error "未找到 PageSpeedService.ts"
fi

echo ""

###############################################################################
# 完成
###############################################################################
echo "=========================================="
echo -e "${GREEN}✅ 检查完成!${NC}"
echo "=========================================="
echo ""

echo "总结:"
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ PageSpeed API 可用"
    echo "  ✅ API Key 有效"
    echo "  ✅ 配额未用完"
    echo ""
    echo "建议: 可以正常使用 PageSpeed Insights 功能"
elif [ "$HTTP_CODE" = "429" ]; then
    echo "  ⚠️  PageSpeed API 配额已用完"
    echo "  ✓ API Key 有效"
    echo ""
    echo "建议: 等待配额重置或申请更高配额"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "  ❌ API Key 认证失败"
    echo ""
    echo "建议: 检查 API Key 配置或重新生成"
else
    echo "  ❌ API 调用失败"
    echo ""
    echo "建议: 检查网络连接和 API 配置"
fi

echo ""
