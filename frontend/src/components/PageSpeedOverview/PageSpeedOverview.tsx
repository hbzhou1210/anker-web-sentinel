import React from 'react';
import { PageSpeedInsightsData } from '../../services/api';
import './PageSpeedOverview.css';

interface PageSpeedOverviewProps {
  data: PageSpeedInsightsData;
}

export function PageSpeedOverview({ data }: PageSpeedOverviewProps) {
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
    <div className="pagespeed-overview">
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

      {/* Core Web Vitals Metrics */}
      <div className="metrics-section">
        <h4 className="section-title">📊 核心性能指标</h4>
        <div className="metrics-grid">
          {/* First Contentful Paint */}
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-name">First Contentful Paint</span>
              <span className={`metric-badge ${getMetricClass('fcp', data.metrics.firstContentfulPaint)}`}>
                {formatTime(data.metrics.firstContentfulPaint)}
              </span>
            </div>
            <div className="metric-description">首次内容绘制时间</div>
            <div className="metric-threshold">目标: &lt; 1.8s</div>
          </div>

          {/* Largest Contentful Paint */}
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-name">Largest Contentful Paint</span>
              <span className={`metric-badge ${getMetricClass('lcp', data.metrics.largestContentfulPaint)}`}>
                {formatTime(data.metrics.largestContentfulPaint)}
              </span>
            </div>
            <div className="metric-description">最大内容绘制时间</div>
            <div className="metric-threshold">目标: &lt; 2.5s</div>
          </div>

          {/* Total Blocking Time */}
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-name">Total Blocking Time</span>
              <span className={`metric-badge ${getMetricClass('tbt', data.metrics.totalBlockingTime)}`}>
                {formatTime(data.metrics.totalBlockingTime)}
              </span>
            </div>
            <div className="metric-description">总阻塞时间</div>
            <div className="metric-threshold">目标: &lt; 200ms</div>
          </div>

          {/* Cumulative Layout Shift */}
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-name">Cumulative Layout Shift</span>
              <span className={`metric-badge ${getMetricClass('cls', data.metrics.cumulativeLayoutShift)}`}>
                {formatCLS(data.metrics.cumulativeLayoutShift)}
              </span>
            </div>
            <div className="metric-description">累积布局偏移</div>
            <div className="metric-threshold">目标: &lt; 0.1</div>
          </div>

          {/* Speed Index */}
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-name">Speed Index</span>
              <span className={`metric-badge ${getMetricClass('speedIndex', data.metrics.speedIndex)}`}>
                {formatTime(data.metrics.speedIndex)}
              </span>
            </div>
            <div className="metric-description">速度指数</div>
            <div className="metric-threshold">目标: &lt; 3.4s</div>
          </div>

          {/* Time to Interactive */}
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-name">Time to Interactive</span>
              <span className={`metric-badge ${getMetricClass('tti', data.metrics.timeToInteractive)}`}>
                {formatTime(data.metrics.timeToInteractive)}
              </span>
            </div>
            <div className="metric-description">可交互时间</div>
            <div className="metric-threshold">目标: &lt; 3.8s</div>
          </div>
        </div>
      </div>

      {/* Opportunities */}
      {data.opportunities && data.opportunities.length > 0 && (
        <div className="opportunities-section">
          <h4 className="section-title">💡 优化建议</h4>
          <div className="opportunities-list">
            {data.opportunities.map((opportunity, index) => (
              <div key={index} className="opportunity-item">
                <div className="opportunity-header">
                  <span className="opportunity-title">{opportunity.title}</span>
                  {opportunity.savings > 0 && (
                    <span className="opportunity-savings">
                      可节省 {formatTime(opportunity.savings)}
                    </span>
                  )}
                </div>
                <div className="opportunity-description">{opportunity.description}</div>
                <div className="opportunity-score">
                  <div className="score-bar">
                    <div
                      className="score-fill"
                      style={{ width: `${opportunity.score}%` }}
                    />
                  </div>
                  <span className="score-text">{opportunity.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {data.diagnostics && data.diagnostics.length > 0 && (
        <div className="diagnostics-section">
          <h4 className="section-title">🔍 诊断信息</h4>
          <div className="diagnostics-list">
            {data.diagnostics.map((diagnostic, index) => (
              <div key={index} className="diagnostic-item">
                <div className="diagnostic-header">
                  <span className="diagnostic-title">{diagnostic.title}</span>
                  <span className={`diagnostic-score ${getScoreClass(diagnostic.score)}`}>
                    {diagnostic.score}/100
                  </span>
                </div>
                <div className="diagnostic-description">{diagnostic.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="pagespeed-legend">
        <div className="legend-note">
          💡 颜色编码基于 Google Core Web Vitals 标准
        </div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot good"></span>
            <span>Good (良好)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot needs-improvement"></span>
            <span>Needs Improvement (需要改进)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot poor"></span>
            <span>Poor (较差)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
