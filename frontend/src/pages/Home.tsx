import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TestInput } from '../components/TestInput/TestInput';
import { TestReport } from '../components/TestReport/TestReport';
import { useTestStatus, useReportList } from '../services/queries';
import api, { TestReport as TestReportType } from '../services/api';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const [currentTestId, setCurrentTestId] = useState<string | null>(() => {
    // 从 localStorage 恢复正在进行的测试
    return localStorage.getItem('currentTestId');
  });
  const [pollingEnabled, setPollingEnabled] = useState(() => {
    // 如果有保存的测试ID,启用轮询
    return !!localStorage.getItem('currentTestId');
  });
  const [testError, setTestError] = useState<string | null>(null);
  const [completedReport, setCompletedReport] = useState<TestReportType | null>(null);

  // Poll current test status
  const { data: testStatus, error: testStatusError } = useTestStatus(currentTestId, {
    enabled: pollingEnabled,
  });

  // Load recent reports
  const { data: reportList, isLoading: reportsLoading } = useReportList({ limit: 5 });

  // Handle test creation
  const handleTestCreated = (testId: string) => {
    setCurrentTestId(testId);
    setPollingEnabled(true);
    setTestError(null); // Clear any previous errors
    setCompletedReport(null); // Clear any previous report
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
        // Get report and display it on current page
        (async () => {
          try {
            const report = await api.getTestReportByRequestId(testStatus.id);
            setCompletedReport(report);
            // 滚动到报告区域
            setTimeout(() => {
              const reportElement = document.querySelector('.completed-report-section');
              if (reportElement) {
                reportElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 100);
          } catch (error) {
            console.error('Failed to get report:', error);
            setTestError('获取检测报告失败,请稍后重试。');
          }
        })();
      } else if (testStatus.status === 'failed') {
        setPollingEnabled(false);
        // 清除 localStorage 中的测试ID
        localStorage.removeItem('currentTestId');
        setTestError('测试执行失败。请检查URL是否正确,或稍后重试。');
        console.error('Test failed');
      }
    }
  }, [testStatus]);

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

  // 处理 404 错误: 测试ID不存在(后端重启导致内存数据丢失)
  useEffect(() => {
    if (testStatusError && (testStatusError as any)?.response?.status === 404) {
      console.warn('[Home] Test ID not found (404), clearing invalid test ID');
      // 停止轮询
      setPollingEnabled(false);
      // 清除无效的测试ID
      setCurrentTestId(null);
      localStorage.removeItem('currentTestId');
      // 显示友好的错误提示
      setTestError('检测任务已过期或服务已重启。请重新提交检测任务。');
    }
  }, [testStatusError]);

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
        <h2 className="page-title">网页质量检测</h2>
        <p className="page-description">一键检测网页功能、性能与响应式表现</p>
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

        {/* Completed test report */}
        {completedReport && (
          <section className="completed-report-section">
            <div className="section-header">
              <h3>✅ 检测完成</h3>
              <div className="report-actions">
                <button
                  className="view-detail-btn"
                  onClick={() => navigate(`/report/${completedReport.id}`)}
                >
                  查看完整报告
                </button>
                <button
                  className="new-test-btn"
                  onClick={() => {
                    setCompletedReport(null);
                    setCurrentTestId(null);
                  }}
                >
                  开始新检测
                </button>
              </div>
            </div>
            <TestReport report={completedReport} />
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
