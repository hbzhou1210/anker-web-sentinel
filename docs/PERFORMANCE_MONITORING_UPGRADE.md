# Web 自动化巡检工具 - 性能监控系统升级文档

## 📋 升级概述

本次升级将传统性能监控升级为符合 **2024 Google Core Web Vitals 标准**的现代化性能监控系统。

### 核心改进

1. **从技术指标转向用户体验指标**: 优先关注 LCP/FID/CLS (影响搜索排名和用户留存)
2. **场景化阈值配置**: 根据设备类型、网络环境、业务类型自动调整阈值
3. **真实浏览器采集**: 基于 Playwright + Google 官方 web-vitals 库,采集真实用户体验数据
4. **分阶段达标策略**: 支持从"达标"→"优化"→"卓越"的渐进式优化路径

---

## 🎯 新增核心指标 (Core Web Vitals)

| 指标 | 英文全称 | 用户感知 | Google标准 | 优先级 |
|------|---------|---------|------------|--------|
| **LCP** | Largest Contentful Paint | 主要内容加载完成时间 | ≤2.5s 优秀 / ≤4s 良好 | 🔥 最高 |
| **FID** | First Input Delay | 首次交互响应速度 | ≤100ms 优秀 / ≤300ms 良好 | 🔥 最高 |
| **CLS** | Cumulative Layout Shift | 页面元素意外移动程度 | ≤0.1 优秀 / ≤0.25 良好 | 🔥 最高 |
| **FCP** | First Contentful Paint | 首次内容出现时间 | ≤1.8s 优秀 / ≤3s 良好 | ⚡ 高 |
| **TTI** | Time to Interactive | 页面完全可交互时间 | ≤3.8s 优秀 / ≤7s 良好 | ⚡ 高 |
| **TBT** | Total Blocking Time | 主线程阻塞总时长 | ≤200ms 优秀 / ≤600ms 良好 | ⚡ 高 |

### 为什么优先 Core Web Vitals?

- **影响搜索排名**: Google 从 2021 年起将 LCP/FID/CLS 作为搜索排名因素
- **直接关联转化**: 研究表明 LCP>4s 时,用户流失率超 50%
- **行业通用标准**: 被全球主流网站作为性能监控基准

---

## 🔧 场景化阈值配置

### 1. 预设场景 (开箱即用)

#### 场景 1: 桌面端电商 (Wi-Fi/5G)
**特点**: 网络稳定、性能强、转化优先

```typescript
LCP: ≤2.5s 优秀 / ≤3.5s 良好
FID: ≤100ms 优秀 / ≤200ms 良好
CLS: ≤0.1 优秀 / ≤0.15 良好 (更严格)
```

**适用**: 电商首页、商品详情页 (桌面端)

---

#### 场景 2: 移动端电商 (4G网络) 👈 **最通用场景**
**特点**: 网络波动、性能一般、转化优先

```typescript
LCP: ≤3s 优秀 / ≤4.5s 良好
FID: ≤150ms 优秀 / ≤300ms 良好
CLS: ≤0.1 优秀 / ≤0.2 良好
FCP: ≤2s 优秀 / ≤3.5s 良好
```

**适用**: 大部分移动端电商场景

---

#### 场景 3: 移动端电商 (3G/弱网)
**特点**: 网络慢、下沉市场、可用性优先

```typescript
LCP: ≤4s 优秀 / ≤6s 良好 (大幅放宽)
FID: ≤200ms 优秀 / ≤400ms 良好
CLS: ≤0.15 优秀 / ≤0.25 良好
```

**适用**: 面向三四线城市、农村地区的电商

---

#### 场景 4: 移动端资讯 (4G网络)
**特点**: 快速呈现文本、容忍图片延迟

```typescript
FCP: ≤1.5s 优秀 / ≤2.5s 良好 (优先文本显示)
LCP: ≤3s 优秀 / ≤4.5s 良好
CLS: ≤0.1 优秀 / ≤0.2 良好
```

**适用**: 新闻资讯、博客、内容平台

---

#### 场景 5: 桌面端企业应用 (Wi-Fi)
**特点**: 功能完整、用户容忍度高

```typescript
LCP: ≤4s 优秀 / ≤6s 良好 (放宽)
TTI: ≤3s 优秀 / ≤5s 良好 (交互优先)
CLS: ≤0.1 优秀 / ≤0.25 良好
```

**适用**: 企业后台系统、管理平台

---

### 2. 自动场景匹配

系统会根据测试条件自动选择最合适的阈值:

```typescript
import { getThresholdsForScenario, DeviceType, NetworkType, BusinessType } from './coreWebVitalsThresholds';

// 示例: 移动端 + 4G + 电商
const thresholds = getThresholdsForScenario(
  DeviceType.Mobile,
  NetworkType.Mobile_4G,
  BusinessType.Ecommerce
);

console.log(thresholds.thresholds[0]);
// { metric: 'LCP', excellent: 3000, good: 4500, unit: 'ms' }
```

---

## 🚀 Core Web Vitals 采集器使用指南

