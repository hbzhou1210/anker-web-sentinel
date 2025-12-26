#!/bin/bash

# 快速测试增强版多语言检查

echo "🚀 快速测试增强版多语言检查"
echo "================================"
echo ""

# 检查服务
echo "1️⃣ 检查服务状态..."
if curl -s http://localhost:3000/health > /dev/null; then
  echo "   ✅ 后端服务正常"
else
  echo "   ❌ 后端服务未启动"
  exit 1
fi

echo ""
echo "2️⃣ 执行增强检查..."
echo "   URL: https://www.anker.com"
echo "   语言: en-US"
echo ""

RESULT=$(curl -s -X POST http://localhost:3000/api/v1/enhanced-multilingual/check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.anker.com","language":"en-US"}')

SUCCESS=$(echo $RESULT | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ 检查成功!"
  echo ""
  echo "📊 统计信息:"
  echo "   总错误数: $(echo $RESULT | jq -r '.data.totalErrors')"
  echo "   去重后: $(echo $RESULT | jq -r '.data.uniqueErrors')"
  echo "   严重错误: $(echo $RESULT | jq -r '.data.criticalCount')"
  echo "   警告: $(echo $RESULT | jq -r '.data.warningCount')"
  echo ""
  echo "📝 检查结果:"
  echo "$(echo $RESULT | jq -r '.data.textOutput')"
  echo ""
  echo "================================"
  echo "✅ 测试完成!"
else
  echo "❌ 检查失败: $(echo $RESULT | jq -r '.message')"
  exit 1
fi
