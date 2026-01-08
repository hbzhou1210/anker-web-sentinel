# WebPageTest 设备和连接类型 API 对接指南

## 概述

本文档详细说明 WebPageTest API 中关于测试设备和网络连接类型的配置方法,以及如何在现有系统中实现这些功能。

## 一、API 参数说明

### 1. Location (测试位置)

**格式**: `location:browser.connectivity` 或 `location.connectivity`

**示例**:
- `Dulles:Chrome` - 美国弗吉尼亚州,Chrome 浏览器
- `Dulles:Chrome.4G` - 美国弗吉尼亚州,Chrome 浏览器,4G 网络
- `ec2-us-east-1:Firefox.DSL` - AWS 美东区,Firefox,DSL 连接

**可用位置**:
- 北美: Dulles VA, Salt Lake City, Los Angeles, Toronto
- 欧洲: Ireland, London, Paris, Amsterdam, Frankfurt, Milan
- 亚洲: Mumbai, Singapore, Bangkok, Hong Kong, Shanghai, Beijing, Tokyo, Seoul
- 其他: Sydney, Sao Paulo, Cape Town, Dubai

### 2. Connectivity (网络连接类型)

#### 预设连接配置

| 连接类型 | 下载速度 | 上传速度 | 延迟(RTT) | 丢包率 | 参数值 |
|---------|---------|---------|----------|--------|--------|
| Dial | 49 Kbps | 30 Kbps | 120ms | 0% | `Dial` |
| Edge | 240 Kbps | 200 Kbps | 840ms | 0% | `Edge` |
| 2G | 280 Kbps | 280 Kbps | 800ms | 0% | `2G` |
| 3G Slow | 400 Kbps | 400 Kbps | 400ms | 0% | `3GSlow` |
| 3G | 1.6 Mbps | 768 Kbps | 300ms | 0% | `3G` |
| 3G Fast | 1.6 Mbps | 768 Kbps | 150ms | 0% | `3GFast` |
| **4G** | **9 Mbps** | **9 Mbps** | **170ms** | **0%** | `4G` |
| LTE | 12 Mbps | 12 Mbps | 70ms | 0% | `LTE` |
| DSL | 1.5 Mbps | 384 Kbps | 50ms | 0% | `DSL` |
| Cable | 5 Mbps | 1 Mbps | 28ms | 0% | `Cable` (默认) |
| FIOS | 20 Mbps | 5 Mbps | 4ms | 0% | `FIOS` |
| Native | 无限制 | 无限制 | 实际延迟 | 0% | `Native` |

#### 自定义网络配置

当预设配置不满足需求时,可以自定义网络参数:

```typescript
{
  bwDown: 5000,      // 下载带宽 (Kbps), 5000 = 5 Mbps
  bwUp: 1000,        // 上传带宽 (Kbps), 1000 = 1 Mbps
  latency: 50,       // 首跳延迟 (ms)
  plr: 0.5,          // 丢包率 (%), 0.5 = 0.5%
}
```

### 3. Mobile (移动设备配置)

#### 方式一: 使用预设设备模拟器 (不推荐)

```typescript
{
  mobile: 1,
  mobileDevice: 'iPhone12',  // 或 'Pixel5', 'GalaxyS9' 等
}
```

**问题**: 公共实例上的设备模拟器不稳定,经常失败

#### 方式二: Chrome 移动模拟 (推荐) ✅

```typescript
{
  mobile: 1,                  // 启用移动模拟
  width: 390,                 // 视口宽度 (iPhone 14 Pro)
  height: 844,                // 视口高度
  dpr: 3,                     // 设备像素比 (Retina 屏幕)
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...',
  location: 'Dulles:Chrome.4G'  // Chrome + 4G 网络
}
```

**优势**:
- ✅ 更稳定可靠
- ✅ 支持所有测试位置
- ✅ 可精确控制视口和网络
- ✅ 不依赖特定设备模拟器

### 4. 常用移动设备配置参考

| 设备 | 宽度 | 高度 | DPR | User Agent |
|------|------|------|-----|------------|
| iPhone 14 Pro | 390 | 844 | 3 | iOS 17 Safari |
| iPhone SE | 375 | 667 | 2 | iOS 17 Safari |
| Samsung Galaxy S21 | 360 | 800 | 3 | Android Chrome |
| iPad Pro 12.9" | 1024 | 1366 | 2 | iPadOS Safari |
| Pixel 7 | 412 | 915 | 2.625 | Android Chrome |

