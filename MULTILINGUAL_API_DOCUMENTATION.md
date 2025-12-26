# 多语言文案检查 API 接口文档

## 📋 概述

多语言文案检查 API 提供基于 LanguageTool 的多语言内容语法和拼写检查功能。支持 25+ 种语言,可以检测网页或纯文本中的语法错误、拼写错误、标点符号问题等。

**基础 URL**: `http://your-domain:port/api/v1/multilingual`

**当前版本**: v1.0

---

## 🔧 前置条件

### 1. LanguageTool 服务

API 依赖 LanguageTool 服务,需要先启动:

```bash
# Docker 方式启动
docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest

# 或使用 docker-compose
docker-compose up -d languagetool
```

### 2. 环境变量配置

在 `backend/.env` 中配置:

```bash
LANGUAGETOOL_API_URL=http://localhost:8010/v2/check
```

---

## 📡 API 端点

### 1. 获取支持的语言列表

获取所有支持的检查语言及其代码。

#### 请求

```http
GET /api/v1/multilingual/languages
```

#### 响应

```json
{
  "success": true,
  "data": {
    "languages": [
      {
        "code": "en-US",
        "name": "English (US)"
      },
      {
        "code": "de-DE",
        "name": "German (Germany)"
      },
      {
        "code": "fr-FR",
        "name": "French (France)"
      }
      // ... 更多语言
    ],
    "count": 25
  }
}
```

#### 示例

```bash
curl http://localhost:3000/api/v1/multilingual/languages
```

---

### 2. 检查服务健康状态

检查 LanguageTool 服务是否正常运行。

#### 请求

```http
GET /api/v1/multilingual/health
```

#### 响应

**服务正常**:
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "service": "LanguageTool",
    "apiUrl": "http://localhost:8010/v2/check",
    "timestamp": "2025-12-26T01:00:00.000Z"
  }
}
```

**服务异常**:
```json
{
  "success": true,
  "data": {
    "healthy": false,
    "service": "LanguageTool",
    "apiUrl": "http://localhost:8010/v2/check",
    "error": "connect ECONNREFUSED",
    "timestamp": "2025-12-26T01:00:00.000Z"
  }
}
```

#### 示例

```bash
curl http://localhost:3000/api/v1/multilingual/health
```

---

### 3. 检查文本内容

直接检查提供的文本内容。

#### 请求

```http
POST /api/v1/multilingual/check-text
Content-Type: application/json
```

**请求体**:
```json
{
  "text": "This is an exmaple text with som mistakes.",
  "language": "english"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要检查的文本内容 |
| language | string | 是 | 语言名称或代码 (如 "english", "en-US") |

**支持的语言名称**:
- `english` (en-US)
- `german` (de-DE)
- `french` (fr-FR)
- `spanish` (es-ES)
- `italian` (it-IT)
- `portuguese` (pt-PT)
- `dutch` (nl-NL)
- `chinese` (zh-CN)
- `japanese` (ja-JP)
- 等等...

#### 响应

```json
{
  "success": true,
  "data": {
    "language": "en-US",
    "errors": [
      {
        "message": "Possible spelling mistake found.",
        "shortMessage": "Spelling mistake",
        "offset": 11,
        "length": 7,
        "context": {
          "text": "This is an exmaple text with som mistakes.",
          "offset": 11,
          "length": 7
        },
        "replacements": [
          { "value": "example" },
          { "value": "examples" }
        ],
        "rule": {
          "id": "MORFOLOGIK_RULE_EN_US",
          "description": "Possible spelling mistake",
          "category": {
            "id": "TYPOS",
            "name": "Possible Typo"
          }
        },
        "severity": "error"
      },
      {
        "message": "Possible spelling mistake found.",
        "shortMessage": "Spelling mistake",
        "offset": 29,
        "length": 3,
        "context": {
          "text": "This is an exmaple text with som mistakes.",
          "offset": 29,
          "length": 3
        },
        "replacements": [
          { "value": "some" },
          { "value": "so" }
        ],
        "rule": {
          "id": "MORFOLOGIK_RULE_EN_US",
          "description": "Possible spelling mistake",
          "category": {
            "id": "TYPOS",
            "name": "Possible Typo"
          }
        },
        "severity": "error"
      }
    ],
    "errorCount": 2,
    "textLength": 43
  }
}
```

**错误严重性级别**:
- `error`: 严重错误 (拼写错误、语法错误)
- `warning`: 警告 (风格问题、可读性建议)
- `info`: 信息 (提示性建议)

#### 示例

```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is an exmaple text with som mistakes.",
    "language": "english"
  }'
```

```javascript
// JavaScript 示例
const response = await fetch('http://localhost:3000/api/v1/multilingual/check-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'This is an exmaple text with som mistakes.',
    language: 'english'
  })
});

const result = await response.json();
console.log(result.data.errors);
```

```python
# Python 示例
import requests

response = requests.post(
    'http://localhost:3000/api/v1/multilingual/check-text',
    json={
        'text': 'This is an exmaple text with som mistakes.',
        'language': 'english'
    }
)

data = response.json()
print(data['data']['errors'])
```

---

### 4. 检查网页多语言内容

自动访问网页并检查多种语言版本的内容。

#### 请求

```http
POST /api/v1/multilingual/check
Content-Type: application/json
```

**请求体**:
```json
{
  "url": "https://www.example.com",
  "languages": ["english", "german", "french"]
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 要检查的网页 URL |
| languages | string[] | 是 | 要检查的语言列表 |

#### 响应

```json
{
  "success": true,
  "data": {
    "url": "https://www.example.com",
    "timestamp": "2025-12-26T01:00:00.000Z",
    "languages": [
      {
        "language": "en-US",
        "languageName": "English (US)",
        "errors": [
          {
            "message": "Possible spelling mistake found.",
            "shortMessage": "Spelling mistake",
            "offset": 150,
            "length": 8,
            "context": {
              "text": "...surrounding text...",
              "offset": 150,
              "length": 8
            },
            "replacements": [
              { "value": "correct" }
            ],
            "rule": {
              "id": "MORFOLOGIK_RULE_EN_US",
              "description": "Possible spelling mistake",
              "category": {
                "id": "TYPOS",
                "name": "Possible Typo"
              }
            },
            "severity": "error"
          }
        ],
        "errorCount": 1,
        "warningCount": 0,
        "infoCount": 0,
        "textLength": 2450
      },
      {
        "language": "de-DE",
        "languageName": "German (Germany)",
        "errors": [],
        "errorCount": 0,
        "warningCount": 0,
        "infoCount": 0,
        "textLength": 2380
      }
    ],
    "totalErrors": 1,
    "totalWarnings": 0,
    "summary": {
      "languagesChecked": 2,
      "totalIssues": 1,
      "criticalIssues": 1
    }
  }
}
```

#### 工作流程

1. 访问指定 URL
2. 对每种语言:
   - 切换页面语言设置 (通过 URL 参数或其他方式)
   - 提取可见文本内容
   - 调用 LanguageTool 进行检查
   - 应用自定义规则检查
3. 汇总所有结果并返回

#### 示例

```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com",
    "languages": ["english", "german", "french"]
  }'
