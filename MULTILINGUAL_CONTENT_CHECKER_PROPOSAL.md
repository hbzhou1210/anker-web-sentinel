# 多语言文案检查功能 - 技术方案

**创建日期**: 2025-12-25
**需求**: 检查网站页面的多语言文案配置(英文/德语/法语),识别基础文案配置错误

## 📊 业内工具调研总结

### 商业工具对比

| 工具 | 语言支持 | 检查类型 | 优势 | 成本 |
|------|---------|---------|------|------|
| **Lokalise** | 100+ | 语法、一致性、术语 | 完整生态、实时协作 | $$$$ |
| **Phrase** | 50+ | 质量检测、术语管理 | 专业级、CI/CD集成 | $$$$ |
| **Crowdin** | 80+ | AI翻译、质量检测 | 全球化支持 | $$$ |
| **LanguageTool** | 25+ | 语法、拼写、风格 | **开源免费** | 免费/$ |

### 推荐开源方案

#### 1. **LanguageTool** (强烈推荐)
- ⭐ **开源免费**
- 🌍 支持 25+ 语言(包括英/德/法)
- 🔧 提供 REST API 和多语言客户端
- ✅ 可以自部署或使用官方 API

**GitHub**: https://github.com/languagetool-org/languagetool

#### 2. **Vale** (辅助工具)
- ⭐ 开源的文案风格检查工具
- 📝 自定义规则引擎
- 🔄 支持 CI/CD 集成

**GitHub**: https://github.com/errata-ai/vale

## 🎯 检查内容分类

### 1. 基础语言错误
- ✅ **拼写错误**: 检测单词拼写
- ✅ **语法错误**: 时态、语态、单复数
- ✅ **标点符号**: 错误或缺失的标点

### 2. 本地化问题
- ✅ **术语不一致**: 专业术语在不同页面的一致性
- ✅ **翻译缺失**: 页面上的文案是否完整翻译
- ✅ **格式错误**: 日期、货币、单位格式

### 3. 技术问题
- ✅ **占位符错误**: `{name}` 等变量缺失或错误
- ✅ **字符编码**: 特殊字符显示问题
- ✅ **长度限制**: UI 文案长度超限

### 4. 文化敏感性
- ⚠️ **文化禁忌**: 特定语言/地区的敏感词汇
- ⚠️ **语气一致性**: 正式/非正式语气混用

## 🛠️ 技术实现方案

### 方案 1: 集成 LanguageTool API (推荐)

#### 优点
- ✅ 无需自己维护语法规则
- ✅ 支持 25+ 语言开箱即用
- ✅ 社区活跃,持续更新
- ✅ 可以自部署或使用官方服务

#### 实现步骤

**1. 安装 LanguageTool**

```bash
# 方式 1: Docker 部署(推荐)
docker run -d -p 8010:8010 erikvl87/languagetool

# 方式 2: npm 包
npm install languagetool-api
```

**2. API 调用示例**

```typescript
// backend/src/services/LanguageCheckService.ts
import axios from 'axios';

interface LanguageError {
  message: string;
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    category: { id: string; name: string };
  };
  replacements: Array<{ value: string }>;
  type: { typeName: string }; // 'UnknownWord', 'Grammar', etc.
}

export class LanguageCheckService {
  private apiUrl: string;

  constructor() {
    // 使用自部署的 LanguageTool 或官方 API
    this.apiUrl = process.env.LANGUAGETOOL_API_URL || 'http://localhost:8010/v2/check';
  }

  /**
   * 检查文本的语言错误
   */
  async checkText(text: string, language: string): Promise<LanguageError[]> {
    try {
      const response = await axios.post(this.apiUrl, null, {
        params: {
          text: text,
          language: language, // 'en-US', 'de-DE', 'fr-FR'
          enabledOnly: false,
        },
      });

      return response.data.matches || [];
    } catch (error) {
      console.error(`Language check failed for ${language}:`, error);
      throw error;
    }
  }

  /**
   * 格式化检查结果
   */
  formatErrors(errors: LanguageError[]) {
    return errors.map(error => ({
      severity: this.getSeverity(error.type.typeName),
      message: error.message,
      context: error.context.text,
      position: {
        start: error.offset,
        end: error.offset + error.length,
      },
      suggestions: error.replacements.slice(0, 3).map(r => r.value),
      category: error.rule.category.name,
      ruleId: error.rule.id,
    }));
  }

  private getSeverity(typeName: string): 'error' | 'warning' | 'info' {
    const severityMap: Record<string, 'error' | 'warning' | 'info'> = {
      'UnknownWord': 'error',
      'Grammar': 'error',
      'Style': 'warning',
      'Typographical': 'info',
    };
    return severityMap[typeName] || 'warning';
  }
}
```

