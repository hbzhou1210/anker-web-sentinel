import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTestReport } from '../services/queries';
import { TestReport as TestReportComponent } from '../components/TestReport/TestReport';
import './Report.css';

export function Report() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading, error } = useTestReport(reportId || null);

  if (isLoading) {
    return (
      <div className="report-page">
        <div className="report-loading">
          <div className="loading-spinner">⏳</div>
          <p>加载报告中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-page">
        <div className="report-error">
          <div className="error-icon">❌</div>
          <h2>加载失败</h2>
          <p className="error-message">{error.message}</p>
          <button className="back-button" onClick={() => navigate('/')}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="report-page">
        <div className="report-error">
          <div className="error-icon">📭</div>
          <h2>报告不存在</h2>
          <p className="error-message">未找到ID为 {reportId} 的报告</p>
          <button className="back-button" onClick={() => navigate('/')}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <header className="report-page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← 返回首页
        </button>
        <div className="header-actions">
          <button
            className="action-button"
            onClick={() => {
              // Copy report URL to clipboard
              const url = window.location.href;
              navigator.clipboard.writeText(url);
              alert('报告链接已复制到剪贴板');
            }}
          >
            📋 复制链接
          </button>
          <button
            className="action-button"
            onClick={() => {
              // Open print dialog
              window.print();
            }}
          >
            🖨️ 打印报告
          </button>
        </div>
      </header>

      <main className="report-page-main">
        <TestReportComponent report={report} />
      </main>

      <footer className="report-page-footer">
        <button className="back-button-bottom" onClick={() => navigate('/')}>
          ← 返回首页
        </button>
      </footer>
    </div>
  );
}