### 基本使用

```typescript
import { CoreWebVitalsCollector } from './CoreWebVitalsCollector';
import browserPool from './BrowserPool';

async function testPagePerformance() {
  const browser = await browserPool.acquire();
  const page = await browser.newPage();

  // 访问页面
  await page.goto('https://www.example.com');

  // 快速采集 (不等待FID)
  const vitals = await CoreWebVitalsCollector.collectQuick(page);

  console.log({
    LCP: vitals.lcp?.value,  // 最大内容绘制时间(ms)
    FID: vitals.fid?.value,  // 首次输入延迟(ms) - 可能为空
    CLS: vitals.cls?.value,  // 累积布局偏移(分数)
    FCP: vitals.fcp?.value,  // 首次内容绘制(ms)
    TTI: vitals.tti,          // 可交互时间(ms)
    TBT: vitals.tbt,          // 总阻塞时间(ms)
  });

  await browserPool.release(browser);
}
```

### 完整采集 (包括FID)

```typescript
// 完整采集 (会触发一次点击来获取FID)
const vitals = await CoreWebVitalsCollector.collectComplete(page);

console.log(vitals.fid?.value); // 现在会有FID数据
```

### 评估性能等级

```typescript
import { evaluateMetric, getMetricThreshold, MOBILE_4G_ECOMMERCE } from './coreWebVitalsThresholds';

// 获取 LCP 阈值
const lcpThreshold = getMetricThreshold(WebVitalMetric.LCP, MOBILE_4G_ECOMMERCE);

// 评估实际性能
const level = evaluateMetric(vitals.lcp!.value, lcpThreshold);

console.log(level);
// 'excellent' (≤3000ms)
// 'good' (3000-4500ms)
// 'needs_improvement' (>4500ms)
```

---

## 📊 与旧系统对比

| 维度 | 旧系统 (WebPageTest) | 新系统 (Core Web Vitals) |
|------|---------------------|-------------------------|
| **核心指标** | LoadTime / TTFB / Render / ResourceSize | **LCP / FID / CLS / FCP / TTI** |
| **标准依据** | 自定义阈值 (如3s) | **Google官方标准** (LCP≤2.5s) |
| **场景适配** | 统一阈值 | **5+场景** (移动/桌面/弱网/电商/企业) |
| **采集方式** | 外部API (WebPageTest) | **真实浏览器** (Playwright) |
| **采集速度** | 慢 (5分钟轮询) | **快** (5秒内完成) |
| **用户感知** | 技术指标为主 | **用户体验为主** (LCP=白屏结束) |
| **SEO影响** | 无直接影响 | **影响搜索排名** (Core Web Vitals) |

---

## 🔄 迁移指南

### Step 1: 更新数据库模型 (如需持久化)

```typescript
// backend/src/models/entities.ts
export enum PerformanceMetric {
  // 旧指标 (保留兼容)
  LoadTime = 'loadTime',
  ResourceSize = 'resourceSize',
  ResponseTime = 'responseTime',
  RenderTime = 'renderTime',

  // 新增 Core Web Vitals
  LCP = 'LCP',
  FID = 'FID',
  CLS = 'CLS',
  FCP = 'FCP',
  TTI = 'TTI',
  TBT = 'TBT',
}
```

### Step 2: 在巡检任务中集成

```typescript
// backend/src/services/PatrolService.ts
import coreWebVitalsCollector from './performance/CoreWebVitalsCollector';
import { getThresholdsForScenario, DeviceType, NetworkType, BusinessType } from './performance/coreWebVitalsThresholds';

async function testUrl(page: Page, url: string) {
  await page.goto(url);

  // 采集 Core Web Vitals
  const vitals = await coreWebVitalsCollector.collectQuick(page);

  // 获取适用阈值 (移动端4G电商)
  const scenario = getThresholdsForScenario(
    DeviceType.Mobile,
    NetworkType.Mobile_4G,
    BusinessType.Ecommerce
  );

  // 评估各指标
  const lcpThreshold = getMetricThreshold(WebVitalMetric.LCP, scenario);
  const lcpLevel = evaluateMetric(vitals.lcp!.value, lcpThreshold);

  // 记录结果
  console.log(`LCP: ${vitals.lcp!.value}ms - ${lcpLevel}`);

  // 返回测试结果
  return {
    url,
    status: lcpLevel === 'needs_improvement' ? 'fail' : 'pass',
    vitals,
  };
}
```

### Step 3: 前端展示升级 (可选)

