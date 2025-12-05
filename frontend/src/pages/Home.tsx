import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TestInput } from '../components/TestInput/TestInput';
import { useTestStatus, useReportList } from '../services/queries';
import api from '../services/api';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const [currentTestId, setCurrentTestId] = useState<string | null>(() => {
    // 从 localStorage 恢复正在进行的测试
    return localStorage.getItem('currentTestId');
  });
  const [pollingEnabled, setPollingEnabled] = useState(() => {
    // 如果有保存的测试ID，启用轮询
    return !!localStorage.getItem('currentTestId');
  });
  const [testError, setTestError] = useState<string | null>(null);

  // Poll current test status
  const { data: testStatus } = useTestStatus(currentTestId, { enabled: pollingEnabled });

  // Load recent reports
  const { data: reportList, isLoading: reportsLoading } = useReportList({ limit: 5 });

  // Handle test creation
  const handleTestCreated = (testId: string) => {
    setCurrentTestId(testId);
    setPollingEnabled(true);
    setTestError(null); // Clear any previous errors
    // 保存到 localStorage
    localStorage.setItem('currentTestId', testId);
  };

  // Monitor test completion
  useEffect(() => {
    if (testStatus) {
      if (testStatus.status === 'completed') {
        setPollingEnabled(false);
        // 清除 localStorage 中的测试ID
        localStorage.removeItem('currentTestId');
        // Get report and navigate to report page
        setTimeout(async () => {
          try {
            const report = await api.getTestReportByRequestId(testStatus.id);
            navigate(`/report/${report.id}`);
          } catch (error) {
            console.error('Failed to get report:', error);
            // Navigate anyway with test request ID (fallback)
            navigate(`/report/${testStatus.id}`);
          }
        }, 1000);
      } else if (testStatus.status === 'failed') {
        setPollingEnabled(false);
        // 清除 localStorage 中的测试ID
        localStorage.removeItem('currentTestId');
        setTestError('测试执行失败。请检查URL是否正确，或稍后重试。');
        console.error('Test failed');
      }
    }
  }, [testStatus, navigate]);

  // 检查并清理已完成或失败的测试
  useEffect(() => {
    const savedTestId = localStorage.getItem('currentTestId');
    if (savedTestId && testStatus) {
      // 如果测试已经完成或失败，但还在 localStorage 中，清除它
      if (testStatus.status === 'completed' || testStatus.status === 'failed') {
        localStorage.removeItem('currentTestId');
        if (testStatus.status === 'completed') {
          // 测试已完成，停止轮询
          setPollingEnabled(false);
          setCurrentTestId(null);
        }
      }
    }
  }, [testStatus]);

  // Get status display
  const getStatusDisplay = (status: string): { text: string; color: string; icon: string } => {
    const displays: Record<string, { text: string; color: string; icon: string }> = {
      pending: { text: '等待中', color: '#6b7280', icon: '⏳' },
      running: { text: '检测中', color: '#2563eb', icon: '🔄' },
      completed: { text: '已完成', color: '#10b981', icon: '✅' },
      failed: { text: '失败', color: '#ef4444', icon: '❌' },
    };
    return displays[status] || { text: status, color: '#6b7280', icon: '❓' };
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  // Get score color class
  const getScoreColorClass = (score: number): string => {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-warning';
    return 'score-poor';
  };

  return (
    <div className="home-page">
      <div className="page-header">
        <h2 className="page-title">Web 自动化巡检</h2>
        <p className="page-description">自动化网页功能与性能检测工具</p>
      </div>

      <main className="home-main">
        {/* Test input section */}
        <section className="test-input-section">
          <TestInput onTestCreated={handleTestCreated} />
        </section>

        {/* Current test status */}
        {testStatus && pollingEnabled && (
          <section className="current-test-section">
            <div className="status-card">
              <div className="status-header">
                <h3>当前检测</h3>
              </div>
              <div className="status-content">
                <div className="status-url">{testStatus.url}</div>
                <div className="status-indicator">
                  <span
                    className="status-icon"
                    style={{ color: getStatusDisplay(testStatus.status).color }}
                  >
                    {getStatusDisplay(testStatus.status).icon}
                  </span>
                  <span
                    className="status-text"
                    style={{ color: getStatusDisplay(testStatus.status).color }}
                  >
                    {getStatusDisplay(testStatus.status).text}
                  </span>
                </div>
                {testStatus.status === 'running' && (
                  <div className="loading-bar">
                    <div className="loading-bar-fill" />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Error message */}
        {testError && (
          <section className="error-section">
            <div className="error-card">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <h3>测试失败</h3>
                <p>{testError}</p>
              </div>
              <button className="error-dismiss" onClick={() => setTestError(null)}>
                ✕
              </button>
            </div>
          </section>
        )}

        {/* Recent reports */}
        <section className="recent-reports-section">
          <div className="section-header">
            <h3>最近的检测报告</h3>
            {reportList && reportList.pagination.total > 5 && (
              <span className="total-reports-hint">
                共 {reportList.pagination.total} 条报告
              </span>
            )}
          </div>

          {reportsLoading && (
            <div className="loading-message">
              <span className="loading-spinner">⏳</span>
              加载中...
            </div>
          )}

          {!reportsLoading && reportList && reportList.reports.length === 0 && (
            <div className="empty-message">
              <span className="empty-icon">📭</span>
              <p>还没有检测报告</p>
              <p className="empty-hint">在上方输入URL开始第一次检测</p>
            </div>
          )}

          {!reportsLoading && reportList && reportList.reports.length > 0 && (
            <div className="reports-list">
              {reportList.reports.map((report) => (
                <div
                  key={report.id}
                  className="report-card"
                  onClick={() => navigate(`/report/${report.id}`)}
                >
                  <div className="report-score">
                    <div className={`score-badge ${getScoreColorClass(report.overallScore)}`}>
                      {report.overallScore}
                    </div>
                  </div>
                  <div className="report-info">
                    <div className="report-url">{report.url}</div>
                    <div className="report-stats">
                      <span className="stat">
                        ✅ {report.passedChecks}/{report.totalChecks}
                      </span>
                      {report.failedChecks > 0 && (
                        <span className="stat stat-fail">❌ {report.failedChecks}</span>
                      )}
                    </div>
                    <div className="report-time">{formatDate(report.completedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
