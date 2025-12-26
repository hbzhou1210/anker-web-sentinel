import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import './SEOChecker.css';

const API_BASE_URL = '/api/v1';

/**
 * Hreflang 链接信息
 */
interface HreflangLink {
  lang: string;
  href: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * SEO 检测报告
 */
interface SEOReport {
  url: string;
  title: string | null;
  hreflangLinks: HreflangLink[];
  article: {
    dateModified: string | null;
    datePublished: string | null;
    author: string | null;
  };
  checkTime: string;
  error?: string;
}

/**
 * SEO 检测页面组件
 */
const SEOChecker: React.FC = () => {
  const [url, setUrl] = useState('');
  const [report, setReport] = useState<SEOReport | null>(null);

  // SEO 检测 Mutation
  const checkSEOMutation = useMutation({
    mutationFn: async (checkUrl: string) => {
      const response = await axios.post(`${API_BASE_URL}/seo-checker/check`, {
        url: checkUrl
      });
      return response.data as SEOReport;
    },
    onSuccess: (data) => {
      setReport(data);
    },
    onError: (error: any) => {
      console.error('SEO 检测失败:', error);
      alert(`检测失败: ${error.response?.data?.message || error.message}`);
    }
  });

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      alert('请输入要检测的URL');
      return;
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      alert('请输入有效的URL格式 (例如: https://example.com)');
      return;
    }

    checkSEOMutation.mutate(url.trim());
  };

  // 格式化日期
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="seo-checker-container">
      <div className="page-header">
        <h1>🔍 SEO 检测工具</h1>
        <p className="page-description">
          检测网页的 SEO 信息，包括 Hreflang 链接、文章元数据等
        </p>
      </div>

      {/* 输入表单 */}
      <div className="check-form-card">
        <form onSubmit={handleSubmit} className="check-form">
          <div className="form-group">
            <label htmlFor="url">输入要检测的网页URL</label>
            <div className="input-button-group">
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="url-input"
                disabled={checkSEOMutation.isPending}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={checkSEOMutation.isPending || !url.trim()}
              >
                {checkSEOMutation.isPending ? (
                  <>
                    <span className="spinner"></span>
                    检测中...
                  </>
                ) : (
                  '开始检测'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 检测结果 */}
      {report && (
        <div className="results-section">
          {/* 错误提示 */}
          {report.error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span>检测出错: {report.error}</span>
            </div>
          )}

          {/* 基本信息 */}
          <div className="info-card">
            <h2>📄 基本信息</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">检测URL:</span>
                <span className="info-value">
                  <a href={report.url} target="_blank" rel="noopener noreferrer">
                    {report.url}
                  </a>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">页面标题:</span>
                <span className="info-value">{report.title || '-'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">检测时间:</span>
                <span className="info-value">{formatDate(report.checkTime)}</span>
              </div>
            </div>
          </div>

          {/* Article 信息 */}
          <div className="info-card">
            <h2>📝 文章信息 (Article Metadata)</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">作者 (Author):</span>
                <span className="info-value">{report.article.author || '-'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">发布时间 (datePublished):</span>
                <span className="info-value">{formatDate(report.article.datePublished)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">修改时间 (dateModified):</span>
                <span className="info-value">{formatDate(report.article.dateModified)}</span>
              </div>
            </div>
          </div>

          {/* Hreflang 链接 */}
          <div className="info-card">
            <h2>🌐 Hreflang 链接</h2>
            {report.hreflangLinks.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <p>未找到 Hreflang 链接</p>
                <p className="empty-hint">该页面没有配置多语言链接</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="hreflang-table">
                  <thead>
                    <tr>
                      <th>语言代码 (Lang)</th>
                      <th>链接地址 (Href)</th>
                      <th>状态码</th>
                      <th>有效性</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.hreflangLinks.map((link, index) => (
                      <tr key={index} className={link.isValid ? 'valid' : 'invalid'}>
                        <td>
                          <code className="lang-code">{link.lang}</code>
                        </td>
                        <td className="link-cell">
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-url"
                          >
                            {link.href}
                          </a>
                        </td>
                        <td>
                          {link.statusCode ? (
                            <span className={`status-code status-${Math.floor(link.statusCode / 100)}`}>
                              {link.statusCode}
                            </span>
                          ) : (
                            <span className="status-code status-error">-</span>
                          )}
                        </td>
                        <td>
                          {link.isValid ? (
                            <span className="status-badge status-valid">✓ 有效</span>
                          ) : (
                            <span className="status-badge status-invalid">
                              ✗ 无效
                              {link.error && (
                                <span className="error-tooltip" title={link.error}>
                                  ⓘ
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 统计信息 */}
            {report.hreflangLinks.length > 0 && (
              <div className="stats-bar">
                <span className="stat-item">
                  总计: <strong>{report.hreflangLinks.length}</strong> 个链接
                </span>
                <span className="stat-item stat-valid">
                  有效: <strong>{report.hreflangLinks.filter(l => l.isValid).length}</strong>
                </span>
                <span className="stat-item stat-invalid">
                  无效: <strong>{report.hreflangLinks.filter(l => !l.isValid).length}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SEOChecker;
