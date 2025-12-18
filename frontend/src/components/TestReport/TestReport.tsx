import React, { useState } from 'react';
import { TestReport as TestReportType } from '../../services/api';
import { UITestResults } from '../UITestResults/UITestResults';
import { PerformanceResults } from '../PerformanceResults/PerformanceResults';
import { PerformanceOverview } from '../PerformanceOverview/PerformanceOverview';
import { WebPageTestOverview } from '../WebPageTestOverview/WebPageTestOverview';
import { PageSpeedOverview } from '../PageSpeedOverview/PageSpeedOverview';
import { PageSpeedOverviewCompact } from '../PageSpeedOverview/PageSpeedOverviewCompact';
import { PageSpeedOverviewMinimal } from '../PageSpeedOverview/PageSpeedOverviewMinimal';
import { WebPageTestReport } from '../WebPageTestReport/WebPageTestReport';
import { PageSpeedReport } from '../PageSpeedReport/PageSpeedReport';
import './TestReport.css';

interface TestReportProps {
  report: TestReportType;
}

// 性能测试错误报告组件 - 当性能测试失败或无数据时使用
function PerformanceTestErrorReport({ report }: TestReportProps) {
  const getTestModeName = (mode: string) => {
    if (mode === 'webpagetest') return 'WebPageTest';
    if (mode === 'pagespeed') return 'PageSpeed Insights';
    return '性能测试';
  };

  const testName = getTestModeName(report.performanceTestMode || '');

  return (
    <div className="performance-error-report">
      <div className="error-header">
        <div className="error-icon">⚠️</div>
        <h2>性能测试未完成</h2>
      </div>

      <div className="error-content">
        <div className="error-message">
          <h3>{testName} 测试数据不可用</h3>
          <p>测试已标记为完成，但没有返回性能数据。这可能是由以下原因造成的：</p>
          <ul>
            <li>🌐 外部 API 服务响应超时或失败</li>
            <li>🔒 目标网站无法访问或有访问限制</li>
            <li>⏱️ 测试执行时间过长导致超时</li>
            <li>🔧 服务配置或网络连接问题</li>
          </ul>
        </div>

        <div className="error-details">
          <h4>测试信息</h4>
          <div className="detail-item">
            <span className="detail-label">测试 ID:</span>
            <span className="detail-value">{report.id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">目标 URL:</span>
            <a href={report.url} target="_blank" rel="noopener noreferrer" className="detail-link">
              {report.url}
            </a>
          </div>
          <div className="detail-item">
            <span className="detail-label">测试模式:</span>
            <span className="detail-value">{testName}</span>
          </div>
        </div>

        <div className="error-actions">
          <h4>建议操作</h4>
          <div className="action-list">
            <div className="action-item">
              <span className="action-icon">🔄</span>
              <span>尝试重新运行测试</span>
            </div>
            <div className="action-item">
              <span className="action-icon">🔍</span>
              <span>检查目标网站是否可正常访问</span>
            </div>
            <div className="action-item">
              <span className="action-icon">⏰</span>
              <span>稍后再试（外部服务可能暂时繁忙）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 双报告展示组件 - 当同时有 WebPageTest 和 PageSpeed 数据时使用
function DualPerformanceReport({ report }: TestReportProps) {
  // 默认显示 performanceTestMode 指定的报告
  const defaultMode = report.performanceTestMode === 'pagespeed' ? 'pagespeed' : 'webpagetest';
  const [activeReport, setActiveReport] = useState<'webpagetest' | 'pagespeed'>(defaultMode);

  return (
    <div className="dual-performance-report">
      {/* 报告切换器 */}
      <div className="report-switcher">
        <div className="switcher-header">
          <span className="switcher-icon">📊</span>
          <span className="switcher-title">性能测试报告</span>
          <span className="switcher-hint">两种测试均已完成，可切换查看</span>
        </div>
        <div className="switcher-tabs">
          <button
            className={`tab-button ${activeReport === 'webpagetest' ? 'active' : ''}`}
            onClick={() => setActiveReport('webpagetest')}
          >
            <span className="tab-icon">🎬</span>
            <span className="tab-label">WebPageTest</span>
            {report.performanceTestMode === 'webpagetest' && (
              <span className="tab-badge">主报告</span>
            )}
          </button>
          <button
            className={`tab-button ${activeReport === 'pagespeed' ? 'active' : ''}`}
            onClick={() => setActiveReport('pagespeed')}
          >
            <span className="tab-icon">🚀</span>
            <span className="tab-label">PageSpeed Insights</span>
            {report.performanceTestMode === 'pagespeed' && (
              <span className="tab-badge">主报告</span>
            )}
          </button>
        </div>
      </div>

      {/* 报告内容 */}
      <div className="report-content">
        {activeReport === 'webpagetest' ? (
          <WebPageTestReport report={report} />
        ) : (
          <PageSpeedReport report={report} />
        )}
      </div>
    </div>
  );
}

export function TestReport({ report }: TestReportProps) {
  // 检查各种测试数据是否存在
  const isWebPageTestDataCorrupted = report.webPageTestData &&
    (report.webPageTestData as any)._error === 'DATA_TRUNCATED';

  const hasWebPageTestData = report.webPageTestData &&
    !isWebPageTestDataCorrupted &&
    report.webPageTestData.testId &&
    report.webPageTestData.metrics;

  const hasPageSpeedData = report.pageSpeedData &&
    report.pageSpeedData.performanceScore !== undefined;

  const hasUITestData = report.uiTestResults && report.uiTestResults.length > 0;

  // 检查是否是纯性能测试报告(没有UI测试数据)
  const isPurePerformanceReport = !hasUITestData && (hasPageSpeedData || hasWebPageTestData);

  // 如果是纯性能测试且只有一种数据,使用专用组件
  if (isPurePerformanceReport) {
    if (hasWebPageTestData && hasPageSpeedData) {
      return <DualPerformanceReport report={report} />;
    }
    if (hasPageSpeedData) {
      return <PageSpeedReport report={report} />;
    }
    if (hasWebPageTestData) {
      return <WebPageTestReport report={report} />;
    }
  }

  // 如果数据被损坏,显示友好的错误提示
  if (isWebPageTestDataCorrupted) {
    return (
      <div className="test-report legacy-data-error">
        <div className="report-header">
          <div className="header-content">
            <h1 className="report-title">⚠️ 测试报告数据不可用</h1>
            <p className="report-url">{report.url}</p>
          </div>
        </div>
        <div className="error-message-box">
          <div className="error-icon">🔧</div>
          <h2>数据格式已过期</h2>
          <p>此报告使用旧版本格式存储,已无法正常读取。</p>
          <p>建议操作:</p>
          <ul>
            <li>重新运行该URL的测试,生成新报告</li>
            <li>新报告将使用优化的存储格式,数据体积更小,读取更快</li>
          </ul>
          <div className="error-details">
            <strong>技术信息:</strong> WebPageTest 数据解压失败 (DATA_TRUNCATED)
          </div>
        </div>
      </div>
    );
  }

  // 如果是纯性能测试模式且完全没有任何数据,显示错误提示
  if (report.performanceTestMode && report.performanceTestMode !== 'none') {
    const hasAnyData = hasWebPageTestData || hasPageSpeedData ||
                       (report.performanceResults && report.performanceResults.length > 0) ||
                       (report.renderingSnapshots && report.renderingSnapshots.length > 0) ||
                       (report.uiTestResults && report.uiTestResults.length > 0);

    if (!hasAnyData) {
      return <PerformanceTestErrorReport report={report} />;
    }
  }

  // 所有报告部分默认收起
  const [uiTestExpanded, setUITestExpanded] = useState(false);
  const [pageSpeedExpanded, setPageSpeedExpanded] = useState(false);
  const [webPageTestExpanded, setWebPageTestExpanded] = useState(false);
  const {
    url,
    overallScore,
    totalChecks,
    passedChecks,
    failedChecks,
    warningChecks,
    testDuration,
    completedAt,
    uiTestResults,
    performanceResults,
    renderingSnapshots,
  } = report;

  // Calculate score color and status
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-warning';
    return 'score-poor';
  };

  const getScoreStatus = (score: number): string => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    return '需要改进';
  };

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

  return (
    <div className="test-report">
      {/* Header */}
      <div className="report-header">
        <div className="report-title">
          <h2>检测报告</h2>
          <a href={url} target="_blank" rel="noopener noreferrer" className="tested-url">
            {url}
          </a>
        </div>
        <div className="report-meta">
          <span className="meta-item">
            <span className="meta-label">完成时间:</span> {formatDate(completedAt)}
          </span>
          <span className="meta-item">
            <span className="meta-label">耗时:</span> {formatDuration(testDuration)}
          </span>
        </div>
      </div>

      {/* Overall Score */}
      <div className="overall-score-section">
        <div className="score-circle-container">
          <div className={`score-circle ${getScoreColor(overallScore)}`}>
            <div className="score-value">{overallScore}</div>
            <div className="score-max">/100</div>
          </div>
          <div className="score-status">{getScoreStatus(overallScore)}</div>
          <div className="score-label">功能测试分数</div>
        </div>

        <div className="score-breakdown">
          <div className="breakdown-item">
            <div className="breakdown-label">总检测项</div>
            <div className="breakdown-value">{totalChecks}</div>
          </div>
          <div className="breakdown-item breakdown-pass">
            <div className="breakdown-label">通过</div>
            <div className="breakdown-value">{passedChecks}</div>
          </div>
          <div className="breakdown-item breakdown-warning">
            <div className="breakdown-label">警告</div>
            <div className="breakdown-value">{warningChecks}</div>
          </div>
          <div className="breakdown-item breakdown-fail">
            <div className="breakdown-label">失败</div>
            <div className="breakdown-value">{failedChecks}</div>
          </div>
        </div>

        {/* LCP Performance Metric - Highlighted */}
        {report.pageSpeedData && report.pageSpeedData.metrics && (
          <div className="lcp-highlight-container">
            <div className="lcp-highlight">
              <div className="lcp-icon">⚡</div>
              <div className="lcp-content">
                <div className="lcp-label">LCP (最大内容绘制)</div>
                <div className={`lcp-value ${
                  report.pageSpeedData.metrics.largestContentfulPaint <= 2500 ? 'lcp-good' :
                  report.pageSpeedData.metrics.largestContentfulPaint <= 4000 ? 'lcp-needs-improvement' :
                  'lcp-poor'
                }`}>
                  {(report.pageSpeedData.metrics.largestContentfulPaint / 1000).toFixed(2)}s
                </div>
                <div className="lcp-target">目标: &lt; 2.5s</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* UI Test Results - Collapsible */}
      {hasUITestData && (
        <div className="results-section">
          <h3
            className="section-title collapsible"
            onClick={() => setUITestExpanded(!uiTestExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <span className="collapse-indicator">{uiTestExpanded ? '▼' : '▶'}</span>
            <span className="section-icon">🔍</span>
            UI功能检测
            <span className="section-hint">(点击{uiTestExpanded ? '收起' : '展开'})</span>
          </h3>

          {uiTestExpanded && (
            <UITestResults results={uiTestResults} />
          )}
        </div>
      )}

      {/* PageSpeed Insights Report - Collapsible */}
      {hasPageSpeedData && (
        <div className="results-section">
          <h3
            className="section-title collapsible"
            onClick={() => setPageSpeedExpanded(!pageSpeedExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <span className="collapse-indicator">{pageSpeedExpanded ? '▼' : '▶'}</span>
            <span className="section-icon">🚀</span>
            PageSpeed Insights 报告
            <span className="section-hint">(点击{pageSpeedExpanded ? '收起' : '展开'})</span>
          </h3>

          {pageSpeedExpanded && (
            <div className="performance-overview-section">
              <PageSpeedOverviewMinimal data={report.pageSpeedData} />

              {/* 跳转到 PageSpeed Insights 按钮 */}
              <div className="pagespeed-redirect-section" style={{ marginTop: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                <a
                  href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-full-report-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#1a73e8', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: '500', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#1557b0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1a73e8'}
                >
                  <span className="button-icon">🚀</span>
                  <span className="button-text">在 PageSpeed Insights 查看完整报告</span>
                  <span className="button-arrow">→</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WebPageTest Report - Collapsible */}
      {hasWebPageTestData && (
        <div className="results-section">
          <h3
            className="section-title collapsible"
            onClick={() => setWebPageTestExpanded(!webPageTestExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <span className="collapse-indicator">{webPageTestExpanded ? '▼' : '▶'}</span>
            <span className="section-icon">🎬</span>
            WebPageTest 报告
            <span className="section-hint">(点击{webPageTestExpanded ? '收起' : '展开'})</span>
          </h3>

          {webPageTestExpanded && (
            <div className="webpagetest-redirect-section">
              <div className="redirect-icon">🌐</div>
              <h4 className="redirect-title">查看完整的 WebPageTest 报告</h4>
              <p className="redirect-description">
                WebPageTest 提供了详细的性能分析,包括视频帧分析、瀑布图等高级诊断。
              </p>
              {report.webPageTestData?.testId && (
                <a
                  href={`https://www.webpagetest.org/result/${report.webPageTestData.testId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-full-report-button"
                >
                  <span className="button-icon">🚀</span>
                  <span className="button-text">前往 WebPageTest.org 查看完整报告</span>
                  <span className="button-arrow">→</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Basic Performance Results (Playwright fallback) - Collapsible */}
      {(performanceResults.length > 0 || (renderingSnapshots && renderingSnapshots.length > 0)) && !hasPageSpeedData && !hasWebPageTestData && (
        <div className="results-section">
          <h3
            className="section-title collapsible"
            onClick={() => setPageSpeedExpanded(!pageSpeedExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <span className="collapse-indicator">{pageSpeedExpanded ? '▼' : '▶'}</span>
            <span className="section-icon">⚡</span>
            基础性能检测
            <span className="section-hint">(点击{pageSpeedExpanded ? '收起' : '展开'})</span>
          </h3>

          {pageSpeedExpanded && (
            <>
              {performanceResults.length > 0 && (
                <PerformanceResults results={performanceResults} />
              )}

              {renderingSnapshots && renderingSnapshots.length > 0 && (
                <div className="performance-overview-section">
                  <h4 className="performance-mode-title">
                    <span className="mode-icon">⚡</span>
                    性能快照分析
                  </h4>
                  <PerformanceOverview snapshots={renderingSnapshots} testDuration={testDuration} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Performance Test API Failure Warning */}
      {report.performanceTestMode && report.performanceTestMode !== 'none' && !hasWebPageTestData && !hasPageSpeedData && (
        <div className="performance-api-warning">
          <div className="warning-header">
            <span className="warning-icon">⚠️</span>
            <span className="warning-title">
              {report.performanceTestMode === 'webpagetest' && 'WebPageTest API 调用失败'}
              {report.performanceTestMode === 'pagespeed' && 'PageSpeed Insights API 调用失败'}
            </span>
          </div>
          <p className="warning-message">
            外部性能测试服务未返回数据。可能的原因包括 API 超时、目标网站响应慢或服务繁忙。
            {(renderingSnapshots && renderingSnapshots.length > 0) &&
              ' 已使用 Playwright 兼容模式提供基础性能数据。'
            }
          </p>
        </div>
      )}
    </div>
  );
}
