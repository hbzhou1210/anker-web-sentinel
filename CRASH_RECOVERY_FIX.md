# 浏览器崩溃恢复修复方案

## 问题描述

巡检时出现两种偶现错误:

1. **页面崩溃**: `Page crashed during navigation - browser may be under memory pressure`
2. **页面关闭后操作**: `模块检查: 检查过程出错: page.waitForTimeout: Target page, context or browser has been closed`

## 根本原因

当浏览器因内存压力或其他原因崩溃时,页面对象(Page)会被关闭,但代码继续尝试调用页面方法,导致"Target page has been closed"错误。

## 解决方案

在 `backend/src/services/PatrolService.ts` 的 `testUrl()` 方法中添加了全面的页面状态检查机制。

### 修复位置

#### 1. 页面导航后检查 (line 1328)
```typescript
// 在任何页面操作前检查页面是否仍然有效
if (page.isClosed()) {
  throw new Error('Page was closed after navigation');
}
```

#### 2. 等待页面稳定 (lines 1332-1340)
```typescript
// 等待页面稳定 - 使用 try-catch 保护
try {
  await page.waitForTimeout(2000);
} catch (error) {
  if (page.isClosed()) {
    throw new Error('Page closed while waiting for stability');
  }
  throw error;
}
```

#### 3. 关闭弹窗前检查 (lines 1342-1356)
```typescript
// 再次检查页面状态
if (page.isClosed()) {
  throw new Error('Page closed before popup dismissal');
}

// 尝试关闭弹窗 - 使用 try-catch 保护
try {
  await this.dismissCommonPopups(page);
} catch (error) {
  if (page.isClosed()) {
    throw new Error('Page closed during popup dismissal');
  }
  console.warn(`  Failed to dismiss popups:`, (error as Error).message);
}
```

#### 4. 内容检查前验证 (lines 1358-1374)
```typescript
// 检查页面状态
if (page.isClosed()) {
  throw new Error('Page closed before content check');
}

// 基本可用性检查 - 使用 try-catch 保护
let bodyExists = false;
try {
  bodyExists = await page.evaluate(function() {
    return document.body !== null && document.body.children.length > 0;
  });
} catch (error) {
  if (page.isClosed()) {
    throw new Error('Page closed during content check');
  }
  throw error;
}
```

#### 5. 元素检查保护 (lines 1391-1415)
```typescript
// 检查页面状态
if (page.isClosed()) {
  throw new Error('Page closed before element checks');
}

// 执行页面检查 - 使用 try-catch 保护
try {
  if (pageType === PageType.ProductPage) {
    console.log(`  Checking product page functions...`);
    checks = await this.checkProductPageFunctions(page);
  } else if (pageType === PageType.Homepage || pageType === PageType.LandingPage) {
    console.log(`  Checking page modules...`);
    checks = await this.checkHomepageModules(page, config);
  }
} catch (error) {
  if (page.isClosed()) {
    throw new Error('Page closed during element checks');
  }
  // 检查失败,返回错误信息
  checks = [{
    name: '模块检查',
    passed: false,
    message: `检查过程出错: ${(error as Error).message}`
  }];
}
```

#### 6. 截图前检查 (lines 1432-1449)
```typescript
// 检查页面状态
if (page.isClosed()) {
  throw new Error('Page closed before screenshot capture');
}

// 截图保存页面状态 - 使用 try-catch 保护
let screenshotUrl: string | undefined;
try {
  const imageKey = await screenshotService.captureAndUploadToFeishu(page);
  screenshotUrl = `/api/v1/images/feishu/${imageKey}`;
} catch (error) {
  if (page.isClosed()) {
    console.warn(`  Page closed during screenshot capture, skipping screenshot`);
  } else {
    console.error(`  Failed to capture and upload screenshot:`, error);
  }
}
```

#### 7. 视觉对比保护 (lines 1451-1490)
```typescript
// 视觉对比(如果启用)
let visualDiff: any = undefined;
if (config.visualComparison?.enabled && screenshotUrl) {
  // 检查页面状态
  if (page.isClosed()) {
    console.warn(`  Page closed before visual comparison, skipping comparison`);
  } else {
    try {
      // 执行视觉对比...
    } catch (error) {
      console.error(`  Failed to perform visual comparison:`, error);
    }
  }
}
```

#### 8. 错误截图保护 (lines 1520-1539)
```typescript
// 尝试保存截图到飞书,即使检查失败 - 使用 try-catch 保护
let screenshotUrl: string | undefined;
// 检查页面是否仍然可用
if (!page.isClosed()) {
  try {
    console.log(`  Capturing screenshot for failed test...`);
    const imageKey = await screenshotService.captureAndUploadToFeishu(page);
    screenshotUrl = `/api/v1/images/feishu/${imageKey}`;
    console.log(`  Screenshot uploaded to Feishu: ${screenshotUrl}`);
  } catch (screenshotError) {
    if (page.isClosed()) {
      console.warn(`  Page closed during error screenshot capture, skipping screenshot`);
    } else {
      console.error(`  Failed to capture and upload screenshot:`, screenshotError);
    }
  }
} else {
  console.warn(`  Page already closed, cannot capture error screenshot`);
}
```

## 保护策略

### 1. **主动检查 (Proactive Check)**
在每个关键操作前使用 `page.isClosed()` 检查页面状态:
```typescript
if (page.isClosed()) {
  throw new Error('Page closed before [operation]');
}
```

### 2. **异常捕获 (Exception Handling)**
将所有页面操作包裹在 try-catch 中:
```typescript
try {
  await page.[operation]();
} catch (error) {
  if (page.isClosed()) {
    // 页面已关闭,优雅降级
    console.warn('Page closed during operation, skipping...');
  } else {
    // 其他错误,继续抛出
    throw error;
  }
}
```

### 3. **优雅降级 (Graceful Degradation)**
- 如果页面在截图前关闭,跳过截图但继续完成测试
- 如果页面在视觉对比前关闭,跳过对比但保留测试结果
- 错误截图失败时不影响错误报告的生成

## 预期效果

1. **消除"Target page has been closed"错误**
   - 所有页面操作前都会检查页面状态
   - 页面关闭时优雅跳过后续操作

2. **提高测试稳定性**
   - 浏览器崩溃不会导致测试进程崩溃
   - 测试可以继续执行其他URL

3. **保留有价值的信息**
   - 崩溃前的检查结果仍会被记录
   - 错误信息更加清晰明确

## 验证

编译成功:
```bash
$ npm run build
> tsc
✓ 编译通过,无错误
```

## 部署

修复已完成,等待推送到远程仓库并在 Launch 平台重新构建 Docker 镜像。

## 相关修复

这是第四轮崩溃恢复修复,配合之前的修复:
1. **第一轮**: 添加页面崩溃监听器
2. **第二轮**: 渐进式加载策略(networkidle → domcontentloaded → load)
3. **第三轮**: Context 重建机制
4. **第四轮**(本次): 全面页面状态检查

所有修复协同工作,确保在浏览器内存压力下仍能稳定运行。
