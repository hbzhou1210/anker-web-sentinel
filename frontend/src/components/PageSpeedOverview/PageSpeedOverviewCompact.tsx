import React, { useState } from 'react';
import { PageSpeedInsightsData } from '../../services/api';
import './PageSpeedOverview.css';

interface PageSpeedOverviewCompactProps {
  data: PageSpeedInsightsData;
}

/**
 * 精简版 PageSpeed Overview - 强调 LCP,弱化其他指标
 */
export function PageSpeedOverviewCompact({ data }: PageSpeedOverviewCompactProps) {
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  // 格式化时间(毫秒转秒)
  const formatTime = (ms: number): string => {
    return (ms / 1000).toFixed(2) + 's';
  };

  // 格式化 CLS 分数
  const formatCLS = (score: number): string => {
    return score.toFixed(3);
  };

  // 获取性能分数的颜色类名
  const getScoreClass = (score: number): string => {
    if (score >= 90) return 'score-good';
    if (score >= 50) return 'score-needs-improvement';
    return 'score-poor';
  };

  // 获取指标颜色类名(基于 Web Vitals 标准)
  const getMetricClass = (metricName: string, value: number): string => {
    const thresholds: Record<string, { good: number; needs: number }> = {
      fcp: { good: 1800, needs: 3000 },
      lcp: { good: 2500, needs: 4000 },
      tbt: { good: 200, needs: 600 },
      cls: { good: 0.1, needs: 0.25 },
      speedIndex: { good: 3400, needs: 5800 },
      tti: { good: 3800, needs: 7300 },
    };

    const threshold = thresholds[metricName];
    if (!threshold) return 'metric-neutral';

    if (value <= threshold.good) return 'metric-good';
    if (value <= threshold.needs) return 'metric-needs-improvement';
    return 'metric-poor';
  };

  return (
    <div className="pagespeed-overview pagespeed-overview-compact">
      {/* Header with Performance Score */}
      <div className="pagespeed-header">
        <div className="header-content">
          <h3>🚀 PageSpeed Insights 性能分析</h3>
          <p className="header-subtitle">基于 Google Lighthouse 的性能测试结果</p>
        </div>
        <div className={`performance-score-badge ${getScoreClass(data.performanceScore)}`}>
          <div className="score-value">{data.performanceScore}</div>
          <div className="score-label">性能分数</div>
        </div>
      </div>

      {/* Core LCP Metric - Highlighted */}
      <div className="lcp-primary-section">
        <div className="lcp-primary-card">
          <div className="lcp-primary-header">
            <span className="lcp-primary-icon">⚡</span>
            <div className="lcp-primary-info">
              <h4>LCP - 最大内容绘制</h4>
              <p className="lcp-primary-desc">衡量页面加载性能的关键指标</p>
            </div>
          </div>
          <div className="lcp-primary-content">
            <div className={`lcp-primary-value ${getMetricClass('lcp', data.metrics.largestContentfulPaint)}`}>
              {formatTime(data.metrics.largestContentfulPaint)}
            </div>
            <div className="lcp-primary-target">
              <span className="target-label">目标值:</span>
              <span className="target-value">&lt; 2.5s</span>
            </div>
            <div className="lcp-primary-status">
              {data.metrics.largestContentfulPaint <= 2500 && (
                <span className="status-badge status-good">✓ 优秀</span>
              )}
              {data.metrics.largestContentfulPaint > 2500 && data.metrics.largestContentfulPaint <= 4000 && (
                <span className="status-badge status-needs-improvement">⚠ 需要改进</span>
              )}
              {data.metrics.largestContentfulPaint > 4000 && (
                <span className="status-badge status-poor">✗ 较差</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Other Metrics - Collapsed by default */}
      <div className="other-metrics-section">
        <button
          className="metrics-toggle-button"
          onClick={() => setShowAllMetrics(!showAllMetrics)}
        >
          <span className="toggle-icon">{showAllMetrics ? '▼' : '▶'}</span>
          <span className="toggle-text">
            {showAllMetrics ? '收起其他性能指标' : '查看其他性能指标'}
          </span>
          <span className="metrics-count">5 项</span>
        </button>

        {showAllMetrics && (
          <div className="metrics-grid-compact">
            {/* First Contentful Paint */}
            <div className="metric-card-compact">
              <div className="metric-name-compact">FCP</div>
              <div className={`metric-value-compact ${getMetricClass('fcp', data.metrics.firstContentfulPaint)}`}>
                {formatTime(data.metrics.firstContentfulPaint)}
              </div>
              <div className="metric-label-compact">首次内容绘制</div>
            </div>

            {/* Total Blocking Time */}
            <div className="metric-card-compact">
              <div className="metric-name-compact">TBT</div>
              <div className={`metric-value-compact ${getMetricClass('tbt', data.metrics.totalBlockingTime)}`}>
                {Math.round(data.metrics.totalBlockingTime)}ms
              </div>
              <div className="metric-label-compact">总阻塞时间</div>
            </div>

            {/* Cumulative Layout Shift */}
            <div className="metric-card-compact">
              <div className="metric-name-compact">CLS</div>
              <div className={`metric-value-compact ${getMetricClass('cls', data.metrics.cumulativeLayoutShift)}`}>
                {formatCLS(data.metrics.cumulativeLayoutShift)}
              </div>
              <div className="metric-label-compact">累积布局偏移</div>
            </div>

            {/* Speed Index */}
            <div className="metric-card-compact">
              <div className="metric-name-compact">SI</div>
              <div className={`metric-value-compact ${getMetricClass('speedIndex', data.metrics.speedIndex)}`}>
                {formatTime(data.metrics.speedIndex)}
              </div>
              <div className="metric-label-compact">速度指数</div>
            </div>

            {/* Time to Interactive */}
            <div className="metric-card-compact">
              <div className="metric-name-compact">TTI</div>
              <div className={`metric-value-compact ${getMetricClass('tti', data.metrics.timeToInteractive)}`}>
                {formatTime(data.metrics.timeToInteractive)}
              </div>
              <div className="metric-label-compact">可交互时间</div>
            </div>
          </div>
        )}
      </div>

      {/* Opportunities - Only show top 3 */}
      {data.opportunities && data.opportunities.length > 0 && (
        <div className="opportunities-section-compact">
          <h4 className="section-title-compact">💡 优化建议 (前3项)</h4>
          <div className="opportunities-list-compact">
            {data.opportunities.slice(0, 3).map((opportunity, index) => (
              <div key={index} className="opportunity-item-compact">
                <div className="opportunity-header-compact">
                  <span className="opportunity-title-compact">{opportunity.title}</span>
                  {opportunity.savings > 0 && (
                    <span className="opportunity-savings-compact">
                      节省 {formatTime(opportunity.savings)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.opportunities.length > 3 && (
            <div className="more-opportunities-hint">
              还有 {data.opportunities.length - 3} 项优化建议...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
