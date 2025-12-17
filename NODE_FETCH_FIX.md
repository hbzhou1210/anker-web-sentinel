# node-fetch 依赖移除修复

## 问题描述

生产环境报错:
```
Cannot find package 'node-fetch' imported from /app/tools/function-discount-checker/src/mcpClient.js
```

但本地运行正常。

## 根本原因

1. **本地环境**: 使用 Node.js 22,已安装 `node-fetch` 包
2. **生产环境**: Docker 使用 Node.js 20,虽然 Dockerfile 中有 `npm install` 命令,但可能因为依赖安装顺序或缓存问题导致 `node-fetch` 未正确安装

## 解决方案

**使用 Node.js 内置的 `fetch` API**,移除 `node-fetch` 第三方依赖。

- Node.js 18+ 内置了全局 `fetch` API
- Docker 使用 Node 20,完全支持内置 fetch
- 无需额外依赖,更稳定可靠

## 修改内容

### 1. 移除 import 语句

**文件**: `tools/function-discount-checker/src/mcpClient.js`

```diff
- import fetch from 'node-fetch';
-
  /**
   * MCP客户端配置
   * 从环境变量读取，支持灵活配置
+  *
+  * 注意: 使用 Node.js 内置 fetch (Node 18+)，不需要 node-fetch 依赖
   */
```

### 2. 移除 package.json 依赖

**文件**: `tools/function-discount-checker/package.json`

```diff
  "dependencies": {
-   "node-fetch": "^3.3.2",
    "express": "^4.18.2",
    "cors": "^2.8.5"
- }
+ },
+ "engines": {
+   "node": ">=18.0.0"
+ }
```

添加了 `engines` 字段明确要求 Node.js 18+。

## 验证

### 本地测试
```bash
$ cd tools/function-discount-checker
$ rm -rf node_modules package-lock.json
$ npm install
$ node -e "console.log(typeof fetch)"
function

$ node -e "import('./src/mcpClient.js').then(() => console.log('✓ loads successfully'))"
✓ loads successfully
```

### Docker 兼容性
- Node.js 18: ✅ 支持内置 fetch
- Node.js 20: ✅ 支持内置 fetch (生产环境)
- Node.js 22: ✅ 支持内置 fetch (本地环境)

## 优势

1. **简化依赖**: 减少一个第三方依赖
2. **提高稳定性**: 使用标准 API,避免版本兼容问题
3. **更好的性能**: 内置实现通常比第三方包更快
4. **避免安装问题**: 不依赖 npm 包安装,生产环境更可靠

## 相关修改

- ✅ 移除 `import fetch from 'node-fetch'`
- ✅ 更新 package.json 依赖
- ✅ 添加 Node.js 版本要求
- ✅ 本地验证通过

## 部署

修改已完成,等待推送到远程仓库并在 Launch 平台重新构建 Docker 镜像。

## 注意事项

如果项目需要支持 Node.js < 18 版本,可以考虑:
1. 升级 Node.js 到 18+ (推荐)
2. 或者使用条件导入:
   ```javascript
   const fetch = globalThis.fetch || (await import('node-fetch')).default;
   ```

但考虑到 Docker 已使用 Node 20,没有必要支持旧版本。