**3. 集成到页面检查服务**

```typescript
// backend/src/services/MultilingualPatrolService.ts
import { LanguageCheckService } from './LanguageCheckService.js';
import { Page } from 'playwright';

interface MultilingualCheck {
  language: string;
  textContent: string;
  errors: Array<{
    severity: string;
    message: string;
    context: string;
    suggestions: string[];
  }>;
}

export class MultilingualPatrolService {
  private languageCheckService: LanguageCheckService;

  constructor() {
    this.languageCheckService = new LanguageCheckService();
  }

  /**
   * 提取页面文本内容
   */
  async extractPageText(page: Page): Promise<string> {
    // 提取所有可见文本,排除脚本和样式
    return await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // 排除隐藏元素和脚本
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;

            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }

            const tagName = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const texts: string[] = [];
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (text && text.length > 0) {
          texts.push(text);
        }
      }

      return texts.join('\n');
    });
  }

  /**
   * 检查多语言页面
   */
  async checkMultilingualPage(
    page: Page,
    languages: string[]
  ): Promise<MultilingualCheck[]> {
    const results: MultilingualCheck[] = [];

    for (const language of languages) {
      try {
        // 切换语言(假设页面支持语言切换)
        await this.switchLanguage(page, language);

        // 等待内容加载
        await page.waitForTimeout(1000);

        // 提取文本
        const textContent = await this.extractPageText(page);

        // 检查语言错误
        const rawErrors = await this.languageCheckService.checkText(
          textContent,
          this.getLanguageCode(language)
        );

        const errors = this.languageCheckService.formatErrors(rawErrors);

        results.push({
          language,
          textContent,
          errors,
        });

        console.log(`✓ Checked ${language}: Found ${errors.length} issues`);
      } catch (error) {
        console.error(`Failed to check ${language}:`, error);
      }
    }

    return results;
  }

  /**
   * 切换页面语言
   */
  private async switchLanguage(page: Page, language: string): Promise<void> {
    // 这里需要根据实际网站的语言切换方式实现
    // 方式 1: URL 参数
    const url = new URL(page.url());
    url.searchParams.set('lang', language);
    await page.goto(url.toString());

    // 方式 2: 点击语言选择器
    // await page.click(`[data-language="${language}"]`);

    // 方式 3: Cookie
    // await page.context().addCookies([
    //   { name: 'language', value: language, domain: url.hostname, path: '/' }
    // ]);
  }

  /**
   * 将语言名称转换为 LanguageTool 代码
   */
  private getLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      'english': 'en-US',
      'german': 'de-DE',
      'french': 'fr-FR',
      '英文': 'en-US',
      '德语': 'de-DE',
      '法语': 'fr-FR',
    };
    return languageMap[language.toLowerCase()] || 'en-US';
  }
}
```

### 方案 2: 自定义规则检查(补充方案)

适用于特定的业务规则检查:

```typescript
// backend/src/services/CustomContentRules.ts
export class CustomContentRules {
  /**
   * 检查占位符完整性
   */
  checkPlaceholders(text: string): Array<{ issue: string; position: number }> {
    const issues: Array<{ issue: string; position: number }> = [];

    // 检查未闭合的占位符
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      issues.push({
        issue: `不匹配的占位符: ${openBraces} 个 '{' 和 ${closeBraces} 个 '}'`,
        position: 0,
      });
    }

    return issues;
  }

  /**
   * 检查术语一致性
   */
  checkTerminology(
    text: string,
    language: string,
    glossary: Record<string, string[]>
  ): Array<{ term: string; suggestion: string }> {
    const issues: Array<{ term: string; suggestion: string }> = [];

    // 检查是否使用了标准术语
    for (const [standard, alternatives] of Object.entries(glossary)) {
      for (const alt of alternatives) {
        if (text.includes(alt)) {
          issues.push({
            term: alt,
            suggestion: `建议使用标准术语 "${standard}"`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * 检查长度限制
   */
  checkLengthLimits(
    segments: Array<{ key: string; text: string; maxLength: number }>
  ): Array<{ key: string; length: number; maxLength: number }> {
    return segments
      .filter(seg => seg.text.length > seg.maxLength)
      .map(seg => ({
        key: seg.key,
        length: seg.text.length,
        maxLength: seg.maxLength,
      }));
  }
}
```

