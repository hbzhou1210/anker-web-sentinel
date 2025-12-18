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
      // 新增: UI测试结果(用于详细分类统计)
      uiTestResults?: Array<{
        testType: string;
        status: string;
      }>;
      // 新增: 性能测试数据
      performanceTestMode?: string;
      pageSpeedData?: {
        performanceScore?: number;
        metrics?: {
          firstContentfulPaint?: number;
          largestContentfulPaint?: number;
          totalBlockingTime?: number;
          cumulativeLayoutShift?: number;
          speedIndex?: number;
          timeToInteractive?: number;
        };
      };
      webPageTestData?: {
        testId?: string;
        performanceScore?: number;
      };
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
    uiTestResults?: Array<{
      testType: string;
      status: string;
    }>;
    performanceTestMode?: string;
    pageSpeedData?: {
      performanceScore?: number;
      metrics?: {
        firstContentfulPaint?: number;
        largestContentfulPaint?: number;
        totalBlockingTime?: number;
        cumulativeLayoutShift?: number;
        speedIndex?: number;
        timeToInteractive?: number;
      };
    };
    webPageTestData?: {
      testId?: string;
      performanceScore?: number;
    };
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

          ${this.generateFunctionalTestsSection(testReport)}

          ${this.generatePerformanceSection(testReport)}

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
   * Generate functional tests breakdown section for email
   */
  private generateFunctionalTestsSection(testReport: {
    uiTestResults?: Array<{
      testType: string;
      status: string;
    }>;
  }): string {
    if (!testReport.uiTestResults || testReport.uiTestResults.length === 0) {
      return '';
    }

    // 统计各类型测试
    const testStats = {
      link: { total: 0, passed: 0, failed: 0 },
      form: { total: 0, passed: 0, failed: 0 },
      button: { total: 0, passed: 0, failed: 0 },
      image: { total: 0, passed: 0, failed: 0 },
    };

    testReport.uiTestResults.forEach(result => {
      const type = result.testType as keyof typeof testStats;
      if (testStats[type]) {
        testStats[type].total++;
        if (result.status === 'pass') {
          testStats[type].passed++;
        } else if (result.status === 'fail') {
          testStats[type].failed++;
        }
      }
    });

    // 测试类型图标和名称映射
    const testTypeInfo = {
      link: { icon: '🔗', name: '链接检测' },
      form: { icon: '📝', name: '表单检测' },
      button: { icon: '🔘', name: '按钮检测' },
      image: { icon: '🖼️', name: '图片检测' },
    };

    // 只显示有数据的测试类型
    const activeTests = (Object.keys(testStats) as Array<keyof typeof testStats>).filter(
      type => testStats[type].total > 0
    );

    if (activeTests.length === 0) {
      return '';
    }

    let functionalHTML = `
      <div style="margin-bottom: 25px;">
        <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a;">
          <span style="margin-right: 8px;">🎯</span>功能测试明细
        </h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
    `;

    activeTests.forEach(type => {
      const stats = testStats[type];
      const info = testTypeInfo[type];
      const passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
      const statusColor = stats.failed === 0 ? '#10b981' : stats.failed < stats.total / 2 ? '#f59e0b' : '#ef4444';

      functionalHTML += `
          <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; border-left: 3px solid ${statusColor};">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 18px; margin-right: 6px;">${info.icon}</span>
              <strong style="font-size: 13px; color: #374151;">${info.name}</strong>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
              总计: ${stats.total} | 通过: ${stats.passed} ${stats.failed > 0 ? `| 失败: ${stats.failed}` : ''}
            </div>
            <div style="background-color: #e5e7eb; height: 6px; border-radius: 3px; overflow: hidden;">
              <div style="background-color: ${statusColor}; height: 100%; width: ${passRate}%;"></div>
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px; text-align: right;">
              ${passRate}% 通过率
            </div>
          </div>
      `;
    });

    functionalHTML += `
        </div>
      </div>
    `;

    return functionalHTML;
  }

  /**
   * Generate performance test section for email
   */
  private generatePerformanceSection(testReport: {
    performanceTestMode?: string;
    pageSpeedData?: {
      performanceScore?: number;
      metrics?: {
        firstContentfulPaint?: number;
        largestContentfulPaint?: number;
        totalBlockingTime?: number;
        cumulativeLayoutShift?: number;
        speedIndex?: number;
        timeToInteractive?: number;
      };
    };
    webPageTestData?: {
      testId?: string;
      performanceScore?: number;
    };
  }): string {
    const hasPageSpeed = testReport.pageSpeedData && testReport.pageSpeedData.performanceScore !== undefined;
    const hasWebPageTest = testReport.webPageTestData && testReport.webPageTestData.testId;

    if (!hasPageSpeed && !hasWebPageTest) {
      return '';
    }

    let performanceHTML = '<div style="margin-bottom: 25px;"><h2 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a;">性能测试结果 ⚡</h2>';

    // PageSpeed Insights 数据
    if (hasPageSpeed) {
      const psScore = testReport.pageSpeedData!.performanceScore!;
      const psColor = psScore >= 90 ? '#0cce6b' : psScore >= 50 ? '#ffa400' : '#ff4e42';

      performanceHTML += `
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 20px; margin-right: 8px;">🚀</span>
            <strong style="color: #1e40af;">PageSpeed Insights</strong>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background-color: ${psColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 15px;">
              ${psScore}
            </div>
            <span style="color: #374151; font-size: 14px;">性能评分</span>
          </div>
      `;

      // 核心性能指标
      if (testReport.pageSpeedData!.metrics) {
        const metrics = testReport.pageSpeedData!.metrics;
        performanceHTML += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';

        if (metrics.largestContentfulPaint !== undefined) {
          const lcp = metrics.largestContentfulPaint;
          const lcpSeconds = (lcp / 1000).toFixed(2);
          const lcpColor = lcp <= 2500 ? '#0cce6b' : lcp <= 4000 ? '#ffa400' : '#ff4e42';
          performanceHTML += `
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">LCP (最大内容绘制)</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${lcpColor}; font-size: 13px;">${lcpSeconds}s</td>
            </tr>
          `;
        }

        if (metrics.firstContentfulPaint !== undefined) {
          const fcp = metrics.firstContentfulPaint;
          const fcpSeconds = (fcp / 1000).toFixed(2);
          const fcpColor = fcp <= 1800 ? '#0cce6b' : fcp <= 3000 ? '#ffa400' : '#ff4e42';
          performanceHTML += `
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">FCP (首次内容绘制)</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${fcpColor}; font-size: 13px;">${fcpSeconds}s</td>
            </tr>
          `;
        }

        if (metrics.totalBlockingTime !== undefined) {
          const tbt = metrics.totalBlockingTime;
          const tbtSeconds = (tbt / 1000).toFixed(2); // 转换为秒
          const tbtColor = tbt <= 200 ? '#0cce6b' : tbt <= 600 ? '#ffa400' : '#ff4e42';
          performanceHTML += `
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">TBT (总阻塞时间)</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${tbtColor}; font-size: 13px;">${tbtSeconds}s</td>
            </tr>
          `;
        }

        if (metrics.cumulativeLayoutShift !== undefined) {
          const cls = metrics.cumulativeLayoutShift;
          const clsColor = cls <= 0.1 ? '#0cce6b' : cls <= 0.25 ? '#ffa400' : '#ff4e42';
          performanceHTML += `
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">CLS (累积布局偏移)</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${clsColor}; font-size: 13px;">${cls.toFixed(3)}</td>
            </tr>
          `;
        }

        performanceHTML += '</table>';
      }

      performanceHTML += '</div>';
    }

    // WebPageTest 数据
    if (hasWebPageTest) {
      const wptTestId = testReport.webPageTestData!.testId!;
      const wptUrl = `https://www.webpagetest.org/result/${wptTestId}/`;

      performanceHTML += `
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 20px; margin-right: 8px;">🎬</span>
            <strong style="color: #92400e;">WebPageTest</strong>
          </div>
          <p style="margin: 10px 0; color: #78350f; font-size: 13px;">
            WebPageTest 提供了详细的性能分析,包括视频帧分析、瀑布图等高级诊断。
          </p>
      `;

      if (testReport.webPageTestData!.performanceScore !== undefined) {
        const wptScore = testReport.webPageTestData!.performanceScore;
        const wptColor = wptScore >= 90 ? '#0cce6b' : wptScore >= 50 ? '#ffa400' : '#ff4e42';
        performanceHTML += `
          <div style="display: flex; align-items: center; margin: 10px 0;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background-color: ${wptColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; margin-right: 12px;">
              ${wptScore}
            </div>
            <span style="color: #78350f; font-size: 13px;">性能评分</span>
          </div>
        `;
      }

      performanceHTML += `
          <div style="margin-top: 12px;">
            <a href="${wptUrl}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">
              查看 WebPageTest 完整报告 →
            </a>
          </div>
        </div>
      `;
    }

    performanceHTML += '</div>';
    return performanceHTML;
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