```

```javascript
// JavaScript 示例
const response = await fetch('http://localhost:3000/api/v1/multilingual/check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://www.example.com',
    languages: ['english', 'german', 'french']
  })
});

const result = await response.json();
console.log(`检查了 ${result.data.summary.languagesChecked} 种语言`);
console.log(`发现 ${result.data.summary.totalIssues} 个问题`);
```

```python
# Python 示例
import requests

response = requests.post(
    'http://localhost:3000/api/v1/multilingual/check',
    json={
        'url': 'https://www.example.com',
        'languages': ['english', 'german', 'french']
    }
)

data = response.json()
print(f"检查了 {data['data']['summary']['languagesChecked']} 种语言")
print(f"发现 {data['data']['summary']['totalIssues']} 个问题")

for lang_result in data['data']['languages']:
    print(f"\n{lang_result['languageName']}:")
    for error in lang_result['errors']:
        print(f"  - {error['message']}")
```

---

## ⚠️ 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |
| 503 | LanguageTool 服务不可用 |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述信息",
  "error": "详细错误信息"
}
```

### 常见错误

**1. LanguageTool 服务未启动**
```json
{
  "success": false,
  "message": "LanguageTool service is not available",
  "error": "connect ECONNREFUSED 127.0.0.1:8010"
}
```

**解决方案**: 启动 LanguageTool 服务

**2. 无效的语言代码**
```json
{
  "success": false,
  "message": "Invalid language code: xyz"
}
```

**解决方案**: 使用支持的语言代码或名称

**3. URL 无法访问**
```json
{
  "success": false,
  "message": "Failed to load URL",
  "error": "net::ERR_NAME_NOT_RESOLVED"
}
```

**解决方案**: 检查 URL 是否正确且可访问

---

## 🔍 使用场景

### 1. 内容质量检查

在发布多语言内容前,自动检查所有语言版本的语法和拼写错误。

```javascript
// 检查产品描述
const checkProductDescription = async (url) => {
  const response = await fetch('http://localhost:3000/api/v1/multilingual/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url,
      languages: ['english', 'german', 'french', 'spanish', 'italian']
    })
  });

  const result = await response.json();

  if (result.data.summary.criticalIssues > 0) {
    console.error(`发现 ${result.data.summary.criticalIssues} 个严重问题,请修复后发布`);
    return false;
  }

  return true;
};
```

### 2. CI/CD 集成

在部署流程中自动检查网页内容质量。

