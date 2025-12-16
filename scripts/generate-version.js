#!/usr/bin/env node
/**
 * 生成版本信息文件
 * 在 Docker 构建时自动执行,从 Git 获取版本信息
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getGitInfo() {
  try {
    const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { gitCommit, gitBranch };
  } catch (error) {
    console.warn('⚠️  Cannot get Git info (not a git repository or git not installed)');
    return { gitCommit: 'unknown', gitBranch: 'unknown' };
  }
}

function generateVersionInfo() {
  const { gitCommit, gitBranch } = getGitInfo();
  const buildDate = new Date().toISOString();
  const version = '1.0.0';

  const versionInfo = {
    git_commit: gitCommit,
    git_branch: gitBranch,
    build_date: buildDate,
    version: version,
  };

  console.log('📦 生成版本信息:');
  console.log(`  - Git Commit: ${gitCommit}`);
  console.log(`  - Git Branch: ${gitBranch}`);
  console.log(`  - Build Date: ${buildDate}`);
  console.log(`  - Version: ${version}`);

  return versionInfo;
}

// 生成后端版本文件
const backendVersionPath = path.join(process.cwd(), 'backend', 'version.json');
const backendDir = path.dirname(backendVersionPath);
if (!fs.existsSync(backendDir)) {
  fs.mkdirSync(backendDir, { recursive: true });
}
fs.writeFileSync(backendVersionPath, JSON.stringify(generateVersionInfo(), null, 2));
console.log(`✓ 后端版本文件: ${backendVersionPath}`);

// 生成前端版本文件(构建后会复制到 dist)
const frontendVersionPath = path.join(process.cwd(), 'frontend', 'public', 'version.json');
const frontendDir = path.dirname(frontendVersionPath);
if (!fs.existsSync(frontendDir)) {
  fs.mkdirSync(frontendDir, { recursive: true });
}
fs.writeFileSync(frontendVersionPath, JSON.stringify(generateVersionInfo(), null, 2));
console.log(`✓ 前端版本文件: ${frontendVersionPath}`);

console.log('✅ 版本信息生成完成');
