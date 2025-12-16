import React, { useState } from 'react';
import { TestReport as TestReportType } from '../../services/api';
import { UITestResults } from '../UITestResults/UITestResults';
import { PerformanceResults } from '../PerformanceResults/PerformanceResults';
import { PerformanceOverview } from '../PerformanceOverview/PerformanceOverview';
import { WebPageTestOverview } from '../WebPageTestOverview/WebPageTestOverview';
import { PageSpeedOverview } from '../PageSpeedOverview/PageSpeedOverview';
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
  // 根据性能测试模式路由到专属报告组件
  // 优先检查数据完整性,避免在同时运行两种测试时显示不完整的报告

  // 检查 WebPageTest 数据是否被损坏(旧版本数据问题)
  const isWebPageTestDataCorrupted = report.webPageTestData &&
    (report.webPageTestData as any)._error === 'DATA_TRUNCATED';

  const hasWebPageTestData = report.webPageTestData &&
    !isWebPageTestDataCorrupted &&
    report.webPageTestData.testId &&
    report.webPageTestData.metrics;

  const hasPageSpeedData = report.pageSpeedData &&
    report.pageSpeedData.performanceScore !== undefined;

  // 如果两种数据都有,显示切换式双报告
  if (hasWebPageTestData && hasPageSpeedData) {
    return <DualPerformanceReport report={report} />;
  }

  // 如果只有一种数据,直接显示对应的专属报告
  if (hasWebPageTestData && !hasPageSpeedData) {
    return <WebPageTestReport report={report} />;
  }

  if (hasPageSpeedData && !hasWebPageTestData) {
    return <PageSpeedReport report={report} />;
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

  // 性能检测部分默认收起
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
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
      </div>

      {/* UI Test Results */}
      <div className="results-section">
        <h3 className="section-title">
          <span className="section-icon">🔍</span>
          UI功能检测
        </h3>
        <UITestResults results={uiTestResults} />
      </div>

      {/* Performance Results - Collapsible */}
      {(performanceResults.length > 0 || report.pageSpeedData || (renderingSnapshots && renderingSnapshots.length > 0)) && (
        <div className="results-section">
          <h3
            className="section-title collapsible"
            onClick={() => setPerformanceExpanded(!performanceExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <span className="collapse-indicator">{performanceExpanded ? '▼' : '▶'}</span>
            <span className="section-icon">⚡</span>
            性能检测
            <span className="section-hint">(点击{performanceExpanded ? '收起' : '展开'})</span>
          </h3>

          {performanceExpanded && (
            <>
              {/* Performance Metrics */}
              {performanceResults.length > 0 && (
                <PerformanceResults results={performanceResults} />
              )}

              {/* WebPageTest Overview - 优先使用完整的 API 数据 */}
              {report.webPageTestData ? (
                <div className="performance-overview-section">
                  <h4 className="performance-mode-title">
                    <span className="mode-icon">🎬</span>
                    WebPageTest 性能分析
                  </h4>
                  <WebPageTestOverview data={report.webPageTestData} />
                </div>
              ) : renderingSnapshots && renderingSnapshots.length > 0 ? (
                <div className="performance-overview-section">
                  <h4 className="performance-mode-title">
                    <span className="mode-icon">🎬</span>
                    性能快照分析 <span style={{fontSize: '0.8em', opacity: 0.7}}>(Playwright 兼容模式)</span>
                  </h4>
                  <PerformanceOverview snapshots={renderingSnapshots} testDuration={testDuration} />
                </div>
              ) : null}

              {/* PageSpeed Overview - if available */}
              {report.pageSpeedData && (
                <div className="performance-overview-section">
                  <h4 className="performance-mode-title">
                    <span className="mode-icon">🚀</span>
                    PageSpeed Insights 分析
                  </h4>
                  <PageSpeedOverview data={report.pageSpeedData} />
                </div>
              )}

              {/* 性能测试 API 失败警告 */}
              {report.performanceTestMode && report.performanceTestMode !== 'none' && (
                !hasWebPageTestData && !hasPageSpeedData
              ) && (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
