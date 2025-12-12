import React, { useState, useEffect } from 'react';
import './DiscountRuleQuery.css';

interface Report {
  filename: string;
  url: string;
  type: 'single' | 'batch';
  createdAt: string;
  size: number;
}

/**
 * 买赠规则查询页面
 * 嵌入 function买赠规则查询工具
 */
export const DiscountRuleQuery: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 6; // 每页显示6条报告

  // 加载历史报告
  useEffect(() => {
    loadReports();
    // 每10秒刷新一次报告列表
    const interval = setInterval(loadReports, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/v1/discount-rule/reports');
      const data = await response.json();
      if (data.success) {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('加载报告列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 计算分页数据
  const totalPages = Math.ceil(reports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const endIndex = startIndex + reportsPerPage;
  const currentReports = reports.slice(startIndex, endIndex);

  // 切换页码
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 滚动到历史报告部分
    document.querySelector('.history-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="discount-rule-query-page">
      <div className="page-header">
        <h1>🎁 买赠规则查询</h1>
        <p className="page-description">查询 Shopify Function 买赠折扣规则的生效状态</p>
      </div>

      <div className="tool-container">
        <iframe
          src="/discount-rule-tool/index.html"
          title="买赠规则查询工具"
          className="tool-iframe"
          frameBorder="0"
        />
      </div>

      <div className="history-section">
        <div className="section-header">
          <h3>📊 历史查询报告</h3>
          {reports.length > 0 && (
            <span className="total-reports-hint">共 {reports.length} 条报告</span>
          )}
        </div>

        {loading && (
          <div className="loading-message">
            <span className="loading-spinner">⏳</span>
            加载中...
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="empty-message">
            <span className="empty-icon">📭</span>
            <p>还没有查询报告</p>
            <p className="empty-hint">在上方输入 Rule ID 开始第一次查询</p>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <>
            <div className="reports-list">
              {currentReports.map((report) => (
                <div
                  key={report.filename}
                  className="report-card"
                  onClick={() => window.open(report.url, '_blank')}
                >
                  <div className="report-icon">
                    {report.type === 'batch' ? '📊' : '📄'}
                  </div>
                  <div className="report-info">
                    <div className="report-name">
                      {report.type === 'batch' ? '批量查询报告' : '单规则查询报告'}
                    </div>
                    <div className="report-meta">
                      <span className="meta-item">⏰ {formatDate(report.createdAt)}</span>
                      <span className="meta-item">📦 {formatSize(report.size)}</span>
                    </div>
                  </div>
                  <div className="report-action">查看 →</div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ← 上一页
                </button>

                <div className="pagination-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  下一页 →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DiscountRuleQuery;
