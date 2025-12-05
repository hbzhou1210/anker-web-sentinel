#!/bin/bash

# Core Web Vitals 巡检测试脚本
# 测试 Core Web Vitals 集成是否正常工作

echo "======================================"
echo "Core Web Vitals 巡检集成测试"
echo "======================================"
echo ""

# 1. 创建测试巡检任务
echo "📝 1. 创建测试巡检任务..."
TASK_ID=$(curl -s -X POST http://localhost:3000/api/v1/patrol/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Core Web Vitals 测试",
    "description": "测试 Core Web Vitals 性能数据采集",
    "urls": [
      {"url": "https://www.baidu.com", "name": "百度首页"},
      {"url": "https://www.jd.com", "name": "京东首页"}
    ],
    "notificationEmails": [],
    "enabled": true
  }' | jq -r '.id')

if [ -z "$TASK_ID" ] || [ "$TASK_ID" == "null" ]; then
  echo "❌ 创建任务失败"
  exit 1
fi

echo "✅ 任务创建成功: $TASK_ID"
echo ""

# 2. 执行巡检
echo "🚀 2. 执行巡检任务..."
EXECUTION_ID=$(curl -s -X POST http://localhost:3000/api/v1/patrol/tasks/$TASK_ID/execute | jq -r '.executionId')

if [ -z "$EXECUTION_ID" ] || [ "$EXECUTION_ID" == "null" ]; then
  echo "❌ 执行任务失败"
  exit 1
fi

echo "✅ 巡检已启动: $EXECUTION_ID"
echo "⏳ 等待巡检完成 (最多120秒)..."
echo ""

# 3. 轮询等待执行完成
MAX_WAIT=120
WAIT_TIME=0
STATUS="running"

while [ "$STATUS" == "running" ] || [ "$STATUS" == "pending" ]; do
  if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo "❌ 巡检超时 (${MAX_WAIT}s)"
    exit 1
  fi

  sleep 3
  WAIT_TIME=$((WAIT_TIME + 3))

  EXECUTION=$(curl -s http://localhost:3000/api/v1/patrol/executions?limit=1)
  STATUS=$(echo "$EXECUTION" | jq -r '.[0].status')

  echo -ne "\r⏳ 等待中... ${WAIT_TIME}s / ${MAX_WAIT}s"
done

echo ""
echo ""
echo "✅ 巡检完成,状态: $STATUS"
echo ""

# 4. 获取详细结果
echo "📊 4. 获取巡检结果..."
RESULT=$(curl -s http://localhost:3000/api/v1/patrol/executions?limit=1 | jq '.[0]')

echo "======================================"
echo "巡检统计"
echo "======================================"
echo "总计URL: $(echo "$RESULT" | jq -r '.totalUrls')"
echo "通过: $(echo "$RESULT" | jq -r '.passedUrls')"
echo "失败: $(echo "$RESULT" | jq -r '.failedUrls')"
echo "耗时: $(echo "$RESULT" | jq -r '.durationMs')ms"
echo ""

# 5. 检查 Core Web Vitals 数据
echo "======================================"
echo "Core Web Vitals 数据检查"
echo "======================================"

TEST_RESULTS=$(echo "$RESULT" | jq -c '.testResults[]')

if [ -z "$TEST_RESULTS" ]; then
  echo "❌ 未找到测试结果"
  exit 1
fi

HAS_CWV_DATA=false

echo "$TEST_RESULTS" | while read -r result; do
  NAME=$(echo "$result" | jq -r '.name')
  URL=$(echo "$result" | jq -r '.url')
  STATUS=$(echo "$result" | jq -r '.status')

  echo ""
  echo "📄 $NAME ($URL)"
  echo "   状态: $STATUS"

  # 检查是否有 Core Web Vitals 数据
  CWV=$(echo "$result" | jq -r '.coreWebVitals')
  PERF_LEVEL=$(echo "$result" | jq -r '.performanceLevel')

  if [ "$CWV" != "null" ]; then
    HAS_CWV_DATA=true
    echo "   ✅ 包含 Core Web Vitals 数据"

    # LCP
    LCP=$(echo "$result" | jq -r '.coreWebVitals.lcp.value')
    LCP_RATING=$(echo "$result" | jq -r '.coreWebVitals.lcp.rating')
    if [ "$LCP" != "null" ]; then
      echo "      LCP: ${LCP}ms (${LCP_RATING})"
    fi

    # FID
    FID=$(echo "$result" | jq -r '.coreWebVitals.fid.value')
    FID_RATING=$(echo "$result" | jq -r '.coreWebVitals.fid.rating')
    if [ "$FID" != "null" ]; then
      echo "      FID: ${FID}ms (${FID_RATING})"
    fi

    # CLS
    CLS=$(echo "$result" | jq -r '.coreWebVitals.cls.value')
    CLS_RATING=$(echo "$result" | jq -r '.coreWebVitals.cls.rating')
    if [ "$CLS" != "null" ]; then
      echo "      CLS: ${CLS} (${CLS_RATING})"
    fi

    # FCP
    FCP=$(echo "$result" | jq -r '.coreWebVitals.fcp.value')
    if [ "$FCP" != "null" ]; then
      echo "      FCP: ${FCP}ms"
    fi

    # TTI
    TTI=$(echo "$result" | jq -r '.coreWebVitals.tti')
    if [ "$TTI" != "null" ]; then
      echo "      TTI: ${TTI}ms"
    fi

    # TBT
    TBT=$(echo "$result" | jq -r '.coreWebVitals.tbt')
    if [ "$TBT" != "null" ]; then
      echo "      TBT: ${TBT}ms"
    fi

    # 性能等级
    if [ "$PERF_LEVEL" != "null" ]; then
      echo "   性能等级: $PERF_LEVEL"
    fi

    # 评估场景
    SCENARIO=$(echo "$result" | jq -r '.performanceScenario')
    if [ "$SCENARIO" != "null" ]; then
      DEVICE=$(echo "$result" | jq -r '.performanceScenario.deviceType')
      NETWORK=$(echo "$result" | jq -r '.performanceScenario.networkType')
      BUSINESS=$(echo "$result" | jq -r '.performanceScenario.businessType')
      echo "   评估场景: $DEVICE / $NETWORK / $BUSINESS"
    fi
  else
    echo "   ⚠️  未包含 Core Web Vitals 数据"
  fi
done

echo ""
echo "======================================"
echo "测试完成"
echo "======================================"

# 6. 清理测试任务
echo ""
echo "🧹 清理测试任务..."
curl -s -X DELETE http://localhost:3000/api/v1/patrol/tasks/$TASK_ID > /dev/null
echo "✅ 已删除测试任务"
echo ""

# 结论
if $HAS_CWV_DATA; then
  echo "✅ Core Web Vitals 集成测试通过!"
  exit 0
else
  echo "❌ Core Web Vitals 数据未采集!"
  exit 1
fi
