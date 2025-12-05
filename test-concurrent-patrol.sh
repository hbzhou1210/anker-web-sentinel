#!/bin/bash

# 并发巡检测试脚本
# 测试两个巡检任务同时执行是否会失败

echo "======================================"
echo "并发巡检测试"
echo "======================================"
echo ""

# 确保有至少两个巡检任务
echo "📝 获取巡检任务列表..."
TASKS=$(curl -s http://localhost:3000/api/v1/patrol/tasks | jq -r '.[].id')

TASK_COUNT=$(echo "$TASKS" | wc -l | tr -d ' ')

if [ "$TASK_COUNT" -lt 2 ]; then
  echo "❌ 需要至少2个巡检任务,当前只有 $TASK_COUNT 个"
  exit 1
fi

# 获取前两个任务ID
TASK1=$(echo "$TASKS" | sed -n '1p')
TASK2=$(echo "$TASKS" | sed -n '2p')

echo "✅ 找到 $TASK_COUNT 个巡检任务"
echo "   任务1: $TASK1"
echo "   任务2: $TASK2"
echo ""

# 同时启动两个巡检任务
echo "🚀 同时启动两个巡检任务..."

# 使用临时文件存储结果
TEMP1=$(mktemp)
TEMP2=$(mktemp)

# 后台启动两个任务
(curl -s -X POST http://localhost:3000/api/v1/patrol/tasks/$TASK1/execute | jq -r '.executionId' > $TEMP1) &
PID1=$!

(curl -s -X POST http://localhost:3000/api/v1/patrol/tasks/$TASK2/execute | jq -r '.executionId' > $TEMP2) &
PID2=$!

# 等待两个请求完成
wait $PID1
wait $PID2

# 读取结果
EXEC1_ID=$(cat $TEMP1)
EXEC2_ID=$(cat $TEMP2)

# 清理临时文件
rm -f $TEMP1 $TEMP2

echo "✅ 两个巡检任务已启动"
echo "   执行1: $EXEC1_ID"
echo "   执行2: $EXEC2_ID"
echo ""

# 轮询等待两个任务完成
echo "⏳ 等待巡检完成 (最多120秒)..."
MAX_WAIT=120
WAIT_TIME=0

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  sleep 3
  WAIT_TIME=$((WAIT_TIME + 3))

  # 获取所有执行记录
  EXECUTIONS=$(curl -s http://localhost:3000/api/v1/patrol/executions?limit=10)

  # 检查两个任务的状态
  STATUS1=$(echo "$EXECUTIONS" | jq -r ".[] | select(.id == \"$EXEC1_ID\") | .status")
  STATUS2=$(echo "$EXECUTIONS" | jq -r ".[] | select(.id == \"$EXEC2_ID\") | .status")

  echo -ne "\\r⏳ 等待中... ${WAIT_TIME}s / ${MAX_WAIT}s | 任务1: $STATUS1 | 任务2: $STATUS2"

  # 两个任务都完成
  if [ "$STATUS1" != "running" ] && [ "$STATUS1" != "pending" ] && [ "$STATUS2" != "running" ] && [ "$STATUS2" != "pending" ]; then
    break
  fi
done

echo ""
echo ""

# 获取两个任务的最终结果
RESULT1=$(curl -s http://localhost:3000/api/v1/patrol/executions?limit=10 | jq ".[] | select(.id == \"$EXEC1_ID\")")
RESULT2=$(curl -s http://localhost:3000/api/v1/patrol/executions?limit=10 | jq ".[] | select(.id == \"$EXEC2_ID\")")

echo "======================================"
echo "执行结果"
echo "======================================"
echo ""

echo "任务1 ($TASK1):"
echo "  状态: $(echo "$RESULT1" | jq -r '.status')"
echo "  总计URL: $(echo "$RESULT1" | jq -r '.totalUrls')"
echo "  通过: $(echo "$RESULT1" | jq -r '.passedUrls')"
echo "  失败: $(echo "$RESULT1" | jq -r '.failedUrls')"
echo "  耗时: $(echo "$RESULT1" | jq -r '.durationMs')ms"
ERROR1=$(echo "$RESULT1" | jq -r '.errorMessage')
if [ "$ERROR1" != "null" ]; then
  echo "  错误: $ERROR1"
fi

echo ""

echo "任务2 ($TASK2):"
echo "  状态: $(echo "$RESULT2" | jq -r '.status')"
echo "  总计URL: $(echo "$RESULT2" | jq -r '.totalUrls')"
echo "  通过: $(echo "$RESULT2" | jq -r '.passedUrls')"
echo "  失败: $(echo "$RESULT2" | jq -r '.failedUrls')"
echo "  耗时: $(echo "$RESULT2" | jq -r '.durationMs')ms"
ERROR2=$(echo "$RESULT2" | jq -r '.errorMessage')
if [ "$ERROR2" != "null" ]; then
  echo "  错误: $ERROR2"
fi

echo ""
echo "======================================"

# 判断结果
STATUS1_FINAL=$(echo "$RESULT1" | jq -r '.status')
STATUS2_FINAL=$(echo "$RESULT2" | jq -r '.status')

if [ "$STATUS1_FINAL" == "failed" ] && [ "$STATUS2_FINAL" == "failed" ]; then
  echo "❌ 并发测试失败: 两个任务都失败了!"
  exit 1
elif [ "$STATUS1_FINAL" == "failed" ] || [ "$STATUS2_FINAL" == "failed" ]; then
  echo "⚠️  并发测试部分失败: 其中一个任务失败"
  exit 1
else
  echo "✅ 并发测试通过: 两个任务都成功完成!"
  exit 0
fi
