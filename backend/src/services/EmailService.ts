import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email Service for sending test report notifications
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private isEnabled: boolean;

  constructor() {
    // Check if email service is configured
    this.isEnabled = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    );

    if (this.isEnabled) {
      this.initializeTransporter();
    } else {
      console.warn('⚠️  Email service is disabled. Set SMTP environment variables to enable.');
    }
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter(): void {
    try {
      const port = parseInt(process.env.SMTP_PORT!, 10);
      const secure = process.env.SMTP_SECURE === 'true';

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!,
        port: port,
        secure: secure, // true for 465 (SSL), false for 587 (TLS)
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASSWORD!,
        },
        // Additional options for better compatibility with various SMTP servers
        tls: {
          // Do not fail on invalid certs in development
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      console.log(`✓ Email service initialized (${process.env.SMTP_HOST}:${port}, secure=${secure})`);
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Send test completion notification email
   */
  async sendTestCompletionEmail(
    recipientEmail: string,
    testReport: {
      url: string;
      overallScore: number;
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      warningChecks: number;
      reportUrl: string;
      completedAt: string;
    }
  ): Promise<void> {
    if (!this.isEnabled || !this.transporter) {
      console.log('Email service is disabled, skipping email notification');
      return;
    }

    const subject = `测试报告: ${testReport.url} - 得分 ${testReport.overallScore}`;

    const html = this.generateReportEmailHTML(testReport);

    try {
      await this.transporter.sendMail({
        from: `"Web Automation Checker" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject,
        html,
      });

      console.log(`✓ Test completion email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML content for test report email
   */
  private generateReportEmailHTML(testReport: {
    url: string;
    overallScore: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    reportUrl: string;
    completedAt: string;
  }): string {
    const scoreColor = testReport.overallScore >= 80 ? '#10b981' :
                       testReport.overallScore >= 60 ? '#f59e0b' : '#ef4444';

    const statusEmoji = testReport.failedChecks === 0 ? '✅' : '⚠️';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>测试报告</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Web Automation Checker</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">自动化测试报告</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; width: 100px; height: 100px; border-radius: 50%; background-color: ${scoreColor}; color: white; font-size: 36px; font-weight: bold; line-height: 100px;">
              ${testReport.overallScore}
            </div>
            <p style="margin: 15px 0 5px 0; font-size: 14px; color: #666;">综合得分</p>
          </div>

          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a;">测试网站</h2>
            <p style="margin: 0; word-break: break-all; color: #2563eb;">${testReport.url}</p>
          </div>

          <div style="margin-bottom: 25px;">
            <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a;">测试结果 ${statusEmoji}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280;">总检查项</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">
                  ${testReport.totalChecks}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #059669;">✅ 通过</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #059669;">
                  ${testReport.passedChecks}
                </td>
              </tr>
              ${testReport.warningChecks > 0 ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #d97706;">⚠️ 警告</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #d97706;">
                  ${testReport.warningChecks}
                </td>
              </tr>
              ` : ''}
              ${testReport.failedChecks > 0 ? `
              <tr>
                <td style="padding: 10px;">
                  <span style="color: #dc2626;">❌ 失败</span>
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 600; color: #dc2626;">
                  ${testReport.failedChecks}
                </td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${testReport.reportUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              查看完整报告
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
            <p style="margin: 5px 0;">完成时间: ${new Date(testReport.completedAt).toLocaleString('zh-CN')}</p>
            <p style="margin: 15px 0 0 0;">由 Claude Code 构建 | Powered by Playwright & Lighthouse</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const emailService = new EmailService();
