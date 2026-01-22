import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { BitablePatrolTaskRepository } from '../models/repositories/BitablePatrolTaskRepository.js';
import { BitablePatrolExecutionRepository } from '../models/repositories/BitablePatrolExecutionRepository.js';
import { PatrolExecution, PatrolTask } from '../models/entities.js';

export class PatrolEmailService {
  private transporter: Transporter | null = null;
  private isEnabled: boolean;
  private taskRepository: BitablePatrolTaskRepository;
  private executionRepository: BitablePatrolExecutionRepository;

  constructor() {
    // Use Bitable for patrol task and execution repositories
    this.taskRepository = new BitablePatrolTaskRepository();
    this.executionRepository = new BitablePatrolExecutionRepository();
    console.log('[PatrolEmailService] Using Bitable storage');

    // 检查邮件服务是否配置
    this.isEnabled = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    );

    if (this.isEnabled) {
      this.initializeTransporter();
    } else {
      console.warn('⚠️  邮件服务未配置。请设置 SMTP 环境变量以启用。');
    }
  }

  /**
   * 初始化 SMTP transporter
   */
  private initializeTransporter(): void {
    try {
      const port = parseInt(process.env.SMTP_PORT!, 10);
      const secure = process.env.SMTP_SECURE === 'true';

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!,
        port: port,
        secure: secure,
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASSWORD!,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      console.log(`✓ 邮件服务已初始化 (${process.env.SMTP_HOST}:${port}, secure=${secure})`);
    } catch (error) {
      console.error('邮件服务初始化失败:', error);
      this.isEnabled = false;
    }
  }

  /**
   * 发送巡检报告
   */
  async sendPatrolReport(executionId: string): Promise<void> {
    if (!this.isEnabled || !this.transporter) {
      console.log('邮件服务未启用,跳过邮件发送');
      return;
    }

    try {
      // 获取执行记录
      const execution = await this.executionRepository.findById(executionId);
      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      // 获取任务信息
      const task = await this.taskRepository.findById(execution.patrolTaskId);
      if (!task) {
        throw new Error(`Task ${execution.patrolTaskId} not found`);
      }

      // 生成报告URL (传递 execution 以获取 originUrl)
      const reportUrl = this.getReportUrl(executionId, execution);

      // 生成邮件内容
      const subject = this.generateSubject(task, execution);
      const html = this.generateEmailHTML(task, execution, reportUrl);

      // 发送给所有配置的邮箱
      for (const email of task.notificationEmails) {
        await this.transporter.sendMail({
          from: `"DTC 测试工具 - 巡检系统" <${process.env.SMTP_USER}>`,
          to: email,
          subject,
          html,
        });

        console.log(`✓ 巡检报告已发送至 ${email}`);
      }

      // 标记邮件已发送
      await this.executionRepository.markEmailSent(executionId);
    } catch (error) {
      console.error('发送巡检报告失败:', error);
      throw error;
    }
  }

  /**
   * 获取报告完整URL
   */
  private getReportUrl(executionId: string, execution?: PatrolExecution): string {
    // 🌐 智能获取应用 URL (优先级: 请求来源 > 环境变量 > localhost)
    const baseUrl = execution?.originUrl || process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log(`[Patrol Email] Using base URL: ${baseUrl} (source: ${execution?.originUrl ? 'request' : (process.env.APP_URL ? 'APP_URL' : (process.env.FRONTEND_URL ? 'FRONTEND_URL' : 'fallback'))})`);
    return `${baseUrl}/patrol/execution/${executionId}`;
  }

  /**
   * 生成邮件主题
   */
  private generateSubject(task: PatrolTask, execution: PatrolExecution): string {
    const passRate = ((execution.passedUrls / execution.totalUrls) * 100).toFixed(0);
    const status = execution.failedUrls === 0 ? '✅ 全部通过' : `⚠️ ${execution.failedUrls} 项失败`;

    return `【巡检报告】${task.name} - ${status} (${passRate}%)`;
  }

  /**
   * 解析检查详情,提取置信度和检查项
   */
  private parseCheckDetails(checkDetails?: string): {
    pageType: string;
    message: string;
    checks: Array<{
      passed: boolean;
      name: string;
      message: string;
      confidence?: 'high' | 'medium' | 'low';
    }>;
  } | null {
    if (!checkDetails) return null;

    try {
      const lines = checkDetails.split('\n');
      const pageTypeLine = lines.find(l => l.startsWith('页面类型:'));
      const pageType = pageTypeLine ? pageTypeLine.replace('页面类型:', '').trim() : '';

      const messageLine = lines[1] || '';

      // 解析检查详情
      const checkStartIndex = lines.findIndex(l => l.includes('检查详情:'));
      const checks: Array<{ passed: boolean; name: string; message: string; confidence?: 'high' | 'medium' | 'low' }> = [];

      if (checkStartIndex !== -1) {
        for (let i = checkStartIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const passed = line.startsWith('✓');
          const failed = line.startsWith('✗');
          if (!passed && !failed) continue;

          // 提取置信度
          let confidence: 'high' | 'medium' | 'low' | undefined;
          const confidenceMatch = line.match(/\[置信度:\s*(高|中|低)\]/);
          if (confidenceMatch) {
            confidence = confidenceMatch[1] === '高' ? 'high' : confidenceMatch[1] === '中' ? 'medium' : 'low';
          }

          // 移除图标和置信度标签,提取内容
          const content = line
            .replace(/^[✓✗]\s*/, '')
            .replace(/\[置信度:\s*(高|中|低)\]/, '')
            .trim();

          const colonIndex = content.indexOf(':');
          const name = colonIndex !== -1 ? content.substring(0, colonIndex).trim() : content;
          const message = colonIndex !== -1 ? content.substring(colonIndex + 1).trim() : '';

          checks.push({ passed, name, message, confidence });
        }
      }

      return { pageType, message: messageLine, checks };
    } catch (error) {
      console.error('Failed to parse check details:', error);
      return null;
    }
  }

  /**
   * 生成 SEO 检测结果 HTML
   */
  private generateSEOResultsHTML(seoResults: any): string {
    if (!seoResults) return '';

    let html = `<div class="seo-results">`;

    // SEO 评分标题
    const score = seoResults.score ?? 0;
    const scoreClass = score >= 80 ? 'seo-score-good' : score >= 60 ? 'seo-score-warning' : 'seo-score-poor';
    const title = seoResults.title || '未知页面';

    html += `
      <div class="seo-header">
        <span class="seo-badge ${scoreClass}">SEO: ${score}分</span>
        <span class="seo-title">${title}</span>
      </div>
    `;

    // Hreflang 链接信息
    if (seoResults.hreflangLinks && seoResults.hreflangLinks.length > 0) {
      html += `
        <div class="seo-section">
          <div class="section-title">🌐 多语言配置</div>
          <ul class="seo-list">
            <li>✓ 检测到 ${seoResults.hreflangLinks.length} 个 Hreflang 链接</li>
      `;

      // Hreflang 问题
      if (seoResults.hreflangIssues) {
        if (seoResults.hreflangIssues.missingXDefault) {
          html += `<li class="seo-warning">⚠️ 缺少 x-default 标签</li>`;
        }
        if (seoResults.hreflangIssues.duplicateLangs && seoResults.hreflangIssues.duplicateLangs.length > 0) {
          const duplicates = seoResults.hreflangIssues.duplicateLangs.slice(0, 5).join(', ');
          const more = seoResults.hreflangIssues.duplicateLangs.length > 5
            ? ` (共${seoResults.hreflangIssues.duplicateLangs.length}个)`
            : '';
          html += `<li class="seo-error">❌ 发现重复的语言代码: ${duplicates}${more}</li>`;
        }
        if (seoResults.hreflangIssues.invalidUrls && seoResults.hreflangIssues.invalidUrls.length > 0) {
          const invalid = seoResults.hreflangIssues.invalidUrls.slice(0, 3).join(', ');
          const more = seoResults.hreflangIssues.invalidUrls.length > 3
            ? ` (共${seoResults.hreflangIssues.invalidUrls.length}个)`
            : '';
          html += `<li class="seo-error">❌ 无效的 Hreflang URL: ${invalid}${more}</li>`;
        }
      }

      html += `
          </ul>
        </div>
      `;
    }

    // Article 信息
    if (seoResults.article && seoResults.article.hasArticleTag) {
      html += `
        <div class="seo-section">
          <div class="section-title">📝 文章元数据</div>
          <ul class="seo-list">
      `;

      if (seoResults.article.author) {
        html += `<li>✓ 作者: ${seoResults.article.author}</li>`;
      }
      if (seoResults.article.publishedTime) {
        html += `<li>✓ 发布时间: ${seoResults.article.publishedTime}</li>`;
      }
      if (seoResults.article.modifiedTime) {
        html += `<li>✓ 修改时间: ${seoResults.article.modifiedTime}</li>`;
      }

      html += `
          </ul>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  /**
   * 生成邮件 HTML 内容
   */
  private generateEmailHTML(task: PatrolTask, execution: PatrolExecution, reportUrl: string): string {
    const passRate = ((execution.passedUrls / execution.totalUrls) * 100).toFixed(1);

    // 统计真正的失败数(排除低置信度的警告)
    const realFailures = execution.testResults.filter(result => {
      if (result.status === 'pass') return false;

      // 解析检查详情,查看是否都是低置信度问题
      const parsed = this.parseCheckDetails(result.checkDetails);
      if (!parsed) return true; // 无法解析则按失败处理

      const failedChecks = parsed.checks.filter(c => !c.passed);
      const allLowConfidence = failedChecks.every(c => c.confidence === 'low');

      return !allLowConfidence; // 如果不是全部低置信度,则算作真正的失败
    }).length;

    const statusColor = realFailures === 0 ? '#22c55e' : '#ef4444';
    const statusText = realFailures === 0 ? '全部通过' : `${realFailures} 项失败`;

    // 格式化时间
    const executionTime = execution.startedAt.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 生成测试结果列表
    const resultsHTML = execution.testResults
      .map((result) => {
        const parsed = this.parseCheckDetails(result.checkDetails);

        // 判断是否为警告(所有失败检查都是低置信度)
        let isWarning = false;
        if (result.status === 'fail' && parsed) {
          const failedChecks = parsed.checks.filter(c => !c.passed);
          isWarning = failedChecks.every(c => c.confidence === 'low');
        }

        const statusIcon = result.status === 'pass' ? '✅' : isWarning ? '⚠️' : '❌';
        const statusClass = result.status === 'pass' ? 'pass' : isWarning ? 'warning' : 'fail';
        const statusLabel = result.status === 'pass' ? '' : isWarning ? '<span class="warning-badge">需人工确认</span>' : '';

        // 生成检查详情HTML
        let checkDetailsHTML = '';
        if (parsed && parsed.checks.length > 0) {
          const checksListHTML = parsed.checks.map(check => {
            const checkIcon = check.passed ? '✓' : '✗';
            const checkClass = check.passed ? 'check-pass' : check.confidence === 'low' ? 'check-warning' : 'check-fail';
            const confidenceLabel = check.confidence
              ? `<span class="confidence-badge confidence-${check.confidence}">${
                  check.confidence === 'high' ? '高置信度' :
                  check.confidence === 'medium' ? '中置信度' :
                  '低置信度'
                }</span>`
              : '';

            return `
              <li class="check-item ${checkClass}">
                <span class="check-icon">${checkIcon}</span>
                <span class="check-name">${check.name}:</span>
                <span class="check-message">${check.message}</span>
                ${confidenceLabel}
              </li>
            `;
          }).join('');

          checkDetailsHTML = `
            <div class="check-details">
              <div class="check-header">
                <span class="page-type">${parsed.pageType}</span>
                ${parsed.message ? `<span class="page-message">${parsed.message}</span>` : ''}
              </div>
              <ul class="checks-list">
                ${checksListHTML}
              </ul>
            </div>
          `;
        } else if (result.errorMessage) {
          checkDetailsHTML = `<div class="error">${result.errorMessage}</div>`;
        }

        return `
        <tr>
          <td class="result-cell ${statusClass}">
            <div class="url-header">
              <span class="url-name">${statusIcon} ${result.name}</span>
              ${statusLabel}
            </div>
            <div class="url-link">${result.url}</div>
            ${checkDetailsHTML}
            ${result.seoResults ? this.generateSEOResultsHTML(result.seoResults) : ''}
          </td>
          <td class="result-cell center">${result.statusCode || '-'}</td>
          <td class="result-cell center">${result.responseTime ? `${result.responseTime}ms` : '-'}</td>
        </tr>
      `;
      })
      .join('');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>巡检报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
        'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
    }
    .summary {
      padding: 30px;
      background-color: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .summary-card {
      background: white;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .summary-card .label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .summary-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      background-color: ${statusColor};
      color: white;
    }
    .results {
      padding: 30px;
    }
    .results h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #111827;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
    }
    .results-table th {
      background-color: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    .result-cell {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .url-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .url-name {
      font-weight: 600;
      color: #111827;
    }
    .url-link {
      font-size: 12px;
      color: #6b7280;
      word-break: break-all;
      margin-bottom: 8px;
    }
    .warning-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      background-color: #fef3c7;
      color: #92400e;
      font-size: 11px;
      font-weight: 600;
    }
    .error {
      margin-top: 8px;
      padding: 8px;
      background-color: #fef2f2;
      border-left: 3px solid #ef4444;
      font-size: 12px;
      color: #991b1b;
    }
    .pass {
      color: #22c55e;
    }
    .warning {
      color: #f59e0b;
    }
    .fail {
      color: #ef4444;
    }
    .center {
      text-align: center;
    }

    /* 检查详情样式 */
    .check-details {
      margin-top: 12px;
      padding: 12px;
      background-color: #f9fafb;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    .check-header {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .page-type {
      display: inline-block;
      padding: 2px 8px;
      background-color: #dbeafe;
      color: #1e40af;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    .page-message {
      font-size: 13px;
      color: #374151;
    }
    .checks-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 6px 0;
      font-size: 13px;
      line-height: 1.4;
    }
    .check-icon {
      font-weight: bold;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .check-name {
      font-weight: 600;
      flex-shrink: 0;
    }
    .check-message {
      color: #6b7280;
      flex: 1;
    }
    .check-pass {
      color: #22c55e;
    }
    .check-pass .check-icon {
      color: #22c55e;
    }
    .check-warning {
      color: #f59e0b;
    }
    .check-warning .check-icon {
      color: #f59e0b;
    }
    .check-fail {
      color: #ef4444;
    }
    .check-fail .check-icon {
      color: #ef4444;
    }
    .confidence-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .confidence-high {
      background-color: #d1fae5;
      color: #065f46;
    }
    .confidence-medium {
      background-color: #fef3c7;
      color: #92400e;
    }
    .confidence-low {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .seo-results {
      margin-top: 12px;
      padding: 12px;
      background-color: #f0f9ff;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
    }
    .seo-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .seo-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      color: white;
    }
    .seo-score-good {
      background-color: #22c55e;
    }
    .seo-score-warning {
      background-color: #f59e0b;
    }
    .seo-score-poor {
      background-color: #ef4444;
    }
    .seo-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e40af;
    }
    .seo-section {
      margin-top: 10px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    .seo-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .seo-list li {
      padding: 4px 0;
      font-size: 12px;
      color: #4b5563;
    }
    .seo-warning {
      color: #f59e0b !important;
    }
    .seo-error {
      color: #ef4444 !important;
    }
    .report-button {
      display: inline-block;
      margin: 20px 0;
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      transition: transform 0.2s;
    }
    .report-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .footer {
      padding: 20px 30px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 巡检报告</h1>
      <p>${task.name}</p>
    </div>

    <div class="summary">
      <div style="text-align: center; margin-bottom: 20px;">
        <span class="status-badge">${statusText}</span>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">通过率</div>
          <div class="value">${passRate}%</div>
        </div>
        <div class="summary-card">
          <div class="label">总计</div>
          <div class="value">${execution.totalUrls}</div>
        </div>
        <div class="summary-card">
          <div class="label">通过</div>
          <div class="value" style="color: #22c55e;">${execution.passedUrls}</div>
        </div>
        <div class="summary-card">
          <div class="label">失败</div>
          <div class="value" style="color: #ef4444;">${execution.failedUrls}</div>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
        执行时间: ${executionTime} | 耗时: ${execution.durationMs}ms
      </div>
    </div>

    <div class="results">
      <h2>详细结果</h2>
      <table class="results-table">
        <thead>
          <tr>
            <th>页面</th>
            <th>状态码</th>
            <th>响应时间</th>
          </tr>
        </thead>
        <tbody>
          ${resultsHTML}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div style="margin-bottom: 20px;">
        <a href="${reportUrl}" class="report-button" style="color: white;">📊 查看完整报告</a>
      </div>
      <div style="margin-bottom: 15px; padding: 12px; background-color: #f3f4f6; border-radius: 6px; text-align: left;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">📊 置信度说明</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #6b7280; line-height: 1.8;">
          <li><strong style="color: #065f46;">高置信度</strong>: 检查结果准确度高,可直接判定</li>
          <li><strong style="color: #92400e;">中置信度</strong>: 检查结果基本可靠,建议复核</li>
          <li><strong style="color: #991b1b;">低置信度</strong>: 检查结果不确定,需要人工确认</li>
        </ul>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
          ⚠️ 标记为 <strong>"需人工确认"</strong> 的项目,所有失败检查均为低置信度,可能是误报,请人工查看页面后确认
        </p>
      </div>
      <p>此邮件由 DTC 测试工具自动发送</p>
      <p>如需修改巡检配置,请登录系统进行设置</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * 检查邮件服务是否可用
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }
}

export const patrolEmailService = new PatrolEmailService();
