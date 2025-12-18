#!/bin/bash

###############################################################################
# 生产环境部署脚本
# 用途: 确保生产环境代码与本地开发环境一致
# 用法: ./scripts/deploy-production.sh
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 步骤计数
STEP=0
step() {
    STEP=$((STEP + 1))
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Step $STEP: $1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

###############################################################################
# 1. 检查前置条件
###############################################################################
step "检查前置条件"

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    log_error "请在项目根目录执行此脚本"
    exit 1
fi

# 检查 git 状态
log_info "检查 git 状态..."
if [ -n "$(git status --porcelain)" ]; then
    log_warning "工作区有未提交的修改，继续部署可能导致不一致"
    git status --short
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "部署已取消"
        exit 1
    fi
fi

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
log_info "当前分支: $CURRENT_BRANCH"

# 记录当前 commit
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_COMMIT_SHORT=$(git rev-parse --short HEAD)
CURRENT_COMMIT_MSG=$(git log -1 --pretty=%B)

log_info "当前 commit: $CURRENT_COMMIT_SHORT"
log_info "提交信息: $CURRENT_COMMIT_MSG"

###############################################################################
# 2. 拉取最新代码
###############################################################################
step "拉取最新代码"

log_info "从远程仓库拉取最新代码..."
git fetch origin

# 检查是否有更新
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH)

if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    log_warning "本地代码与远程不一致"
    log_info "本地: $LOCAL_COMMIT"
    log_info "远程: $REMOTE_COMMIT"

    read -p "是否拉取远程代码? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git pull origin $CURRENT_BRANCH
        log_success "代码已更新"
    else
        log_warning "使用本地代码继续部署"
    fi
else
    log_success "本地代码已是最新"
fi

# 显示最终的 commit 信息
FINAL_COMMIT=$(git rev-parse HEAD)
FINAL_COMMIT_SHORT=$(git rev-parse --short HEAD)
FINAL_COMMIT_MSG=$(git log -1 --pretty=%B)

log_info "部署版本: $FINAL_COMMIT_SHORT"
log_info "提交信息: $FINAL_COMMIT_MSG"

###############################################################################
# 3. 清理旧的构建文件
###############################################################################
step "清理旧的构建文件"

log_info "清理后端构建..."
if [ -d "backend/dist" ]; then
    rm -rf backend/dist
    log_success "后端 dist 已清理"
fi

log_info "清理前端构建..."
if [ -d "frontend/dist" ]; then
    rm -rf frontend/dist
    log_success "前端 dist 已清理"
fi

###############################################################################
# 4. 更新依赖
###############################################################################
step "更新依赖"

log_info "更新根目录依赖..."
npm install

log_info "更新后端依赖..."
cd backend
npm install
cd ..

log_info "更新前端依赖..."
cd frontend
npm install
cd ..

log_success "依赖更新完成"

###############################################################################
# 5. 构建项目
###############################################################################
step "构建项目"

log_info "构建后端..."
cd backend
npm run build
cd ..
log_success "后端构建完成"

log_info "构建前端..."
cd frontend
npm run build
cd ..
log_success "前端构建完成"

###############################################################################
# 6. 生成部署信息文件
###############################################################################
step "生成部署信息"

DEPLOY_TIME=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOY_INFO_FILE="deployment-info.json"

cat > $DEPLOY_INFO_FILE <<EOF
{
  "deployTime": "$DEPLOY_TIME",
  "branch": "$CURRENT_BRANCH",
  "commit": "$FINAL_COMMIT",
  "commitShort": "$FINAL_COMMIT_SHORT",
  "commitMessage": "$FINAL_COMMIT_MSG",
  "deployer": "$(whoami)",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF

log_success "部署信息已保存到 $DEPLOY_INFO_FILE"
cat $DEPLOY_INFO_FILE

###############################################################################
# 7. Docker 部署（可选）
###############################################################################
step "Docker 部署"

if [ -f "docker-compose.yml" ]; then
    read -p "是否使用 Docker 部署? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "停止现有容器..."
        docker-compose down

        log_info "清理旧镜像..."
        docker-compose build --no-cache

        log_info "启动服务..."
        docker-compose up -d

        log_success "Docker 服务已启动"

        # 等待服务启动
        log_info "等待服务启动..."
        sleep 5
    fi
else
    log_warning "未找到 docker-compose.yml，跳过 Docker 部署"
fi

###############################################################################
# 8. 健康检查
###############################################################################
step "健康检查"

log_info "等待服务就绪..."
sleep 3

# 检查后端健康
log_info "检查后端服务..."
HEALTH_CHECK_URL="http://localhost:3000/health"

for i in {1..10}; do
    if curl -s $HEALTH_CHECK_URL > /dev/null 2>&1; then
        HEALTH_RESPONSE=$(curl -s $HEALTH_CHECK_URL)
        log_success "后端服务正常"
        echo "响应: $HEALTH_RESPONSE"
        break
    else
        if [ $i -eq 10 ]; then
            log_error "后端服务无法访问"
            exit 1
        fi
        log_info "等待后端服务启动... ($i/10)"
        sleep 2
    fi
done

# 检查前端
log_info "检查前端服务..."
FRONTEND_URL="http://localhost:5173"

if curl -s $FRONTEND_URL > /dev/null 2>&1; then
    log_success "前端服务正常"
else
    log_warning "前端服务可能未运行（如果使用 Docker 则正常）"
fi

###############################################################################
# 9. 版本验证
###############################################################################
step "版本验证"

log_info "生成版本验证脚本..."
cat > verify-deployment.sh <<'EOF'
#!/bin/bash

# 验证生产环境部署版本
echo "=========================================="
echo "部署版本验证"
echo "=========================================="
echo ""

if [ -f "deployment-info.json" ]; then
    echo "部署信息:"
    cat deployment-info.json | jq '.'
else
    echo "⚠️  未找到部署信息文件"
fi

echo ""
echo "当前 Git 信息:"
echo "  分支: $(git branch --show-current)"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "  提交信息: $(git log -1 --pretty=%B | head -1)"

echo ""
echo "后端服务状态:"
curl -s http://localhost:3000/health | jq '.'

echo ""
echo "=========================================="
EOF

chmod +x verify-deployment.sh

log_success "验证脚本已创建: ./verify-deployment.sh"

###############################################################################
# 10. 完成
###############################################################################
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "部署信息:"
echo "  版本: $FINAL_COMMIT_SHORT"
echo "  时间: $DEPLOY_TIME"
echo "  分支: $CURRENT_BRANCH"
echo ""
echo "下一步:"
echo "  1. 运行 ./verify-deployment.sh 验证部署"
echo "  2. 访问 http://localhost:3000/health 检查后端"
echo "  3. 访问 http://localhost:5173 检查前端"
echo "  4. 查看日志: docker-compose logs -f (如使用 Docker)"
echo ""
