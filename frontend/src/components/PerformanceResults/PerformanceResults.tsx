import React, { useState } from 'react';
import { PerformanceResult } from '../../services/api';
import './PerformanceResults.css';

interface PerformanceResultsProps {
  results: PerformanceResult[];
}

export function PerformanceResults({ results }: PerformanceResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Get metric display name
  const getMetricName = (metric: string): string => {
    const names: Record<string, string> = {
      loadTime: '页面加载时间',
      resourceSize: '资源大小',
      responseTime: '服务器响应时间',
      renderTime: '首次内容渲染',
    };
    return names[metric] || metric;
  };

  // Get metric icon
  const getMetricIcon = (metric: string): string => {
    const icons: Record<string, string> = {
      loadTime: '⏱️',
      resourceSize: '📦',
      responseTime: '🚀',
      renderTime: '🎨',
    };
    return icons[metric] || '📊';
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

  // Format value based on unit
  const formatValue = (value: number, unit: string): string => {
    switch (unit) {
      case 'milliseconds':
        if (value < 1000) return `${Math.round(value)}ms`;
        return `${(value / 1000).toFixed(2)}s`;
      case 'bytes':
        if (value < 1024) return `${value}B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)}KB`;
        return `${(value / (1024 * 1024)).toFixed(2)}MB`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  // Calculate percentage over threshold
  const getThresholdPercentage = (value: number, threshold: number): number => {
    return ((value / threshold) * 100);
  };

  // Toggle details expansion
  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (results.length === 0) {
    return (
      <div className="no-results">
        <p>没有性能测试结果</p>
      </div>
    );
  }

  return (
    <div className="performance-results">
      {results.map((result) => {
        const thresholdPct = getThresholdPercentage(result.measuredValue, result.threshold);
        const isOverThreshold = thresholdPct > 100;

        return (
          <div key={result.id} className={`performance-item ${getStatusClass(result.status)}`}>
            <div className="performance-header">
              <div className="metric-info">
                <span className="metric-icon">{getMetricIcon(result.metricName)}</span>
                <div className="metric-text">
                  <div className="metric-name">{getMetricName(result.metricName)}</div>
                  <div className="metric-value">
                    {formatValue(result.measuredValue, result.unit)}
                  </div>
                </div>
              </div>
              <div className="status-info">
                <span className="status-icon">{getStatusIcon(result.status)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="progress-container">
              <div className="progress-labels">
                <span className="label-current">实际值</span>
                <span className="label-threshold">阈值: {formatValue(result.threshold, result.unit)}</span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${getStatusClass(result.status)}`}
                  style={{ width: `${Math.min(thresholdPct, 100)}%` }}
                />
                {isOverThreshold && (
                  <div className="progress-overflow" style={{ left: '100%' }}>
                    +{(thresholdPct - 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            {result.details && (
              <>
                <button
                  className="details-toggle"
                  onClick={() => toggleExpanded(result.id)}
                >
                  {expandedId === result.id ? '▼ 隐藏详情' : '▶ 查看详情'}
                </button>

                {expandedId === result.id && (
                  <div className="performance-details">
                    {/* Failure analysis section */}
                    {(result.details.cause || result.details.recommendation) && (
                      <div className="failure-analysis">
                        <h5>性能分析</h5>
                        {result.details.cause && (
                          <div className="analysis-item">
                            <strong>原因:</strong>
                            <p>{result.details.cause}</p>
                          </div>
                        )}
                        {result.details.recommendation && (
                          <div className="analysis-item">
                            <strong>优化建议:</strong>
                            <p className="recommendation">{result.details.recommendation}</p>
                          </div>
                        )}
                        {(result.details.severity || result.details.fixComplexity) && (
                          <div className="analysis-meta">
                            {result.details.severity && (
                              <span className={`severity-badge severity-${result.details.severity}`}>
                                严重程度: {result.details.severity === 'high' ? '高' : result.details.severity === 'medium' ? '中' : '低'}
                              </span>
                            )}
                            {result.details.fixComplexity && (
                              <span className={`complexity-badge complexity-${result.details.fixComplexity}`}>
                                优化复杂度: {result.details.fixComplexity === 'hard' ? '困难' : result.details.fixComplexity === 'medium' ? '中等' : '简单'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {result.details.largestResources && (
                      <div className="largest-resources">
                        <h5>最大资源文件 (前5):</h5>
                        <div className="resources-list">
                          {result.details.largestResources.map((resource: any) => (
                            <div key={resource.rank} className="resource-item">
                              <span className="resource-rank">#{resource.rank}</span>
                              <span className="resource-size">{resource.sizeKB}KB</span>
                              <span className="resource-url">{resource.url}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
