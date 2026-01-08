# WebPageTest 移动设备配置修复

## 问题描述

### 发现的问题

测试报告显示设备为 **MOTOGPOWER** (Android),但代码配置的是 **iPhone 14 Pro** (iOS)。

**测试报告**: https://www.webpagetest.org/result/260108_YiDcC0_83/

**实际测试配置**:
- ❌ User Agent: `Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36...`
- ❌ 平台: Android (不是 iOS)
- ❌ 设备: Moto G Power (不是 iPhone 14 Pro)
- ✅ 网络: 4G (9 Mbps, 170ms) - 正确

**预期配置** (代码中设置的):
- ✅ User Agent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...`
- ✅ 平台: iOS
- ✅ 设备: iPhone 14 Pro (390x844, DPR 3)
- ✅ 网络: 4G

## 根本原因分析

### 问题 1: Location 参数覆盖自定义配置

```typescript
// ❌ 错误的方式
params.location = 'Dulles:Chrome.4G';  // 后缀 .4G 会让 WebPageTest 使用默认移动设备
```

当使用 `location: "Dulles:Chrome.4G"` 时:
- WebPageTest 会自动选择一个默认的移动设备 (Moto G Power)
- **所有自定义参数 (width, height, dpr, userAgent) 都会被忽略!**
- 这是 WebPageTest API 的设计行为

### 问题 2: 错误的 User Agent 参数名

```typescript
// ❌ 错误的参数名
params.userAgent = '...';  // WebPageTest API 不识别这个参数

// ✅ 正确的参数名
params.uastring = '...';   // 这才是正确的参数名
```

WebPageTest API 文档中明确说明:
- 自定义 User Agent 的参数名是 **`uastring`**,不是 `userAgent`

## 解决方案

### 代码修改

**文件**: `backend/src/performance/PerformanceAnalysisService.ts` (lines 184-197)

```typescript
// Mobile configuration: Use Chrome mobile emulation (more stable than device-specific)
if (strategy === 'mobile') {
  params.mobile = 1; // Enable mobile emulation

  // ✅ 使用独立的 connectivity 参数
  params.connectivity = '4G';  // 4G network: 9 Mbps down/up, 170ms latency

  // ✅ Chrome mobile emulation parameters (iPhone 14 Pro)
  // Note: Keep location as 'Dulles:Chrome' without .4G suffix
  // The connectivity parameter handles network throttling
  params.width = 390; // iPhone 14 Pro viewport width
  params.height = 844; // iPhone 14 Pro viewport height
  params.dpr = 3; // Device pixel ratio (Retina display)
  params.uastring = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
}
```

### 关键变更

| 参数 | 修改前 | 修改后 | 原因 |
|------|--------|--------|------|
| `location` | `Dulles:Chrome.4G` | `Dulles:Chrome` | 移除后缀,避免覆盖自定义配置 |
| 网络配置 | 通过 location 后缀 | `connectivity: '4G'` | 独立控制网络,不影响设备参数 |
| User Agent | `userAgent: '...'` | `uastring: '...'` | 使用正确的 API 参数名 |

## 技术原理

### WebPageTest API 参数优先级

1. **High Priority**: `location` 中包含设备/网络后缀 (如 `.4G`)
   - 会使用 WebPageTest 的预设配置
   - **忽略所有自定义参数**

2. **Medium Priority**: 独立的 `connectivity` 参数
   - 只影响网络速度配置
   - 不影响设备模拟参数

3. **Low Priority**: 自定义设备参数 (`width`, `height`, `dpr`, `uastring`)
   - 仅在使用纯 location (如 `Dulles:Chrome`) 时生效

### 正确的参数组合

```typescript
// ✅ 方式 1: 使用自定义设备参数 (推荐)
{
  location: 'Dulles:Chrome',           // 不带后缀
  mobile: 1,
  connectivity: '4G',                  // 独立网络配置
  width: 390,
  height: 844,
  dpr: 3,
  uastring: 'Mozilla/5.0 (iPhone...)'
}

// ❌ 方式 2: 使用 location 后缀 (会忽略自定义参数)
{
  location: 'Dulles:Chrome.4G',        // 带后缀
  mobile: 1,
  width: 390,      // ❌ 被忽略
  height: 844,     // ❌ 被忽略
  dpr: 3,          // ❌ 被忽略
  uastring: '...'  // ❌ 被忽略
}
```

## 验证方法

### 1. 提交新测试

```bash
# 在前端选择移动端测试
# 提交测试后获取 WebPageTest ID
```

### 2. 检查测试配置

访问测试结果页面,查看:
- **Settings** 区域应该显示自定义的设备信息
- **User Agent** 应该包含 `iPhone` 和 `iOS 17_0`
- **不应该**显示 `moto g power` 或 `Android`

### 3. 验证 API 响应

```bash
# 获取测试 ID 后
curl -s "https://www.webpagetest.org/jsonResult.php?test=TEST_ID" \
  | jq '.data.runs."1".firstView.requests[0].headers.request' \
  | grep user-agent

# 应该输出: "user-agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0..."
```

## WebPageTest API 参数参考

### 自定义 User Agent

| 参数名 | 是否有效 | 说明 |
|--------|---------|------|
| `uastring` | ✅ | 正确的参数名 |
| `userAgent` | ❌ | WebPageTest API 不识别 |
| `user-agent` | ❌ | WebPageTest API 不识别 |

### 网络配置

| 方式 | 语法 | 优先级 | 是否影响设备参数 |
|------|------|--------|-----------------|
| Location 后缀 | `Dulles:Chrome.4G` | 高 | ✅ 会覆盖 |
| Connectivity 参数 | `connectivity: '4G'` | 中 | ❌ 不影响 |
| 自定义带宽 | `bwDown/bwUp/latency` | 低 | ❌ 不影响 |

### 移动设备模拟

| 方式 | 稳定性 | 可控性 | 推荐度 |
|------|--------|--------|--------|
| Chrome 移动模拟 + 自定义参数 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 推荐 |
| Location 设备后缀 (`Dulles:iPhone12.4G`) | ⭐⭐ | ⭐⭐ | ❌ 不推荐 |
| mobileDevice 参数 (`mobileDevice: 'iPhone12'`) | ⭐⭐ | ⭐⭐⭐ | ⚠️ 谨慎使用 |

## 相关文档

- [WebPageTest API 参考](https://docs.webpagetest.org/api/reference/)
- [移动设备测试配置](https://docs.webpagetest.org/api/reference/#mobile-testing)
- [网络连接类型](https://docs.webpagetest.org/api/reference/#connectivity)
- [自定义 User Agent](https://docs.webpagetest.org/api/reference/#custom-user-agent)

## 总结

### 修复前 (错误配置)
```typescript
{
  location: 'Dulles:Chrome.4G',  // ❌ 覆盖所有自定义参数
  mobile: 1,
  width: 390,
  height: 844,
  dpr: 3,
  userAgent: '...'  // ❌ 错误的参数名
}
// 结果: 使用 Moto G Power (Android) 设备
```

### 修复后 (正确配置)
```typescript
{
  location: 'Dulles:Chrome',     // ✅ 纯位置,不带后缀
  mobile: 1,
  connectivity: '4G',            // ✅ 独立网络配置
  width: 390,
  height: 844,
  dpr: 3,
  uastring: '...'                // ✅ 正确的参数名
}
// 结果: 使用 iPhone 14 Pro (iOS) 设备配置
```

现在移动端测试应该会正确使用 iPhone 14 Pro 的配置,包括正确的屏幕尺寸、DPR 和 iOS User Agent。