```yaml
# GitHub Actions 示例
name: Content Quality Check

on:
  pull_request:
    branches: [ main ]

jobs:
  check-content:
    runs-on: ubuntu-latest
    steps:
      - name: Start LanguageTool
        run: |
          docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest
          sleep 10

      - name: Check multilingual content
        run: |
          response=$(curl -X POST http://localhost:3000/api/v1/multilingual/check \
            -H "Content-Type: application/json" \
            -d '{"url": "${{ env.PREVIEW_URL }}", "languages": ["english", "german"]}')

          issues=$(echo $response | jq '.data.summary.criticalIssues')

          if [ "$issues" -gt 0 ]; then
            echo "发现 $issues 个严重问题"
            exit 1
          fi
```

### 3. 定期巡检

定期检查已发布页面的内容质量。

```javascript
// 定时任务检查
const cron = require('node-cron');

// 每天凌晨 2 点检查所有产品页面
cron.schedule('0 2 * * *', async () => {
  const urls = [
    'https://www.example.com/product/1',
    'https://www.example.com/product/2',
    // ...更多 URL
  ];

  for (const url of urls) {
    const response = await fetch('http://localhost:3000/api/v1/multilingual/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        languages: ['english', 'german', 'french']
      })
    });

    const result = await response.json();

    if (result.data.summary.totalIssues > 0) {
      // 发送告警通知
      await sendAlert(url, result.data);
    }
  }
});
```

### 4. 批量文本检查

批量检查大量文本内容。

```javascript
// 批量检查文本
const checkMultipleTexts = async (texts, language) => {
  const results = [];

  for (const text of texts) {
    const response = await fetch('http://localhost:3000/api/v1/multilingual/check-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language })
    });

    const result = await response.json();
    results.push({
      text: text.substring(0, 50) + '...',
      errorCount: result.data.errorCount,
      errors: result.data.errors
    });
  }

  return results;
};

// 使用示例
const productDescriptions = [
  'This is the first product description...',
  'Another product description with potentail errors...',
  // ...更多文本
];

const results = await checkMultipleTexts(productDescriptions, 'english');
console.log(`检查了 ${results.length} 个文本,发现 ${results.filter(r => r.errorCount > 0).length} 个有问题`);
```

---

## 📊 性能建议

### 1. 并发控制

避免同时发起过多检查请求,建议:
- 最多同时检查 3-5 个 URL
- 单次检查文本长度不超过 50KB

### 2. 缓存策略

对于不经常变化的内容,可以缓存检查结果:

```javascript
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

const checkWithCache = async (url, languages) => {
  const cacheKey = `${url}-${languages.join(',')}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch('http://localhost:3000/api/v1/multilingual/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, languages })
  });

  const result = await response.json();
  cache.set(cacheKey, { data: result.data, timestamp: Date.now() });

  return result.data;
};
```

### 3. 超时设置

建议设置合理的超时时间:

```javascript
const checkWithTimeout = async (url, languages, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('http://localhost:3000/api/v1/multilingual/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, languages }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('检查超时,请稍后重试');
    }
    throw error;
  }
};
```

---

## 🛠️ 配置选项

### LanguageTool 自定义规则

可以配置 LanguageTool 的检查规则:

```typescript
// backend/src/services/LanguageCheckService.ts

// 禁用特定规则
const disabledRules = 'WHITESPACE_RULE,DOUBLE_PUNCTUATION';

// 启用特定规则
const enabledRules = 'MORFOLOGIK_RULE_EN_US';

// 检查时传递参数
const response = await axios.post(
  this.apiUrl,
  null,
  {
    params: {
      text,
      language: languageCode,
      disabledRules,
      enabledRules,
      enabledOnly: false
    }
  }
);
```

### 自定义检查规则

在 `MultilingualTestService.ts` 中添加自定义规则:

```typescript
private checkCustomRules(text: string, language: string): LanguageToolError[] {
  const errors: LanguageToolError[] = [];

  // 示例: 检查占位符
  const placeholderRegex = /\{\{[^}]+\}\}/g;
  let match;
  while ((match = placeholderRegex.exec(text)) !== null) {
    errors.push({
      message: 'Found placeholder that should be replaced',
      // ...其他字段
    });
  }

  return errors;
}
```

---

## 📞 技术支持

如有问题或建议,请联系:
- **项目仓库**: [GitHub](https://github.com/hbzhou1210/anker-web-sentinel) / [Coding](http://e.coding.anker-in.com/codingcorp/dtc_it/anker-web-sentinel)
- **文档**: 参见项目根目录的 `MULTILINGUAL_CHECKER_INTEGRATION.md`

---

## 📝 更新日志

### v1.0 (2025-12-26)
- ✅ 初始版本发布
- ✅ 支持 25+ 种语言检查
- ✅ 网页和文本检查功能
- ✅ 自定义规则支持
- ✅ 完整的前端界面集成
