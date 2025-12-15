import React, { useState } from 'react';
import { TestReport as TestReportType } from '../../services/api';
import { UITestResults } from '../UITestResults/UITestResults';
import { PerformanceResults } from '../PerformanceResults/PerformanceResults';
import { PerformanceOverview } from '../PerformanceOverview/PerformanceOverview';
import { WebPageTestOverview } from '../WebPageTestOverview/WebPageTestOverview';
import { PageSpeedOverview } from '../PageSpeedOverview/PageSpeedOverview';
import './TestReport.css';

interface TestReportProps {
  report: TestReportType;
}

export function TestReport({ report }: TestReportProps) {
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
