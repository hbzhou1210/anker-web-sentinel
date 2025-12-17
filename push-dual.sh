#!/bin/bash

# 双远程推送脚本
# 策略: GitHub 推送到 master, Coding 推送到开发分支
# 用法: ./push-dual.sh [commit-message] [coding-branch]
# 示例: ./push-dual.sh "feat: add new feature" dev

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

COMMIT_MSG="${1:-}"

# 读取配置文件
if [[ -f .push-config ]]; then
  source .push-config
  CODING_BRANCH="${2:-$CODING_BRANCH}"  # 命令行参数优先级更高
else
  CODING_BRANCH="${2:-dev}"  # 默认推送到 dev 分支(开发分支)
  GITHUB_REMOTE="github"
  GITHUB_BRANCH="master"
  CODING_REMOTE="coding"
fi

echo -e "${BLUE}=== 双远程推送脚本 ===${NC}"
echo -e "${YELLOW}推送策略:${NC}"
echo -e "  GitHub → ${GITHUB_BRANCH}"
echo -e "  Coding → ${CODING_BRANCH}"
echo ""

# 检查是否有未提交的修改
if [[ -n $(git status -s) ]]; then
  if [[ -z "$COMMIT_MSG" ]]; then
    echo -e "${RED}错误: 有未提交的修改,但未提供 commit message${NC}"
    echo "用法: ./push-dual.sh \"your commit message\" [coding-branch]"
    exit 1
  fi

  echo -e "${YELLOW}检测到未提交的修改,开始提交...${NC}"
  git add -A
  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}✓ 提交成功${NC}"
  echo ""
fi

# 推送到 GitHub (使用配置的分支)
echo -e "${BLUE}推送到 GitHub ${GITHUB_BRANCH}...${NC}"
if git push ${GITHUB_REMOTE} ${GITHUB_BRANCH}; then
  echo -e "${GREEN}✓ GitHub ${GITHUB_BRANCH} 推送成功${NC}"
else
  echo -e "${RED}✗ GitHub ${GITHUB_BRANCH} 推送失败${NC}"
  exit 1
fi
echo ""

# 推送到 Coding (指定分支)
echo -e "${BLUE}推送到 Coding ${CODING_BRANCH}...${NC}"

# 检查 Coding 远程分支是否存在
if git ls-remote --heads ${CODING_REMOTE} | grep -q "refs/heads/${CODING_BRANCH}"; then
  # 分支存在,直接推送
  if git push ${CODING_REMOTE} ${GITHUB_BRANCH}:${CODING_BRANCH}; then
    echo -e "${GREEN}✓ Coding ${CODING_BRANCH} 推送成功${NC}"
  else
    echo -e "${RED}✗ Coding ${CODING_BRANCH} 推送失败${NC}"
    exit 1
  fi
else
  # 分支不存在,创建新分支并推送
  echo -e "${YELLOW}Coding ${CODING_BRANCH} 分支不存在,创建新分支...${NC}"
  if git push ${CODING_REMOTE} ${GITHUB_BRANCH}:${CODING_BRANCH}; then
    echo -e "${GREEN}✓ Coding ${CODING_BRANCH} 创建并推送成功${NC}"
  else
    echo -e "${RED}✗ Coding ${CODING_BRANCH} 创建失败${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}=== 推送完成 ===${NC}"
echo -e "GitHub:  ${GITHUB_BRANCH}"
echo -e "Coding:  ${CODING_BRANCH}"