## 📋 API 设计

### 创建多语言检查任务

```typescript
POST /api/v1/multilingual/check

Request:
{
  "url": "https://example.com/product",
  "languages": ["english", "german", "french"],
  "checkTypes": ["grammar", "spelling", "terminology", "placeholders"],
  "notificationEmail": "user@example.com"
}

Response:
{
  "taskId": "ml-check-12345",
  "status": "pending",
  "estimatedTime": 45000
}
```

### 获取检查结果

```typescript
GET /api/v1/multilingual/check/:taskId

Response:
{
  "taskId": "ml-check-12345",
  "url": "https://example.com/product",
  "status": "completed",
  "results": [
    {
      "language": "english",
      "totalErrors": 5,
      "errors": [
        {
          "severity": "error",
          "message": "Possible spelling mistake found",
          "context": "This is an exmaple text",
          "position": { "start": 11, "end": 17 },
          "suggestions": ["example"],
          "category": "Spelling",
          "ruleId": "MORFOLOGIK_RULE_EN_US"
        }
      ]
    },
    {
      "language": "german",
      "totalErrors": 3,
      "errors": [...]
    }
  ],
  "summary": {
    "totalLanguages": 3,
    "totalErrors": 12,
    "criticalErrors": 5,
    "warnings": 7
  }
}
```

## 🎨 前端展示

### 检查结果页面设计

```typescript
interface MultilingualCheckResult {
  language: string;
  totalErrors: number;
  errors: LanguageError[];
}

// 按语言分组显示
<div className="multilingual-results">
  {results.map(result => (
    <div key={result.language} className="language-section">
      <h3>{result.language}</h3>
      <div className="error-count">
        {result.totalErrors} 个问题
      </div>

      <div className="error-list">
        {result.errors.map((error, idx) => (
          <div key={idx} className={`error-item ${error.severity}`}>
            <div className="error-message">{error.message}</div>
            <div className="error-context">{error.context}</div>
            {error.suggestions.length > 0 && (
              <div className="suggestions">
                建议: {error.suggestions.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ))}
</div>
```

## 💰 成本估算

### 自部署方案(推荐)
- **LanguageTool Docker**: 免费
- **服务器资源**: ~$20-50/月 (视检查量而定)
- **总成本**: $20-50/月

### 使用官方 API
- **LanguageTool Premium API**:
  - 免费: 20 次/天
  - 付费: $59/月 起(无限制)

## 🚀 实施路线图

### Phase 1: MVP (2-3 周)
- ✅ 集成 LanguageTool API
- ✅ 基础语法和拼写检查
- ✅ 支持英语/德语/法语
- ✅ 简单的结果展示

### Phase 2: 增强功能 (2-3 周)
- ✅ 自定义规则引擎
- ✅ 术语一致性检查
- ✅ 占位符验证
- ✅ 长度限制检查

### Phase 3: 优化和集成 (1-2 周)
- ✅ 批量检查支持
- ✅ 定时巡检集成
- ✅ 邮件报告优化
- ✅ 性能优化

## 📊 预期效果

### 可检测的问题类型
1. ✅ **拼写错误**: 95%+ 准确率
2. ✅ **基础语法**: 90%+ 准确率
3. ✅ **术语不一致**: 100% (自定义规则)
4. ✅ **格式问题**: 100% (自定义规则)

### 性能指标
- 单页检查时间: ~5-10 秒
- 支持并发检查: 3-5 个语言
- 内存占用: ~500MB (LanguageTool)

## 🎯 下一步行动

1. **验证可行性**: 部署 LanguageTool Docker 测试
2. **API 集成**: 实现基础的语言检查服务
3. **前端开发**: 创建多语言检查入口
4. **测试验证**: 使用真实页面测试效果
5. **迭代优化**: 根据反馈调整规则

## 📚 参考资源

- LanguageTool 官方文档: https://languagetool.org/http-api/
- LanguageTool Docker: https://github.com/erikvl87/docker-languagetool
- Vale 文档: https://vale.sh/docs/
- i18n 最佳实践: https://www.w3.org/International/

---

**建议**: 先使用 LanguageTool 构建 MVP,验证效果后再考虑更复杂的自定义规则。