```typescript
// frontend/src/components/PerformanceMetrics.tsx
interface WebVitalsDisplay {
  lcp: number;
  fid?: number;
  cls: number;
  rating: 'excellent' | 'good' | 'needs_improvement';
}

function PerformanceMetrics({ vitals }: { vitals: WebVitalsDisplay }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* LCP */}
      <div className={`p-4 rounded ${getRatingColor(vitals.lcp, 2500, 4000)}`}>
        <div className="text-2xl font-bold">{vitals.lcp}ms</div>
        <div className="text-sm">LCP (最大内容绘制)</div>
        <div className="text-xs text-gray-500">优秀: ≤2.5s</div>
      </div>

      {/* FID */}
      {vitals.fid && (
        <div className={`p-4 rounded ${getRatingColor(vitals.fid, 100, 300)}`}>
          <div className="text-2xl font-bold">{vitals.fid}ms</div>
          <div className="text-sm">FID (首次输入延迟)</div>
          <div className="text-xs text-gray-500">优秀: ≤100ms</div>
        </div>
      )}

      {/* CLS */}
      <div className={`p-4 rounded ${getRatingColor(vitals.cls * 1000, 100, 250)}`}>
        <div className="text-2xl font-bold">{vitals.cls.toFixed(3)}</div>
        <div className="text-sm">CLS (布局偏移)</div>
        <div className="text-xs text-gray-500">优秀: ≤0.1</div>
      </div>
    </div>
  );
}

function getRatingColor(value: number, excellent: number, good: number): string {
  if (value <= excellent) return 'bg-green-100 border-green-500';
  if (value <= good) return 'bg-yellow-100 border-yellow-500';
  return 'bg-red-100 border-red-500';
}
```

---

## 📖 最佳实践

### 1. 阈值选择建议

- **新项目**: 从"移动端4G电商"标准开始 (最通用)
- **性能敏感业务**: 使用"桌面端电商"严格标准
- **下沉市场**: 使用"移动端3G弱网"宽松标准
- **企业内部系统**: 使用"桌面端企业应用"标准

### 2. 分阶段达标策略

**第一阶段 (1-2周): 达标**
- 目标: LCP≤5s, CLS≤0.25 (先修复明显问题)
- 行动: 压缩图片、移除阻塞JS、修复布局抖动

**第二阶段 (3-4周): 优化**
- 目标: LCP≤4s, FID≤200ms (达到"良好"标准)
- 行动: 首屏懒加载、骨架屏、资源预加载

**第三阶段 (2-3月): 卓越**
- 目标: 符合Core Web Vitals"优秀"标准
- 行动: SSR服务端渲染、CDN加速、代码分割

### 3. 监控告警配置

```typescript
// 示例: 当移动端LCP>4.5s的用户占比超20%时告警
const alertRule = {
  metric: 'LCP',
  device: 'mobile',
  threshold: 4500, // ms
  percentile: 0.75, // P75分位值
  alert: {
    condition: 'greater_than',
    email: ['ops@company.com'],
    message: '移动端LCP性能告警: 超过75%用户的LCP>4.5s',
  },
};
```

---

## 🔗 参考资料

- [Google Core Web Vitals 官方文档](https://web.dev/vitals/)
- [web-vitals JavaScript 库](https://github.com/GoogleChrome/web-vitals)
- [Lighthouse 性能评分标准](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [WebPageTest 文档](https://docs.webpagetest.org/)

---

## 📝 更新日志

### v2.0.0 - 2024-12-05

#### ✨ 新增功能
- 🎯 Core Web Vitals 核心指标支持 (LCP/FID/CLS/FCP/TTI/TBT)
- 🌍 场景化阈值配置系统 (5+ 预设场景)
- 🚀 基于 Playwright 的真实浏览器性能采集
- 📊 自动场景匹配和性能评级

#### 🔧 改进
- 从"技术指标"升级为"用户体验指标"
- 采集速度提升 (5分钟 → 5秒)
- 支持移动端/弱网/不同业务类型的差异化阈值

#### 🏗️ 架构优化
- 新增 `CoreWebVitalsCollector` 采集器
- 新增 `coreWebVitalsThresholds` 阈值配置系统
- 保留旧系统兼容性 (WebPageTest)

---

## 🙋 常见问题

### Q1: 旧的 WebPageTest 还能用吗?
**A:** 可以。新系统与旧系统并存,旧的 `PerformanceAnalysisService` 仍然可用。建议新项目使用 Core Web Vitals。

### Q2: FID 为什么经常采集不到?
**A:** FID 需要用户交互才能触发。使用 `collectComplete()` 方法会自动触发一次点击来获取 FID。对于自动化巡检,FID 不是必需指标,可以关注 TBT 作为替代。

### Q3: 如何自定义阈值?
**A:** 修改 `coreWebVitalsThresholds.ts` 文件,添加新的 `ScenarioThresholds` 配置,或直接调用 `getMetricThreshold()` 传入自定义阈值。

### Q4: 性能监控会影响巡检速度吗?
**A:** Core Web Vitals 采集在 5 秒内完成,比 WebPageTest (5 分钟) 快 60 倍。对巡检速度影响极小。

### Q5: 如何在生产环境监控真实用户数据?
**A:** 推荐集成 Google Analytics 4 (GA4) 的 Core Web Vitals 报告,或使用 Sentry Performance Monitoring。本工具主要用于开发/测试环境的主动巡检。

---

**升级完成!** 🎉

现在你的 Web 自动化巡检工具已经符合 2024 Google Core Web Vitals 标准,可以提供更准确的用户体验评估。
