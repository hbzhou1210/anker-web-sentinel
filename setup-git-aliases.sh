#!/bin/bash

# 设置 Git 别名,方便双远程推送

echo "设置 Git 别名..."

# 推送到 GitHub master
git config alias.push-github '!git push github master'

# 推送到 Coding dev (可自定义分支)
git config alias.push-coding-dev '!git push coding master:dev'

# 推送到 Coding master
git config alias.push-coding-master '!git push coding master'

# 一键推送到两个远程 (GitHub master + Coding dev)
git config alias.push-dual '!git push github master && git push coding master:dev'

# 一键推送到两个远程的 master 分支
git config alias.push-all-master '!git push github master && git push coding master'

echo "✓ Git 别名设置完成!"
echo ""
echo "可用的命令:"
echo "  git push-github          # 推送到 GitHub master"
echo "  git push-coding-dev      # 推送到 Coding dev"
echo "  git push-coding-master   # 推送到 Coding master"
echo "  git push-dual            # 同时推送到 GitHub master 和 Coding dev"
echo "  git push-all-master      # 同时推送到两个 master"
