import React from 'react';
import { PageSpeedInsightsData } from '../../services/api';
import './PageSpeedOverview.css';

interface PageSpeedOverviewMinimalProps {
  data: PageSpeedInsightsData;
}

/**
 * 极简版 PageSpeed Overview - 仅展示 LCP 指标
 * 用于测试报告中,避免内容过长
 */
export function PageSpeedOverviewMinimal({ data }: PageSpeedOverviewMinimalProps) {
  // 格式化时间(毫秒转秒)
  const formatTime = (ms: number): string => {
    return (ms / 1000).toFixed(2) + 's';
  };

  // 获取 LCP 状态
  const getLCPStatus = (value: number): { class: string; icon: string; text: string } => {
    if (value <= 2500) {
      return { class: 'metric-good', icon: '✓', text: '优秀' };
    }
    if (value <= 4000) {
      return { class: 'metric-needs-improvement', icon: '⚠', text: '需要改进' };
    }
    return { class: 'metric-poor', icon: '✗', text: '较差' };
  };

  const lcpValue = data.metrics.largestContentfulPaint;
  const lcpStatus = getLCPStatus(lcpValue);

  return (
    <div className="pagespeed-overview-minimal">
      {/* LCP 核心指标 - 极简展示 */}
      <div className="lcp-minimal-card">
        <div className="lcp-minimal-header">
          <div className="lcp-minimal-icon">⚡</div>
          <div className="lcp-minimal-info">
            <h4 className="lcp-minimal-title">LCP - 最大内容绘制</h4>
            <p className="lcp-minimal-desc">核心性能指标,衡量页面主要内容的加载速度</p>
          </div>
        </div>

        <div className="lcp-minimal-value-section">
          <div className={`lcp-minimal-value ${lcpStatus.class}`}>
            {formatTime(lcpValue)}
          </div>
          <div className={`lcp-minimal-status ${lcpStatus.class}`}>
            <span className="status-icon">{lcpStatus.icon}</span>
            <span className="status-text">{lcpStatus.text}</span>
          </div>
        </div>

        <div className="lcp-minimal-target">
          目标: &lt; 2.5s (优秀) | &lt; 4.0s (良好)
        </div>
      </div>

      {/* 性能分数 - 小字显示 */}
      <div className="performance-score-minimal">
        <span className="score-label-minimal">PageSpeed 性能分数:</span>
        <span className={`score-value-minimal ${
          data.performanceScore >= 90 ? 'score-good' :
          data.performanceScore >= 50 ? 'score-needs-improvement' :
          'score-poor'
        }`}>
          {data.performanceScore}
        </span>
      </div>

      {/* 其他指标 - 极简展示 */}
      <details className="other-metrics-minimal">
        <summary className="metrics-summary">
          <span className="summary-icon">▶</span>
          <span className="summary-text">其他性能指标</span>
          <span className="metrics-count-badge">5 项</span>
        </summary>

        <div className="metrics-list-minimal">
          <div className="metric-item-minimal">
            <span className="metric-name">FCP (首次内容绘制)</span>
            <span className="metric-value">{formatTime(data.metrics.firstContentfulPaint)}</span>
          </div>
          <div className="metric-item-minimal">
            <span className="metric-name">TBT (总阻塞时间)</span>
            <span className="metric-value">{data.metrics.totalBlockingTime}ms</span>
          </div>
          <div className="metric-item-minimal">
            <span className="metric-name">CLS (累积布局偏移)</span>
            <span className="metric-value">{data.metrics.cumulativeLayoutShift.toFixed(3)}</span>
          </div>
          <div className="metric-item-minimal">
            <span className="metric-name">SI (速度指数)</span>
            <span className="metric-value">{formatTime(data.metrics.speedIndex)}</span>
          </div>
          <div className="metric-item-minimal">
            <span className="metric-name">TTI (可交互时间)</span>
            <span className="metric-value">{formatTime(data.metrics.timeToInteractive)}</span>
          </div>
        </div>
      </details>

      {/* 优化建议 - 仅显示数量 */}
      {data.opportunities && data.opportunities.length > 0 && (
        <div className="opportunities-minimal">
          <span className="opportunities-icon">💡</span>
          <span className="opportunities-text">
            发现 {data.opportunities.length} 项性能优化建议
          </span>
        </div>
      )}
    </div>
  );
}
