# 双远程推送指南

本项目配置了双远程仓库推送策略,确保代码同步到 GitHub 和 Coding。

## 推送策略

- **GitHub**: 推送到 `master` 主分支 (生产环境)
- **Coding**: 推送到 `dev` 开发分支 (持续集成/测试)

## 快速使用

### 方式 1: 使用脚本 (推荐)

```bash
# 提交并推送(自动执行双远程推送)
./push-dual.sh "feat: 添加新功能"

# 如果已经提交,只需推送
./push-dual.sh

# 推送到 Coding 的其他分支
./push-dual.sh "fix: 修复bug" staging
```

### 方式 2: 使用 Git 别名

首先设置别名:
```bash
./setup-git-aliases.sh
```

然后使用简短命令:
```bash
git push-dual              # 同时推送到两个远程
git push-github            # 仅推送到 GitHub master
git push-coding-dev        # 仅推送到 Coding dev
```

## 配置说明

推送配置保存在 `.push-config` 文件中:

```bash
# GitHub 远程仓库配置
GITHUB_REMOTE=github
GITHUB_BRANCH=master

# Coding 远程仓库配置
CODING_REMOTE=coding
CODING_BRANCH=dev
```

如需修改默认分支,编辑此文件即可。

## 注意事项

1. **脚本会自动处理**:
   - ✅ 检测未提交的修改
   - ✅ 自动创建 Coding 分支(如果不存在)
   - ✅ 错误时自动停止
   - ✅ 彩色输出,清晰易读

2. **推送顺序**:
   - 先推送到 GitHub master
   - 再推送到 Coding dev
   - 如果 GitHub 推送失败,不会推送到 Coding

3. **手动推送**:
   如果需要手动控制,可以分别执行:
   ```bash
   git push github master
   git push coding master:dev
   ```

## 故障排除

### 问题: GitHub 推送失败

```bash
# 检查远程仓库配置
git remote -v

# 测试连接
ssh -T git@github.com
```

### 问题: Coding 分支冲突

```bash
# 查看远程分支
git ls-remote --heads coding

# 强制推送(谨慎使用)
git push coding master:dev --force
```

### 问题: 权限不足

```bash
# 给脚本添加执行权限
chmod +x push-dual.sh
chmod +x setup-git-aliases.sh
```

## 工作流程示例

```bash
# 1. 修改代码
vim backend/src/services/SomeService.ts

# 2. 测试代码
npm run build
npm test

# 3. 一键提交并推送到两个远程
./push-dual.sh "feat: 实现新功能"

# 完成! GitHub master 和 Coding dev 都已更新
```

## Claude Code 集成

当 Claude Code 帮您推送代码时,它会自动使用这个双远程推送策略:
- ✅ 提交到本地 master 分支
- ✅ 推送到 GitHub master
- ✅ 推送到 Coding dev

这样确保所有代码修改都同步到两个平台。