## 二、当前系统实现

### 文件位置
`/Users/anker/anita-project/backend/src/performance/PerformanceAnalysisService.ts`

### 当前配置 (lines 164-192)

```typescript
private async submitTest(url: string, strategy: 'mobile' | 'desktop' = 'desktop'): Promise<string> {
  const location = 'Dulles:Chrome';

  const params: any = {
    url,
    f: 'json',
    location,
    runs: 1,
    fvonly: 1,
    video: 1,
    lighthouse: 0,
    priority: 5,
  };

  if (strategy === 'mobile') {
    params.mobile = 1;
    params.width = 390;      // iPhone 14 Pro
    params.height = 844;
    params.dpr = 3;
    params.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    params.location = 'Dulles:Chrome.4G';  // 4G 网络
  }

  // 发送请求到 WebPageTest API...
}
```

**特点**:
- ✅ 桌面端: Chrome 浏览器 + Cable 连接 (默认)
- ✅ 移动端: Chrome 移动模拟 + 4G 网络 + iPhone 14 Pro 配置
- ✅ 稳定可靠,已验证可用

## 三、扩展功能建议

### 1. 支持多种网络类型选择

在前端增加网络类型选择器,允许用户选择不同的网络条件:

```typescript
interface TestOptions {
  strategy: 'mobile' | 'desktop';
  connectivity: '2G' | '3G' | '4G' | 'LTE' | 'Cable' | 'DSL' | 'FIOS';
}
```

**实现方式**:

```typescript
private async submitTest(
  url: string,
  strategy: 'mobile' | 'desktop' = 'desktop',
  connectivity: string = '4G'  // 新增参数
): Promise<string> {
  let location = 'Dulles:Chrome';

  // 根据网络类型调整 location
  if (connectivity !== 'Cable') {  // Cable 是默认值
    location = `Dulles:Chrome.${connectivity}`;
  }

  const params: any = {
    url,
    f: 'json',
    location,
    runs: 1,
    fvonly: 1,
    video: 1,
    lighthouse: 0,
    priority: 5,
  };

  if (strategy === 'mobile') {
    params.mobile = 1;
    params.width = 390;
    params.height = 844;
    params.dpr = 3;
    params.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  }

  // ... 发送请求
}
```

### 2. 支持多设备选择

增加不同移动设备的预设配置:

```typescript
const DEVICE_PRESETS = {
  'iphone-14-pro': {
    width: 390,
    height: 844,
    dpr: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  'iphone-se': {
    width: 375,
    height: 667,
    dpr: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  'galaxy-s21': {
    width: 360,
    height: 800,
    dpr: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  'pixel-7': {
    width: 412,
    height: 915,
    dpr: 2.625,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
};
```

### 3. 支持自定义网络配置

对于高级用户,提供自定义网络参数:

```typescript
interface CustomConnectivity {
  type: 'custom';
  bwDown: number;   // Kbps
  bwUp: number;     // Kbps
  latency: number;  // ms
  plr: number;      // %
}

// 使用示例
const customNetwork: CustomConnectivity = {
  type: 'custom',
  bwDown: 5000,   // 5 Mbps
  bwUp: 1000,     // 1 Mbps
  latency: 100,   // 100ms
  plr: 0.5,       // 0.5% 丢包
};
```

### 4. 支持多地域测试

允许用户选择不同的测试位置:

```typescript
const TEST_LOCATIONS = {
  'na': {
    'dulles': 'Dulles, VA',
    'los-angeles': 'Los Angeles, CA',
    'toronto': 'Toronto, Canada',
  },
  'eu': {
    'ireland': 'Ireland',
    'london': 'London, UK',
    'paris': 'Paris, France',
    'frankfurt': 'Frankfurt, Germany',
  },
  'asia': {
    'singapore': 'Singapore',
    'hong-kong': 'Hong Kong',
    'tokyo': 'Tokyo, Japan',
    'shanghai': 'Shanghai, China',
  },
};
```

## 四、API 请求示例

### 示例 1: 桌面端 + Cable 连接 (默认)

