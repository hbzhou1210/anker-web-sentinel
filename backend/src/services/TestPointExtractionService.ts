import { TestPoint, TestPointPriority, TestPointStatus } from '../models/entities.js';

export interface ExtractedTestPoint {
  category?: string;
  feature: string;
  description: string;
  priority: TestPointPriority;
  testType?: string;
  preconditions?: string;
  expectedResult?: string;
  testData?: Record<string, any>;
}

export class TestPointExtractionService {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor() {
    // 使用APP_前缀避免与Claude Code全局环境变量冲突
    this.apiKey = process.env.APP_ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('APP_ANTHROPIC_API_KEY is not configured in environment variables');
    }

    this.baseURL = process.env.APP_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    this.model = process.env.APP_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    console.log('API Configuration:', {
      baseURL: this.baseURL,
      model: this.model,
    });
  }

  /**
   * 从需求文档中提取测试点
   */
  async extractTestPoints(
    documentContent: string,
    documentTitle?: string
  ): Promise<ExtractedTestPoint[]> {
    const prompt = this.buildExtractionPrompt(documentContent, documentTitle);

    try {
      // 使用直接的 HTTP 请求而不是 SDK
      const url = `${this.baseURL}/messages`;

      console.log('Sending request to:', url);
      console.log('Using model:', this.model);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;
      console.log('API Response received, content blocks:', data.content?.length);

      // 解析Claude返回的内容
      const content = data.content?.[0] as any;
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return this.parseTestPointsFromResponse(content.text);
    } catch (error) {
      console.error('Failed to extract test points:', error);
      throw new Error(`测试点提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 构建提取测试点的提示词
   */
  private buildExtractionPrompt(documentContent: string, documentTitle?: string): string {
    return `你是一个专业的测试工程师,负责从需求文档中提取测试点。

${documentTitle ? `# 文档标题\n${documentTitle}\n\n` : ''}# 需求文档内容
${documentContent}

# 任务
请仔细分析以上需求文档,提取所有需要测试的功能点。对于每个测试点,请提供以下信息:

1. **category**: 测试分类(如: 功能测试、性能测试、安全测试、UI测试、接口测试等)
2. **feature**: 功能模块名称
3. **description**: 详细的测试点描述
4. **priority**: 优先级(high/medium/low)
5. **testType**: 测试类型(如: 正向测试、反向测试、边界测试、异常测试等)
6. **preconditions**: 前置条件(如果有)
7. **expectedResult**: 预期结果
8. **testData**: 测试数据示例(如果适用,用JSON格式)

# 输出格式
请以JSON数组格式输出所有测试点,每个测试点是一个对象。示例:

\`\`\`json
[
  {
    "category": "功能测试",
    "feature": "用户登录",
    "description": "验证用户使用正确的用户名和密码能够成功登录系统",
    "priority": "high",
    "testType": "正向测试",
    "preconditions": "用户已注册并且账号状态正常",
    "expectedResult": "用户成功登录,跳转到首页,显示用户信息",
    "testData": {
      "username": "test@example.com",
      "password": "Test123456"
    }
  },
  {
    "category": "功能测试",
    "feature": "用户登录",
    "description": "验证用户输入错误密码时无法登录",
    "priority": "high",
    "testType": "反向测试",
    "preconditions": "用户已注册",
    "expectedResult": "显示错误提示信息'密码错误',用户无法登录",
    "testData": {
      "username": "test@example.com",
      "password": "wrongpassword"
    }
  }
]
\`\`\`

# 注意事项
- 请确保测试点全面覆盖文档中的所有功能需求
- 对于重要功能,应该包含正向测试和反向测试
- 优先级判断标准:
  - high: 核心功能、安全相关、数据一致性相关
  - medium: 常用功能、用户体验相关
  - low: 辅助功能、可选功能
- 如果文档中没有明确提到某些信息,可以合理推断,但不要过度臆测

请开始分析并输出测试点:`;
  }

  /**
   * 解析Claude返回的测试点
   */
  private parseTestPointsFromResponse(responseText: string): ExtractedTestPoint[] {
    try {
      // 尝试多种方式提取JSON内容
      let jsonText = responseText.trim();

      // 方法1: 尝试匹配 ```json ... ``` 格式
      const jsonMatch1 = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch1) {
        jsonText = jsonMatch1[1].trim();
        console.log('Extracted JSON using method 1 (```json), length:', jsonText.length);
      } else {
        // 方法2: 尝试匹配 ``` ... ``` 格式 (without json tag)
        const jsonMatch2 = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch2) {
          jsonText = jsonMatch2[1].trim();
          console.log('Extracted JSON using method 2 (```), length:', jsonText.length);
        } else {
          // 方法3: 如果以 ```json 或 ``` 开头,移除这些标记
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.slice(7); // 移除 ```json
            const endIndex = jsonText.lastIndexOf('```');
            if (endIndex !== -1) {
              jsonText = jsonText.slice(0, endIndex);
            }
            jsonText = jsonText.trim();
            console.log('Extracted JSON using method 3 (startsWith), length:', jsonText.length);
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.slice(3); // 移除 ```
            const endIndex = jsonText.lastIndexOf('```');
            if (endIndex !== -1) {
              jsonText = jsonText.slice(0, endIndex);
            }
            jsonText = jsonText.trim();
            console.log('Extracted JSON using method 4 (startsWith ```), length:', jsonText.length);
          } else {
            console.log('No code block found, using raw response, length:', jsonText.length);
          }
        }
      }

      console.log('First 100 chars of jsonText:', jsonText.substring(0, 100));
      const parsed = JSON.parse(jsonText);

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      // 验证和规范化每个测试点
      return parsed.map((point, index) => {
        if (!point.feature || !point.description) {
          throw new Error(`测试点 ${index + 1} 缺少必要字段 (feature 或 description)`);
        }

        return {
          category: point.category || undefined,
          feature: point.feature,
          description: point.description,
          priority: this.normalizePriority(point.priority),
          testType: point.testType || undefined,
          preconditions: point.preconditions || undefined,
          expectedResult: point.expectedResult || undefined,
          testData: point.testData || undefined,
        };
      });
    } catch (error) {
      console.error('Failed to parse test points from response:', responseText);
      throw new Error(
        `无法解析AI返回的测试点数据: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 规范化优先级值
   */
  private normalizePriority(priority: any): TestPointPriority {
    if (!priority) {
      return TestPointPriority.Medium;
    }

    const normalized = String(priority).toLowerCase();
    if (normalized === 'high' || normalized === '高') {
      return TestPointPriority.High;
    }
    if (normalized === 'low' || normalized === '低') {
      return TestPointPriority.Low;
    }
    return TestPointPriority.Medium;
  }

  /**
   * 将提取的测试点转换为完整的TestPoint实体
   */
  static toTestPoint(
    extracted: ExtractedTestPoint,
    feishuDocumentId?: string
  ): Omit<TestPoint, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      feishuDocumentId,
      category: extracted.category,
      feature: extracted.feature,
      description: extracted.description,
      priority: extracted.priority,
      testType: extracted.testType,
      preconditions: extracted.preconditions,
      expectedResult: extracted.expectedResult,
      testData: extracted.testData,
      status: TestPointStatus.Pending,
      metadata: undefined,
    };
  }
}
