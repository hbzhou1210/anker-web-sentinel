import React from 'react';
import { TestReport as TestReportType } from '../../services/api';
import { PageSpeedOverview } from '../PageSpeedOverview/PageSpeedOverview';
import './PageSpeedReport.css';

interface PageSpeedReportProps {
  report: TestReportType;
}

export function PageSpeedReport({ report }: PageSpeedReportProps) {
  const {
    url,
    completedAt,
    testDuration,
    pageSpeedData,
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

  if (!pageSpeedData) {
    return (
      <div className="pagespeed-report">
        <div className="report-header">
          <h2>🚀 PageSpeed Insights 分析报告</h2>
          <a href={url} target="_blank" rel="noopener noreferrer" className="tested-url">
            {url}
          </a>
        </div>
        <div className="no-data-message">
          <span className="warning-icon">⚠️</span>
          <p>PageSpeed Insights 数据不可用</p>
          <p className="hint">测试可能遇到错误或 API 限制</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pagespeed-report">
      {/* Header - PageSpeed Style */}
      <div className="report-header">
        <div className="report-title">
          <h2>
            <span className="report-icon">🚀</span>
            PageSpeed Insights 分析报告
          </h2>
          <a href={url} target="_blank" rel="noopener noreferrer" className="tested-url">
            {url}
          </a>
        </div>
        <div className="report-meta">
          <span className="meta-item">
            <span className="meta-label">分析时间:</span> {formatDate(completedAt)}
          </span>
          <span className="meta-item">
            <span className="meta-label">耗时:</span> {formatDuration(testDuration)}
          </span>
          <span className="meta-item">
            <span className="meta-label">性能评分:</span>
            <span className={`score-badge score-${getScoreClass(pageSpeedData.performanceScore)}`}>
              {pageSpeedData.performanceScore}/100
            </span>
          </span>
        </div>
      </div>

      {/* PageSpeed Results */}
      <div className="pagespeed-content">
        <PageSpeedOverview data={pageSpeedData} />
      </div>

      {/* Footer */}
      <div className="report-footer">
        <p className="footer-note">
          <span className="info-icon">ℹ️</span>
          此报告由 Google PageSpeed Insights API 生成,提供 Core Web Vitals 指标和优化建议
        </p>
        <a
          href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="view-online"
        >
          在 PageSpeed Insights 查看完整报告 →
        </a>
      </div>
    </div>
  );
}

// Helper function to get score class
function getScoreClass(score: number): string {
  if (score >= 90) return 'good';
  if (score >= 50) return 'average';
  return 'poor';
}
