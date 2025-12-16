import React, { useState, useEffect } from 'react';
import './DiscountRuleQuery.css';

interface Report {
  filename: string;
  url: string;
  type: 'single' | 'batch';
  createdAt: string;
  size: number;
}

interface QueryResult {
  success: boolean;
  type: 'single' | 'batch';
  reportUrl: string;
  summary: any;
}

/**
 * 买赠规则查询页面
 * 完全集成的前端页面,无需iframe
 */
export const DiscountRuleQuery: React.FC = () => {
  // 表单状态
  const [ruleIds, setRuleIds] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');

  // 历史报告状态
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 6;

  // 加载历史报告
  useEffect(() => {
    loadReports();
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
      setReportsLoading(false);
    }
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // 验证输入
    if (!ruleIds.trim()) {
      setError('请输入规则 ID');
      return;
    }

    if (!shopDomain.trim()) {
      setError('请输入店铺域名');
      return;
    }

    // 解析规则ID(支持逗号分隔的多个ID)
    const ids = ruleIds.split(',').map(id => {
      const trimmed = id.trim();
      const num = parseInt(trimmed, 10);
      if (isNaN(num)) {
        throw new Error(`无效的规则 ID: ${trimmed}`);
      }
      return num;
    });

    setLoading(true);

    try {
      const response = await fetch('/api/v1/discount-rule/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ruleIds: ids,
          shopDomain: shopDomain.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '查询失败');
      }

      if (data.success) {
        setResult(data);
        // 刷新历史报告列表
        loadReports();
      } else {
        throw new Error(data.error || '查询失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    setRuleIds('');
    setShopDomain('');
    setResult(null);
    setError('');
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
    document.querySelector('.history-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="discount-rule-query-page">
      <div className="page-header">
        <h1>🎁 买赠规则查询</h1>
        <p className="page-description">查询 Shopify Function 买赠折扣规则的生效状态</p>
      </div>

      {/* 查询表单 */}
      <div className="query-form-container">
        <div className="form-card">
          <div className="form-header">
            <h2>
              <span className="form-icon">🔍</span>
              单个规则查询
            </h2>
            <p className="form-hint">💡 提示: 请输入完整的 Shopify Function Rule ID 和店铺域名</p>
          </div>

          <form onSubmit={handleSubmit} className="query-form">
            <div className="form-group">
              <label htmlFor="ruleIds">
                规则 ID <span className="required">*</span>
              </label>
              <input
                id="ruleIds"
                type="text"
                value={ruleIds}
                onChange={(e) => setRuleIds(e.target.value)}
                placeholder="例如: 12345678 (支持多个ID用逗号分隔)"
                className="form-input"
                disabled={loading}
                required
              />
              <span className="input-hint">支持单个或多个规则ID,多个ID用逗号分隔</span>
            </div>

            <div className="form-group">
              <label htmlFor="shopDomain">
                店铺域名 <span className="required">*</span>
              </label>
              <input
                id="shopDomain"
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="例如: myshop.myshopify.com"
                className="form-input"
                disabled={loading}
                required
              />
              <span className="input-hint">完整的 Shopify 店铺域名</span>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !ruleIds.trim() || !shopDomain.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    查询中...
                  </>
                ) : (
                  '开始查询'
                )}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                disabled={loading}
              >
                重置
              </button>
            </div>
          </form>

          {/* 查询结果 */}
          {error && (
            <div className="result-message error">
              <span className="result-icon">❌</span>
              <div className="result-content">
                <h3>查询失败</h3>
                <p>{error}</p>
              </div>
            </div>
          )}

          {result && result.success && (
            <div className="result-message success">
              <span className="result-icon">✅</span>
              <div className="result-content">
                <h3>查询成功</h3>
                <p>
                  {result.type === 'batch' ? '批量查询' : '单规则查询'}已完成
                  {result.summary && (
                    <span className="summary-text">
                      {result.type === 'single'
                        ? ` - 规则状态: ${result.summary.status === 'active' ? '✅ 生效中' : '❌ 未生效'}`
                        : ` - 总规则数: ${result.summary.totalRules}, 生效: ${result.summary.activeRules}`
                      }
                    </span>
                  )}
                </p>
                <a
                  href={result.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-report-link"
                >
                  查看详细报告 →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 历史报告列表 */}
      <div className="history-section">
        <div className="section-header">
          <h3>📊 历史查询报告</h3>
          {reports.length > 0 && (
            <span className="total-reports-hint">共 {reports.length} 条报告</span>
          )}
        </div>

        {reportsLoading && (
          <div className="loading-message">
            <span className="loading-spinner">⏳</span>
            加载中...
          </div>
        )}

        {!reportsLoading && reports.length === 0 && (
          <div className="empty-message">
            <span className="empty-icon">📭</span>
            <p>还没有查询报告</p>
            <p className="empty-hint">在上方输入 Rule ID 开始第一次查询</p>
          </div>
        )}

        {!reportsLoading && reports.length > 0 && (
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
