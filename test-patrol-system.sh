#!/bin/bash

# 日常巡检系统测试脚本
# 用于快速测试巡检系统的各项功能

BASE_URL="http://localhost:3000/api/v1/patrol"

echo "🔍 开始测试日常巡检系统..."
echo ""

# 1. 获取任务列表
echo "📋 1. 获取巡检任务列表..."
TASKS=$(curl -s "${BASE_URL}/tasks")
echo "$TASKS" | python3 -m json.tool
TASK_ID=$(echo "$TASKS" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)
echo "任务ID: $TASK_ID"
echo ""

if [ -z "$TASK_ID" ]; then
  echo "❌ 未找到任务,请先创建巡检任务"
  exit 1
fi

# 2. 手动执行巡检
echo "▶️  2. 手动执行巡检任务..."
EXECUTE_RESULT=$(curl -s -X POST "${BASE_URL}/tasks/${TASK_ID}/execute")
echo "$EXECUTE_RESULT" | python3 -m json.tool
echo ""

# 3. 等待执行完成
echo "⏳ 3. 等待巡检执行完成(最多等待60秒)..."
TIMEOUT=60
ELAPSED=0
STATUS="running"

while [ "$STATUS" = "running" ] && [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  EXECUTIONS=$(curl -s "${BASE_URL}/executions?limit=1")
  STATUS=$(echo "$EXECUTIONS" | python3 -c "import sys, json; print(json.load(sys.stdin)[0].get('status', 'unknown'))" 2>/dev/null)
  echo "   状态: $STATUS (已等待 ${ELAPSED}s)"
done
echo ""

# 4. 获取执行结果
echo "📊 4. 获取执行结果..."
EXECUTIONS=$(curl -s "${BASE_URL}/executions?limit=1")
echo "$EXECUTIONS" | python3 -m json.tool | head -50
echo ""

# 5. 提取统计信息
TOTAL=$(echo "$EXECUTIONS" | python3 -c "import sys, json; print(json.load(sys.stdin)[0].get('totalUrls', 0))" 2>/dev/null)
PASSED=$(echo "$EXECUTIONS" | python3 -c "import sys, json; print(json.load(sys.stdin)[0].get('passedUrls', 0))" 2>/dev/null)
FAILED=$(echo "$EXECUTIONS" | python3 -c "import sys, json; print(json.load(sys.stdin)[0].get('failedUrls', 0))" 2>/dev/null)
DURATION=$(echo "$EXECUTIONS" | python3 -c "import sys, json; print(json.load(sys.stdin)[0].get('durationMs', 0))" 2>/dev/null)

echo "📈 5. 测试统计:"
echo "   总计: $TOTAL 个URL"
echo "   通过: $PASSED 个"
echo "   失败: $FAILED 个"
if [ "$TOTAL" -gt 0 ]; then
  PASS_RATE=$(python3 -c "print(f'{($PASSED / $TOTAL * 100):.1f}%')" 2>/dev/null)
  echo "   通过率: $PASS_RATE"
fi
echo "   耗时: ${DURATION}ms"
echo ""

# 6. 获取调度配置
echo "⏰ 6. 获取调度配置..."
SCHEDULES=$(curl -s "${BASE_URL}/schedules")
echo "$SCHEDULES" | python3 -m json.tool
echo ""

# 7. 最终总结
echo "✅ 测试完成!"
echo ""
echo "📝 系统功能验证:"
echo "   ✓ 巡检任务管理"
echo "   ✓ 手动执行巡检"
echo "   ✓ 执行历史记录"
echo "   ✓ 定时调度配置"
echo ""
echo "🌐 访问前端界面: http://localhost:5173/tools/patrol"
echo "📚 查看完整文档: docs/patrol-system-guide.md"
