import React, { useState } from 'react';
import { UITestResult } from '../../services/api';
import './UITestResults.css';

interface UITestResultsProps {
  results: UITestResult[];
}

export function UITestResults({ results }: UITestResultsProps) {
  const [filter, setFilter] = useState<'all' | 'pass' | 'warning' | 'fail'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  // Group results by test type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.testType]) {
      acc[result.testType] = [];
    }
    acc[result.testType].push(result);
    return acc;
  }, {} as Record<string, UITestResult[]>);

  // Calculate statistics for each type
  const getTypeStats = (type: string) => {
    const typeResults = groupedResults[type] || [];
    return {
      total: typeResults.length,
      pass: typeResults.filter((r) => r.status === 'pass').length,
      warning: typeResults.filter((r) => r.status === 'warning').length,
      fail: typeResults.filter((r) => r.status === 'fail').length,
    };
  };

  // Filter results
  const filteredResults = (typeResults: UITestResult[]) => {
    if (filter === 'all') return typeResults;
    if (filter === 'pass') return typeResults.filter((r) => r.status === 'pass');
    // 'warning' and 'fail' are treated together as "failed"
    return typeResults.filter((r) => r.status === 'warning' || r.status === 'fail');
  };

  // Get test type display name
  const getTestTypeName = (type: string): string => {
    const names: Record<string, string> = {
      link: '链接',
      form: '表单',
      button: '按钮',
      image: '图片',
    };
    return names[type] || type;
  };

  // Get test type icon
  const getTestTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      link: '🔗',
      form: '📝',
      button: '🔘',
      image: '🖼️',
    };
    return icons[type] || '📋';
  };

  // Get status icon
  const getStatusIcon = (status: string): string => {
    const icons: Record<string, string> = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌',
    };
    return icons[status] || '❓';
  };

  // Get status class
  const getStatusClass = (status: string): string => {
    return `status-${status}`;
  };

  // Toggle details expansion
  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Toggle test type group collapse
  const toggleTypeCollapse = (type: string) => {
    const newCollapsed = new Set(collapsedTypes);
    if (newCollapsed.has(type)) {
      newCollapsed.delete(type);
    } else {
      newCollapsed.add(type);
    }
    setCollapsedTypes(newCollapsed);
  };

  // Export failed/warning results to CSV
  const exportToCSV = () => {
    const failedResults = results.filter((r) => r.status === 'fail' || r.status === 'warning');

    if (failedResults.length === 0) {
      alert('没有失败或警告的测试结果可导出');
      return;
    }

    // CSV header
    const header = ['测试类型', '元素定位', '状态', '错误信息', '修复建议'].join(',');

    // CSV rows
    const rows = failedResults.map((result) => {
      const testType = getTestTypeName(result.testType);
      const elementId = (result.elementId || '未知元素').replace(/"/g, '""'); // Escape quotes
      const status = result.status === 'fail' ? '失败' : '警告';
      const errorMessage = (result.errorMessage || '').replace(/"/g, '""');
      const recommendation = (result.recommendation || '').replace(/"/g, '""');

      return `"${testType}","${elementId}","${status}","${errorMessage}","${recommendation}"`;
    });

    const csv = [header, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test-failures-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export failed/warning results to JSON
  const exportToJSON = () => {
    const failedResults = results.filter((r) => r.status === 'fail' || r.status === 'warning');

    if (failedResults.length === 0) {
      alert('没有失败或警告的测试结果可导出');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalFailures: failedResults.length,
      results: failedResults.map((result) => ({
        testType: result.testType,
        elementId: result.elementId,
        status: result.status,
        errorMessage: result.errorMessage,
        recommendation: result.recommendation,
        screenshotUrl: result.screenshotUrl,
        diagnostics: result.diagnostics,
      })),
    };

    const json = JSON.stringify(exportData, null, 2);

    // Create blob and download
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test-failures-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (results.length === 0) {
    return (
      <div className="no-results">
        <p>没有UI测试结果</p>
      </div>
    );
  }

  const failedCount = results.filter((r) => r.status === 'fail' || r.status === 'warning').length;

  return (
    <div className="ui-test-results">
      {/* Controls section with filter and export buttons */}
      <div className="controls-section">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 全部 ({results.length})
          </button>
          <button
            className={`filter-btn filter-btn-success ${filter === 'pass' ? 'active' : ''}`}
            onClick={() => setFilter('pass')}
          >
            ✅ 检测正常 ({results.filter((r) => r.status === 'pass').length})
          </button>
          <button
            className={`filter-btn filter-btn-danger ${
              filter === 'warning' || filter === 'fail' ? 'active' : ''
            }`}
            onClick={() => setFilter(filter === 'warning' || filter === 'fail' ? 'all' : 'warning')}
          >
            ❌ 检测失败 ({results.filter((r) => r.status === 'warning' || r.status === 'fail').length})
          </button>
        </div>

        {failedCount > 0 && (
          <div className="export-buttons">
            <button className="export-btn" onClick={exportToCSV} title="导出失败和警告结果到CSV">
              📥 导出CSV
            </button>
            <button className="export-btn" onClick={exportToJSON} title="导出失败和警告结果到JSON">
              📥 导出JSON
            </button>
          </div>
        )}
      </div>

      {/* Results by test type */}
      {Object.keys(groupedResults).map((testType) => {
        const typeResults = filteredResults(groupedResults[testType]);
        if (typeResults.length === 0) return null;

        const stats = getTypeStats(testType);

        const isCollapsed = collapsedTypes.has(testType);

        return (
          <div key={testType} className="test-type-group">
            <div className="test-type-header" onClick={() => toggleTypeCollapse(testType)}>
              <div className="header-left">
                <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                <h4>
                  <span className="type-icon">{getTestTypeIcon(testType)}</span>
                  {getTestTypeName(testType)}测试
                </h4>
              </div>
              <div className="type-stats">
                <span className="stat-pass">{stats.pass}通过</span>
                {stats.warning > 0 && <span className="stat-warning">{stats.warning}警告</span>}
                {stats.fail > 0 && <span className="stat-fail">{stats.fail}失败</span>}
              </div>
            </div>

            {!isCollapsed && <div className="test-results-list">
              {typeResults.map((result) => (
                <div key={result.id} className={`test-result-item ${getStatusClass(result.status)}`}>
                  <div className="result-header" onClick={() => toggleExpanded(result.id)}>
                    <span className="status-icon">{getStatusIcon(result.status)}</span>
                    <div className="element-info">
                      <span className="element-id">{result.elementId || '未知元素'}</span>
                      {result.status !== 'pass' && result.errorMessage && (
                        <span className="error-preview">{result.errorMessage.substring(0, 80)}...</span>
                      )}
                    </div>
                    <span className="expand-icon">{expandedId === result.id ? '▼' : '▶'}</span>
                  </div>

                  {expandedId === result.id && (
                    <div className="result-details">
                      {/* Element information */}
                      <div className="detail-section">
                        <h5>🎯 元素定位</h5>
                        <div className="detail-item">
                          <span className="detail-label">选择器:</span>
                          <code className="element-selector-code">{result.elementId || 'N/A'}</code>
                        </div>
                      </div>

                      {/* Error/Warning message */}
                      {result.errorMessage && (
                        <div className="detail-section error-section">
                          <h5>{result.status === 'warning' ? '⚠️ 警告信息' : '❌ 错误信息'}</h5>
                          <p className="error-message">{result.errorMessage}</p>
                        </div>
                      )}

                      {/* Recommendation */}
                      {result.recommendation && (
                        <div className="detail-section recommendation-section">
                          <h5>💡 修复建议</h5>
                          <p className="recommendation-text">{result.recommendation}</p>
                        </div>
                      )}

                      {/* Screenshot */}
                      {result.screenshotUrl && (
                        <div className="detail-section screenshot-section">
                          <h5>📷 元素截图</h5>
                          <img
                            src={`http://localhost:3000${result.screenshotUrl}`}
                            alt="元素截图"
                            className="result-screenshot"
                            onClick={(e) => {
                              window.open(e.currentTarget.src, '_blank');
                            }}
                          />
                          <p className="screenshot-hint">💡 点击图片查看大图</p>
                        </div>
                      )}

                      {/* Diagnostics */}
                      {result.diagnostics && Object.keys(result.diagnostics).length > 0 && (
                        <div className="detail-section diagnostics-section">
                          <h5>🔧 诊断信息</h5>
                          <pre className="diagnostics-json">{JSON.stringify(result.diagnostics, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>}
          </div>
        );
      })}
    </div>
  );
}
