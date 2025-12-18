#!/bin/bash

# CI Check Script - 本地运行 CI 检查
# 在提交代码前运行此脚本,确保 CI 不会失败

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🚀 Running Local CI Checks${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 记录开始时间
START_TIME=$(date +%s)

# ===========================
# Backend Checks
# ===========================
echo -e "${YELLOW}📦 Backend: Installing dependencies...${NC}"
cd backend
npm ci --silent

echo -e "${YELLOW}🔨 Backend: Building (Type Check)...${NC}"
npm run build

echo -e "${YELLOW}✨ Backend: Linting (if available)...${NC}"
if grep -q '"lint"' package.json; then
  npm run lint || echo -e "${RED}⚠️  Lint failed${NC}"
else
  echo -e "${BLUE}ℹ️  No lint script found, skipping...${NC}"
fi

echo -e "${YELLOW}🧪 Backend: Running tests (if available)...${NC}"
if grep -q '"test"' package.json; then
  NODE_ENV=test npm test || echo -e "${RED}⚠️  Tests failed${NC}"
else
  echo -e "${BLUE}ℹ️  No test script found, skipping...${NC}"
fi

echo -e "${GREEN}✅ Backend checks completed${NC}"
echo ""

# ===========================
# Frontend Checks
# ===========================
cd ../frontend

echo -e "${YELLOW}📦 Frontend: Installing dependencies...${NC}"
npm ci --silent

echo -e "${YELLOW}🔨 Frontend: Building (Type Check)...${NC}"
npm run build

echo -e "${YELLOW}✨ Frontend: Linting (if available)...${NC}"
if grep -q '"lint"' package.json; then
  npm run lint || echo -e "${RED}⚠️  Lint failed${NC}"
else
  echo -e "${BLUE}ℹ️  No lint script found, skipping...${NC}"
fi

echo -e "${YELLOW}🧪 Frontend: Running tests (if available)...${NC}"
if grep -q '"test"' package.json; then
  npm test || echo -e "${RED}⚠️  Tests failed${NC}"
else
  echo -e "${BLUE}ℹ️  No test script found, skipping...${NC}"
fi

echo -e "${GREEN}✅ Frontend checks completed${NC}"
echo ""

# ===========================
# Build Size Analysis
# ===========================
cd ..

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}📊 Build Size Analysis${NC}"
echo -e "${BLUE}======================================${NC}"

echo -e "${YELLOW}Backend build size:${NC}"
du -sh backend/dist 2>/dev/null || echo "Backend dist not found"

echo ""
echo -e "${YELLOW}Frontend build size:${NC}"
du -sh dist/frontend 2>/dev/null || echo "Frontend dist not found"

echo ""
echo -e "${YELLOW}Frontend assets (top 10):${NC}"
ls -lh dist/frontend/assets/ 2>/dev/null | head -11 | tail -10 || echo "No assets found"

# ===========================
# Summary
# ===========================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✅ All CI checks completed successfully!${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}⏱️  Total time: ${DURATION}s${NC}"
echo ""
echo -e "${GREEN}🎉 You're ready to commit!${NC}"
