import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface RedirectRule {
  from: string;
  to: string;
  matchType: 'exact' | 'partial' | 'prefix' | 'regex';
  partialMatch?: {
    startChar?: string;
    endChar?: string;
    pattern?: string;
  };
  description?: string;
}

export interface RedirectTestResult {
  from: string;
  expectedTo: string;
  actualTo: string | null;
  statusCode: number | null;
  redirectChain: Array<{
    url: string;
    statusCode: number;
    location: string | null;
  }>;
  passed: boolean;
  reason: string;
  timestamp: string;
  responseTime: number;
}

export interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
  };
  results: RedirectTestResult[];
}

export interface Example {
  name: string;
  description: string;
  rules: RedirectRule[];
}

class RedirectTesterService {
  /**
   * 测试单个重定向规则
   */
  async testSingle(rule: RedirectRule): Promise<RedirectTestResult> {
    const response = await axios.post(`${API_BASE_URL}/redirect-tester/test`, rule);
    return response.data.data;
  }

  /**
   * 批量测试重定向规则
   */
  async testBatch(rules: RedirectRule[], concurrency = 5): Promise<TestReport> {
    const response = await axios.post(`${API_BASE_URL}/redirect-tester/test-batch`, {
      rules,
      concurrency
    });
    return response.data.data;
  }

  /**
   * 验证规则配置
   */
  async validateRules(rules: RedirectRule[]): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/redirect-tester/validate`, {
        rules
      });
      return { valid: response.data.success };
    } catch (error: any) {
      return {
        valid: false,
        errors: error.response?.data?.errors || [error.message]
      };
    }
  }

  /**
   * 获取示例配置
   */
  async getExamples(): Promise<Example[]> {
    const response = await axios.get(`${API_BASE_URL}/redirect-tester/examples`);
    return response.data.data;
  }

  /**
   * 导出JSON报告
   */
  exportJson(report: TestReport, filename = 'redirect-test-report.json') {
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 导出HTML报告
   */
  exportHtml(report: TestReport, filename = 'redirect-test-report.html') {
    const html = this.generateHtmlReport(report);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 生成HTML报告
   */
  private generateHtmlReport(report: TestReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>重定向测试报告</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .stat { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
    .result { margin: 15px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #ccc; }
    .result.pass { background: #e8f5e9; border-left-color: #4CAF50; }
    .result.fail { background: #ffebee; border-left-color: #f44336; }
    .result-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .result-url { font-weight: bold; word-break: break-all; }
    .result-status { padding: 3px 8px; border-radius: 3px; font-size: 12px; color: white; }
    .status-pass { background: #4CAF50; }
    .status-fail { background: #f44336; }
    .result-details { font-size: 14px; color: #666; }
    .result-details div { margin: 5px 0; }
    .redirect-chain { margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔄 重定向测试报告</h1>

    <div class="summary">
      <div class="stat">
        <div class="stat-value">${report.summary.total}</div>
        <div class="stat-label">总测试数</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #4CAF50">${report.summary.passed}</div>
        <div class="stat-label">通过</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #f44336">${report.summary.failed}</div>
        <div class="stat-label">失败</div>
      </div>
      <div class="stat">
        <div class="stat-value">${report.summary.passRate}</div>
        <div class="stat-label">通过率</div>
      </div>
    </div>

    <h2>测试详情</h2>
    ${report.results.map((result, index) => `
      <div class="result ${result.passed ? 'pass' : 'fail'}">
        <div class="result-header">
          <div class="result-url">${index + 1}. ${result.from}</div>
          <div class="result-status ${result.passed ? 'status-pass' : 'status-fail'}">
            ${result.passed ? '✓ 通过' : '✗ 失败'}
          </div>
        </div>
        <div class="result-details">
          <div><strong>期望:</strong> ${result.expectedTo}</div>
          <div><strong>实际:</strong> ${result.actualTo || 'N/A'}</div>
          <div><strong>状态码:</strong> ${result.statusCode || 'N/A'} | <strong>响应时间:</strong> ${result.responseTime}ms</div>
          ${!result.passed ? `<div style="color: #f44336"><strong>失败原因:</strong> ${result.reason}</div>` : ''}
          ${result.redirectChain.length > 1 ? `
            <div class="redirect-chain">
              <strong>重定向链 (${result.redirectChain.length}次):</strong>
              <ol style="margin: 5px 0; padding-left: 20px;">
                ${result.redirectChain.map(step => `<li>${step.statusCode} → ${step.location || '(final)'}</li>`).join('')}
              </ol>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;
  }
}

export default new RedirectTesterService();
