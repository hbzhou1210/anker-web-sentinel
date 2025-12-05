import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PatrolTaskRepository } from '../database/repositories/PatrolTaskRepository.js';
import { PatrolExecutionRepository } from '../database/repositories/PatrolExecutionRepository.js';
import { PatrolExecution, PatrolTask } from '../models/entities.js';

export class PatrolEmailService {
  private transporter: Transporter | null = null;
  private isEnabled: boolean;
  private taskRepository: PatrolTaskRepository;
  private executionRepository: PatrolExecutionRepository;

  constructor() {
    this.taskRepository = new PatrolTaskRepository();
    this.executionRepository = new PatrolExecutionRepository();

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

      // 生成邮件内容
      const subject = this.generateSubject(task, execution);
      const html = this.generateEmailHTML(task, execution);

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
   * 生成邮件主题
   */
  private generateSubject(task: PatrolTask, execution: PatrolExecution): string {
    const passRate = ((execution.passedUrls / execution.totalUrls) * 100).toFixed(0);
    const status = execution.failedUrls === 0 ? '✅ 全部通过' : `⚠️ ${execution.failedUrls} 项失败`;

    return `【巡检报告】${task.name} - ${status} (${passRate}%)`;
  }

  /**
   * 生成邮件 HTML 内容
   */
  private generateEmailHTML(task: PatrolTask, execution: PatrolExecution): string {
    const passRate = ((execution.passedUrls / execution.totalUrls) * 100).toFixed(1);
    const statusColor = execution.failedUrls === 0 ? '#22c55e' : '#ef4444';
    const statusText = execution.failedUrls === 0 ? '全部通过' : `${execution.failedUrls} 项失败`;

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
        const statusIcon = result.status === 'pass' ? '✅' : '❌';
        const statusClass = result.status === 'pass' ? 'pass' : 'fail';
        const errorInfo = result.errorMessage ? `<div class="error">${result.errorMessage}</div>` : '';

        return `
        <tr>
          <td class="result-cell ${statusClass}">
            <div class="url-name">${statusIcon} ${result.name}</div>
            <div class="url-link">${result.url}</div>
            ${errorInfo}
          </td>
          <td class="result-cell">${result.statusCode || '-'}</td>
          <td class="result-cell">${result.responseTime ? `${result.responseTime}ms` : '-'}</td>
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
    .url-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .url-link {
      font-size: 12px;
      color: #6b7280;
      word-break: break-all;
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
    .fail {
      color: #ef4444;
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
