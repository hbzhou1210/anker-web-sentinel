/**
 * FeishuService - 飞书文档获取服务
 *
 * 注意: 这个服务需要通过MCP (Model Context Protocol) 工具来调用飞书API
 * 由于后端无法直接调用MCP工具,这些方法应该在前端调用,或者通过特殊的MCP代理服务
 *
 * 当前实现为占位符,需要根据实际的MCP集成方案进行调整
 */

import { TestPointPriority } from '../models/entities.js';

export interface FeishuDocumentContent {
  documentId: string;
  title: string;
  content: string;
  url: string;
  metadata?: {
    creator?: string;
    createTime?: string;
    updateTime?: string;
    [key: string]: any;
  };
}

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

export class FeishuService {
  /**
   * 从飞书文档URL中提取文档ID
   * 支持的URL格式:
   * - https://example.feishu.cn/docx/xxxxx
   * - https://example.feishu.cn/docs/xxxxx
   * - https://example.feishu.cn/wiki/xxxxx
   */
  static extractDocumentId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      // 通常文档ID是路径的最后一部分
      if (pathParts.length >= 2) {
        return pathParts[pathParts.length - 1];
      }

      return null;
    } catch (error) {
      console.error('Failed to extract document ID from URL:', error);
      return null;
    }
  }

  /**
   * 验证飞书文档URL格式
   */
  static isValidFeishuUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('feishu') || urlObj.hostname.includes('larksuite');
    } catch {
      return false;
    }
  }

  /**
   * 获取飞书文档内容
   * 使用 MCP 工具 mcp__feishu__docx_v1_document_rawContent
   */
  static async fetchDocument(documentId: string): Promise<FeishuDocumentContent> {
    try {
      // 注意: 这个方法依赖 MCP 工具,只能在 Claude Code 环境中通过特殊方式调用
      // 在实际的 Node.js 后端环境中,我们无法直接调用 MCP 工具
      // 正确的做法是:
      // 1. 前端通过 Claude Code 调用 MCP 工具获取文档内容
      // 2. 将内容发送到后端 API
      // 3. 后端处理内容并提取测试点

      throw new Error(
        'Direct MCP tool call is not available in backend Node.js environment. ' +
        'Please fetch document content from frontend using Claude Code MCP tools, ' +
        'then send the content to backend API endpoint.'
      );
    } catch (error) {
      console.error('Failed to fetch Feishu document:', error);
      throw error;
    }
  }

  /**
   * 解析飞书文档的原始内容为纯文本
   * 飞书文档可能包含富文本、表格等格式
   */
  static parseDocumentContent(rawContent: any): string {
    if (typeof rawContent === 'string') {
      return rawContent;
    }

    // TODO: 根据实际的飞书API响应格式进行解析
    // 可能需要处理:
    // - 富文本格式
    // - 表格
    // - 列表
    // - 标题层级

    return JSON.stringify(rawContent, null, 2);
  }

  /**
   * 构建飞书文档的完整URL
   */
  static buildDocumentUrl(documentId: string, baseUrl = 'https://feishu.cn'): string {
    return `${baseUrl}/docx/${documentId}`;
  }

  /**
   * 生成测试点的 Markdown 思维导图格式
   */
  static generateMindMapMarkdown(
    testPoints: ExtractedTestPoint[],
    documentTitle?: string
  ): string {
    const title = documentTitle || '测试点文档';
    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    let markdown = `# ${title}\n\n`;
    markdown += `> 生成时间: ${timestamp}\n`;
    markdown += `> 测试点总数: ${testPoints.length}\n\n`;

    // 按照 category 分组
    const grouped = this.groupByCategory(testPoints);

    for (const [category, points] of Object.entries(grouped)) {
      markdown += `## ${category}\n\n`;

      // 按照 feature 再分组
      const featureGrouped = this.groupByFeature(points);

      for (const [feature, featurePoints] of Object.entries(featureGrouped)) {
        markdown += `### ${feature}\n\n`;

        featurePoints.forEach((point, index) => {
          markdown += `#### ${index + 1}. ${point.description}\n\n`;
          markdown += `- **优先级**: ${this.getPriorityText(point.priority)}\n`;

          if (point.testType) {
            markdown += `- **测试类型**: ${point.testType}\n`;
          }

          if (point.preconditions) {
            markdown += `- **前置条件**: ${point.preconditions}\n`;
          }

          if (point.expectedResult) {
            markdown += `- **预期结果**: ${point.expectedResult}\n`;
          }

          if (point.testData) {
            markdown += `- **测试数据**:\n\n`;
            markdown += '```json\n';
            markdown += JSON.stringify(point.testData, null, 2);
            markdown += '\n```\n';
          }

          markdown += '\n';
        });
      }
    }

    return markdown;
  }

  /**
   * 按照 category 分组
   */
  private static groupByCategory(
    testPoints: ExtractedTestPoint[]
  ): Record<string, ExtractedTestPoint[]> {
    const grouped: Record<string, ExtractedTestPoint[]> = {};

    testPoints.forEach(point => {
      const category = point.category || '其他';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(point);
    });

    return grouped;
  }

  /**
   * 按照 feature 分组
   */
  private static groupByFeature(
    testPoints: ExtractedTestPoint[]
  ): Record<string, ExtractedTestPoint[]> {
    const grouped: Record<string, ExtractedTestPoint[]> = {};

    testPoints.forEach(point => {
      const feature = point.feature;
      if (!grouped[feature]) {
        grouped[feature] = [];
      }
      grouped[feature].push(point);
    });

    return grouped;
  }

  /**
   * 获取优先级文本
   */
  private static getPriorityText(priority: TestPointPriority): string {
    const map: Record<string, string> = {
      high: '高 🔴',
      medium: '中 🟡',
      low: '低 🟢',
    };
    return map[priority] || priority;
  }

  /**
   * 将 Markdown 内容保存到飞书文档
   * 返回创建的文档 URL
   *
   * 注意: 这个方法需要在前端通过 Claude Code 调用 MCP 工具
   * 后端无法直接调用 MCP 工具
   */
  static async saveMarkdownToFeishu(
    markdown: string,
    fileName?: string
  ): Promise<string> {
    // 在实际环境中，这需要通过 MCP 工具 mcp__feishu__docx_builtin_import 来实现
    // 由于后端无法直接调用 MCP 工具，这里返回一个占位符
    const timestamp = Date.now();
    const placeholderUrl = `https://feishu.cn/docx/placeholder_${timestamp}`;

    console.log('Markdown document prepared for Feishu:', {
      fileName: fileName || '测试点文档',
      contentLength: markdown.length,
      note: 'Use MCP tool mcp__feishu__docx_builtin_import in Claude Code to save this document',
    });

    return placeholderUrl;
  }

  /**
   * 将测试点转换为多维表格的记录格式
   * 表格列：用例ID / 模块 / 优先级 / 测试类型 / 用例标题 / 操作步骤 / 预期结果 / 实际执行结果
   */
  static convertTestPointsToBitableRecords(testPoints: ExtractedTestPoint[]): any[] {
    return testPoints.map((point, index) => {
      // 生成用例ID: TC + 4位数字编号
      const caseId = `TC${String(index + 1).padStart(4, '0')}`;

      // 处理操作步骤：将前置条件和测试数据合并
      let steps = '';
      if (point.preconditions) {
        steps += `前置条件：${point.preconditions}\n\n`;
      }
      if (point.testData) {
        steps += `测试数据：\n${JSON.stringify(point.testData, null, 2)}`;
      }
      if (!steps) {
        steps = point.description;
      }

      return {
        fields: {
          '用例ID': caseId,
          '模块': point.feature || point.category || '其他',
          '优先级': this.getPriorityText(point.priority),
          '测试类型': point.testType || '功能测试',
          '用例标题': point.description,
          '操作步骤': steps,
          '预期结果': point.expectedResult || '符合预期',
          '实际执行结果': '', // 初始为空，待执行后填写
        },
      };
    });
  }

  /**
   * 生成测试用例的 Markdown 表格格式
   * 适用于飞书文档展示
   */
  static generateTestCaseTableMarkdown(
    testPoints: ExtractedTestPoint[],
    documentTitle?: string
  ): string {
    const title = documentTitle || '测试用例管理表';
    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    let markdown = `# ${title}\n\n`;
    markdown += `> 📋 生成时间: ${timestamp}\n`;
    markdown += `> 📊 测试用例总数: ${testPoints.length}\n\n`;
    markdown += `---\n\n`;

    // 生成表格
    markdown += `## 测试用例列表\n\n`;
    markdown += `| 用例ID | 模块 | 优先级 | 测试类型 | 用例标题 | 操作步骤 | 预期结果 | 实际执行结果 |\n`;
    markdown += `|--------|------|--------|----------|----------|----------|----------|-------------|\n`;

    testPoints.forEach((point, index) => {
      const caseId = `TC${String(index + 1).padStart(4, '0')}`;
      const module = point.feature || point.category || '其他';
      const priority = this.getPriorityText(point.priority);
      const testType = point.testType || '功能测试';
      const title = point.description;

      // 处理操作步骤
      let steps = '';
      if (point.preconditions) {
        steps += `前置条件:${point.preconditions}<br>`;
      }
      if (point.testData) {
        steps += `测试数据:${JSON.stringify(point.testData)}`;
      }
      if (!steps) {
        steps = point.description;
      }

      const expectedResult = point.expectedResult || '符合预期';
      const actualResult = '待测试';

      // 转义表格中的特殊字符
      const escapeTableCell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');

      markdown += `| ${caseId} | ${escapeTableCell(module)} | ${priority} | ${testType} | ${escapeTableCell(title)} | ${escapeTableCell(steps)} | ${escapeTableCell(expectedResult)} | ${actualResult} |\n`;
    });

    markdown += `\n---\n\n`;
    markdown += `## 优先级说明\n\n`;
    markdown += `- 🔴 **高**: 核心功能,必须验证\n`;
    markdown += `- 🟡 **中**: 重要功能,需要验证\n`;
    markdown += `- 🟢 **低**: 辅助功能,建议验证\n`;

    return markdown;
  }

  /**
   * 生成用于创建飞书多维表格的字段定义
   * 包含 8 个字段：用例ID, 模块, 优先级, 测试类型, 用例标题, 操作步骤, 预期结果, 实际执行结果
   */
  static generateBitableFieldDefinitions(): any[] {
    return [
      {
        field_name: '用例ID',
        type: 1, // Text 文本
        ui_type: 'Text',
      },
      {
        field_name: '模块',
        type: 1, // Text 文本
        ui_type: 'Text',
      },
      {
        field_name: '优先级',
        type: 3, // SingleSelect 单选
        ui_type: 'SingleSelect',
        property: {
          options: [
            { name: '高 🔴', color: 0 },
            { name: '中 🟡', color: 1 },
            { name: '低 🟢', color: 2 },
          ],
        },
      },
      {
        field_name: '测试类型',
        type: 3, // SingleSelect 单选
        ui_type: 'SingleSelect',
        property: {
          options: [
            { name: '功能测试', color: 0 },
            { name: '安全测试', color: 1 },
            { name: '性能测试', color: 2 },
            { name: 'UI测试', color: 3 },
            { name: '接口测试', color: 4 },
            { name: '正向测试', color: 5 },
            { name: '反向测试', color: 6 },
            { name: '边界测试', color: 7 },
            { name: '异常测试', color: 8 },
          ],
        },
      },
      {
        field_name: '用例标题',
        type: 1, // Text 文本
        ui_type: 'Text',
      },
      {
        field_name: '操作步骤',
        type: 1, // Text 多行文本
        ui_type: 'Text',
      },
      {
        field_name: '预期结果',
        type: 1, // Text 多行文本
        ui_type: 'Text',
      },
      {
        field_name: '实际执行结果',
        type: 1, // Text 多行文本
        ui_type: 'Text',
      },
    ];
  }
}
