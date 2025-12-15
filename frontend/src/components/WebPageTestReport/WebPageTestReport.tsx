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
              <a
                href={`https://www.webpagetest.org/result/${webPageTestData.testId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="test-link"
              >
                {webPageTestData.testId}
              </a>
            </span>
          )}
        </div>
      </div>

      {/* WebPageTest Results */}
      <div className="webpagetest-content">
        <WebPageTestOverview data={webPageTestData} />
      </div>

      {/* Footer */}
      <div className="report-footer">
        <p className="footer-note">
          <span className="info-icon">ℹ️</span>
          此报告由 WebPageTest 官方 API 生成,展示真实浏览器环境下的性能指标
        </p>
      </div>
    </div>
  );
}
