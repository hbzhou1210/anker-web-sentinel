import React from 'react';
import { TestReport as TestReportType } from '../../services/api';
import { WebPageTestOverview } from '../WebPageTestOverview/WebPageTestOverview';
import './WebPageTestReport.css';

interface WebPageTestReportProps {
  report: TestReportType;
}

export function WebPageTestReport({ report }: WebPageTestReportProps) {
  const {
    url,
    completedAt,
    testDuration,
    webPageTestData,
  } = report;

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}秒`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!webPageTestData) {
    return (
      <div className="webpagetest-report">
        <div className="report-header">
          <h2>🎬 WebPageTest 性能测试报告</h2>
          <a href={url} target="_blank" rel="noopener noreferrer" className="tested-url">
            {url}
          </a>
        </div>
        <div className="no-data-message">
          <span className="warning-icon">⚠️</span>
          <p>WebPageTest 测试数据不可用</p>
          <p className="hint">测试可能超时或遇到错误</p>
        </div>
      </div>
    );
  }

  // 构建WebPageTest完整报告链接
  const webPageTestUrl = webPageTestData.testId
    ? `https://www.webpagetest.org/result/${webPageTestData.testId}/`
    : null;

  return (
    <div className="webpagetest-report">
      {/* Header - WebPageTest Style */}
      <div className="report-header">
        <div className="report-title">
          <h2>
            <span className="report-icon">🎬</span>
            WebPageTest 性能测试报告
          </h2>
          <a href={url} target="_blank" rel="noopener noreferrer" className="tested-url">
            {url}
          </a>
        </div>
        <div className="report-meta">
          <span className="meta-item">
            <span className="meta-label">测试时间:</span> {formatDate(completedAt)}
          </span>
          <span className="meta-item">
            <span className="meta-label">耗时:</span> {formatDuration(testDuration)}
          </span>
          {webPageTestData.testId && (
            <span className="meta-item">
              <span className="meta-label">Test ID:</span>
              <span className="test-id-text">{webPageTestData.testId}</span>
            </span>
          )}
        </div>
      </div>

      {/* 主要引导区域 - 去WebPageTest.org查看完整报告 */}
      <div className="webpagetest-content">
        <div className="webpagetest-redirect-section">
          <div className="redirect-icon">🌐</div>
          <h3 className="redirect-title">查看完整的 WebPageTest 报告</h3>
          <p className="redirect-description">
            WebPageTest 提供了详细的性能分析,包括:
          </p>
          <ul className="features-list">
            <li>📹 <strong>视频帧分析</strong> - 逐帧回放页面加载过程</li>
            <li>📊 <strong>瀑布图</strong> - 资源加载时序详细分析</li>
            <li>🎯 <strong>性能指标</strong> - FCP、LCP、TTI、TBT 等核心指标</li>
            <li>🔍 <strong>优化建议</strong> - 专业的性能优化指导</li>
            <li>📸 <strong>截图对比</strong> - 不同时间点的视觉对比</li>
            <li>🌍 <strong>多地点测试</strong> - 全球不同位置的测试结果</li>
          </ul>

          {webPageTestUrl ? (
            <a
              href={webPageTestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="view-full-report-button"
            >
              <span className="button-icon">🚀</span>
              <span className="button-text">前往 WebPageTest.org 查看完整报告</span>
              <span className="button-arrow">→</span>
            </a>
          ) : (
            <div className="no-link-message">
              <span className="warning-icon">⚠️</span>
              <p>测试 ID 不可用,无法生成报告链接</p>
            </div>
          )}

          {/* 基本性能指标摘要(如果有) */}
          {webPageTestData.performanceScore !== undefined && (
            <div className="performance-summary">
              <div className="summary-title">性能评分摘要</div>
              <div className="summary-score">
                <div className="score-circle" style={{
                  background: webPageTestData.performanceScore >= 90 ? '#0cce6b'
                    : webPageTestData.performanceScore >= 50 ? '#ffa400'
                    : '#ff4e42'
                }}>
                  <span className="score-value">{webPageTestData.performanceScore}</span>
                  <span className="score-max">/100</span>
                </div>
                <div className="score-label">总体性能评分</div>
              </div>
              <p className="summary-note">
                更多详细指标和分析请访问完整报告
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="report-footer">
        <p className="footer-note">
          <span className="info-icon">ℹ️</span>
          此测试由 WebPageTest 官方 API 生成,展示真实浏览器环境下的性能指标
        </p>
      </div>
    </div>
  );
}
