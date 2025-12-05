# WebPageTest 集成说明

本项目使用 [WebPageTest](https://www.webpagetest.org/) 进行网页性能测试。

## 为什么使用 WebPageTest?

WebPageTest 是业界标准的网页性能测试工具,提供:

- **真实浏览器环境**: 使用真实的 Chrome、Firefox 等浏览器
- **全球测试节点**: 从世界各地的服务器测试网站性能
- **详细的性能指标**: 包括加载时间、TTFB、首次渲染等
- **免费 API**: 提供免费的 API 访问

相比 Lighthouse 的优势:
- 更真实的网络环境(不依赖本地网络)
- 更准确的性能数据(使用真实数据中心)
- 更详细的资源加载分析

## 获取 API 密钥

1. 访问 [WebPageTest API Key 申请页面](https://www.webpagetest.org/getkey.php)
2. 填写邮箱地址
3. 查收邮件,获取免费 API 密钥
4. 将 API 密钥添加到 `.env` 文件:

```bash
WEBPAGETEST_API_KEY=your_api_key_here
```

## API 限制

免费 API 密钥的限制:
- **每天 200 次测试**
- 每次测试需要 30-120 秒完成
- 使用 Dulles, VA 测试节点(默认)

对于生产环境,建议:
- 申请付费账户(无限测试)
- 或部署私有 WebPageTest 实例

## 性能指标

系统提取以下 4 个关键性能指标:

### 1. Load Time (页面加载时间)
- **定义**: 页面完全加载所需的时间
- **阈值**: 3000ms (3秒)
- **来源**: WebPageTest `loadTime` 字段

### 2. Resource Size (资源大小)
- **定义**: 页面下载的总字节数
- **阈值**: 2MB (2097152 字节)
- **来源**: WebPageTest `bytesIn` 字段
- **额外信息**: 包含前5个最大资源的详细信息

### 3. Response Time (服务器响应时间)
- **定义**: 首字节时间 (Time to First Byte, TTFB)
- **阈值**: 500ms
- **来源**: WebPageTest `TTFB` 字段

### 4. Render Time (首次渲染时间)
- **定义**: 首次内容渲染时间
- **阈值**: 2000ms (2秒)
- **来源**: WebPageTest `render` 字段

## 测试流程

1. **提交测试请求** (`submitTest`)
   - 向 WebPageTest API 发送测试 URL
   - 配置参数: Chrome 浏览器、单次运行、首次访问
   - 返回测试 ID

2. **轮询测试结果** (`pollForResults`)
   - 每 5 秒检查一次测试状态
   - 最长等待 5 分钟
   - 测试完成后返回完整结果

3. **提取性能指标** (`extractMetrics`)
   - 从 WebPageTest 结果中提取 4 个关键指标
   - 计算每个指标的状态 (Pass/Warning/Fail)
   - 提取最大资源信息

## 测试配置

默认配置 (在 `PerformanceAnalysisService.ts` 中):

```typescript
{
  location: 'Dulles:Chrome',  // 测试节点: 美国弗吉尼亚州
  runs: 1,                     // 运行次数: 1次
  fvonly: 1,                   // 仅首次访问
  video: 0,                    // 不录制视频
  lighthouse: 0                // 不运行 Lighthouse
}
```

## 故障排查

### 1. API 密钥未设置
**错误**: `WEBPAGETEST_API_KEY not set in environment`

**解决方案**:
```bash
# 在 backend/.env 文件中添加
WEBPAGETEST_API_KEY=your_actual_key_here
```

### 2. 测试超时
**错误**: `WebPageTest timeout: Test did not complete within 5 minutes`

**可能原因**:
- 目标网站加载非常慢
- WebPageTest 服务器繁忙
- 网络连接问题

**解决方案**:
- 等待几分钟后重试
- 检查目标 URL 是否可访问

### 3. API 配额用完
**错误**: `Failed to submit WebPageTest: Request failed with status code 403`

**解决方案**:
- 等待第二天(每日配额会重置)
- 或升级到付费账户

## 本地测试

如果没有 API 密钥,可以:

1. **使用 Web 界面手动测试**:
   - 访问 https://www.webpagetest.org/
   - 输入 URL 并运行测试
   - 查看结果

2. **部署私有实例** (高级):
   - 使用 Docker 部署 WebPageTest 私有实例
   - 修改 `WPT_API_URL` 指向本地实例
   - 无需 API 密钥

## 相关资源

- [WebPageTest 官方文档](https://docs.webpagetest.org/)
- [API 文档](https://docs.webpagetest.org/api/)
- [性能指标解释](https://docs.webpagetest.org/metrics/)
- [私有实例部署指南](https://docs.webpagetest.org/private-instances/)