```bash
curl "https://www.webpagetest.org/runtest.php?url=https://example.com&location=Dulles:Chrome&f=json&runs=1&fvonly=1&video=1" \
  -H "X-WPT-API-KEY: your_api_key"
```

### 示例 2: 移动端 + 4G 网络 (当前实现)

```bash
curl "https://www.webpagetest.org/runtest.php" \
  -H "X-WPT-API-KEY: your_api_key" \
  -d "url=https://example.com" \
  -d "location=Dulles:Chrome.4G" \
  -d "mobile=1" \
  -d "width=390" \
  -d "height=844" \
  -d "dpr=3" \
  -d "userAgent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" \
  -d "f=json" \
  -d "runs=1" \
  -d "fvonly=1" \
  -d "video=1"
```

### 示例 3: 桌面端 + 3G 慢速网络

```bash
curl "https://www.webpagetest.org/runtest.php?url=https://example.com&location=Dulles:Chrome.3GSlow&f=json&runs=1&fvonly=1&video=1" \
  -H "X-WPT-API-KEY: your_api_key"
```

### 示例 4: 自定义网络配置

```bash
curl "https://www.webpagetest.org/runtest.php" \
  -H "X-WPT-API-KEY: your_api_key" \
  -d "url=https://example.com" \
  -d "location=Dulles:Chrome" \
  -d "bwDown=5000" \
  -d "bwUp=1000" \
  -d "latency=100" \
  -d "plr=0.5" \
  -d "f=json" \
  -d "runs=1" \
  -d "fvonly=1" \
  -d "video=1"
```

## 五、实现优先级建议

### 第一阶段 (当前已完成) ✅
- ✅ 基础桌面端测试 (Chrome + Cable)
- ✅ 基础移动端测试 (Chrome 移动模拟 + 4G)

### 第二阶段 (建议优先实现)
1. **网络类型选择**: 支持 2G/3G/4G/LTE 切换
   - 用户痛点: 需要测试不同网络条件下的性能
   - 实现难度: 低 (只需修改 location 参数)
   - 影响范围: 仅后端 API

2. **常用设备预设**: iPhone SE, Galaxy S21, Pixel 7
   - 用户痛点: 不同设备屏幕尺寸差异大
   - 实现难度: 低 (配置映射表)
   - 影响范围: 后端 + 前端 UI

### 第三阶段 (可选功能)
3. **多地域测试**: 亚洲、欧洲、北美
   - 用户痛点: 全球化应用需要测试不同地区性能
   - 实现难度: 中 (需要处理不同地区的配额)
   - 影响范围: 后端 + 前端 UI

4. **自定义网络配置**: 高级用户自定义带宽和延迟
   - 用户痛点: 特殊场景需求
   - 实现难度: 中 (需要参数验证)
   - 影响范围: 后端 + 前端 UI

## 六、注意事项

### 1. API 配额限制
- 免费账户: 200 次/天
- 建议: 在前端显示剩余配额,避免超限

### 2. 测试时间
- 不同网络类型测试时间差异大:
  - Cable/4G: 30-60 秒
  - 3G: 60-120 秒
  - 2G: 120-180 秒
- 建议: 在 UI 上显示预计等待时间

### 3. 设备模拟器稳定性
- ❌ 避免使用: `Dulles:iPhone12.4G` 等预设设备位置
- ✅ 推荐使用: Chrome 移动模拟 + 手动配置

### 4. User Agent 更新
- 定期更新 User Agent 字符串以匹配最新系统版本
- 建议: 使用配置文件管理,便于更新

## 七、相关资源

- [WebPageTest API 官方文档](https://docs.webpagetest.org/api/reference/)
- [测试位置列表 API](https://www.webpagetest.org/getLocations.php?f=json)
- [网络配置说明](https://docs.webpagetest.org/api/reference/#connectivity)
- [移动设备模拟](https://docs.webpagetest.org/api/reference/#mobile-testing)

## 八、总结

### 当前实现状态
✅ 支持桌面端和移动端基础测试
✅ 移动端使用稳定的 Chrome 模拟方案
✅ 默认使用 4G 网络配置

### 扩展方向
📋 增加网络类型选择 (2G/3G/4G/LTE)
📋 支持多种设备预设
📋 支持多地域测试
📋 高级自定义网络配置

系统已经具备了稳定的基础功能,可以根据实际需求逐步扩展更多配置选项。
