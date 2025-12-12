import React from 'react';
import { WebPageTestData } from '../../services/api';
import './WebPageTestOverview.css';

interface WebPageTestOverviewProps {
  data: WebPageTestData;
}

export function WebPageTestOverview({ data }: WebPageTestOverviewProps) {
  // 格式化时间(秒,保留3位小数)
  const formatTime = (ms: number): string => {
    return (ms / 1000).toFixed(3) + 's';
  };

  // 格式化 CLS 分数
  const formatCLS = (score: number): string => {
    return score.toFixed(3);
  };

  // 格式化字节大小
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 获取指标颜色类名(基于 Web Vitals 标准)
  const getMetricClass = (metricName: string, value: number): string => {
    const thresholds: Record<string, { good: number; needs: number }> = {
      TTFB: { good: 800, needs: 1800 },
      startRender: { good: 1000, needs: 2000 },
      firstContentfulPaint: { good: 1800, needs: 3000 },
      speedIndex: { good: 3400, needs: 5800 },
      largestContentfulPaint: { good: 2500, needs: 4000 },
      cumulativeLayoutShift: { good: 0.1, needs: 0.25 },
      totalBlockingTime: { good: 200, needs: 600 },
      fullyLoaded: { good: 5000, needs: 10000 },
    };

    const threshold = thresholds[metricName];
    if (!threshold) return 'metric-neutral';

    if (value <= threshold.good) return 'metric-good';
    if (value <= threshold.needs) return 'metric-needs-improvement';
    return 'metric-poor';
  };

  const { metrics, resources } = data;

  return (
    <div className="webpagetest-overview">
      {/* Filmstrip View - 视频帧 */}
      {data.videoFrames && data.videoFrames.length > 0 && (
        <div className="filmstrip-section">
          <div className="section-header">
            <h4>🎬 页面加载过程 (Filmstrip View)</h4>
            <p className="section-subtitle">
              真实浏览器加载过程的视觉呈现,每帧显示页面在不同时间点的渲染状态
            </p>
          </div>
          <div className="filmstrip-container">
            {data.videoFrames.slice(0, 10).map((frame, index) => (
              <div key={index} className="filmstrip-frame">
                <div className="frame-time">{formatTime(frame.time)}</div>
                <div className="frame-image-wrapper">
                  <img
                    src={frame.image}
                    alt={`Frame at ${formatTime(frame.time)}`}
                    className="frame-image"
                    loading="lazy"
                    onClick={() => window.open(frame.image, '_blank')}
                  />
                </div>
                <div className="frame-progress">
                  {frame.visuallyComplete}% 可见
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 核心性能指标 */}
      <div className="metrics-section">
        <div className="section-header">
          <h4>⚡ 核心性能指标</h4>
          <p className="section-subtitle">
            基于真实 WebPageTest API 测试的 8 个关键性能指标
          </p>
        </div>

        <div className="metrics-grid">
          {/* Time to First Byte */}
          <div className="metric-card">
            <div className="metric-name">Time to First Byte</div>
            <div className={`metric-value ${getMetricClass('TTFB', metrics.TTFB)}`}>
              {formatTime(metrics.TTFB)}
            </div>
            <div className="metric-hint">服务器响应时间</div>
          </div>

          {/* Start Render */}
          <div className="metric-card">
            <div className="metric-name">Start Render</div>
            <div className={`metric-value ${getMetricClass('startRender', metrics.startRender)}`}>
              {formatTime(metrics.startRender)}
            </div>
            <div className="metric-hint">首次渲染时间</div>
          </div>

          {/* First Contentful Paint */}
          <div className="metric-card">
            <div className="metric-name">First Contentful Paint</div>
            <div className={`metric-value ${getMetricClass('firstContentfulPaint', metrics.firstContentfulPaint)}`}>
              {formatTime(metrics.firstContentfulPaint)}
            </div>
            <div className="metric-hint">首次内容绘制</div>
          </div>

          {/* Speed Index */}
          <div className="metric-card">
            <div className="metric-name">Speed Index</div>
            <div className={`metric-value ${getMetricClass('speedIndex', metrics.speedIndex)}`}>
              {formatTime(metrics.speedIndex)}
            </div>
            <div className="metric-hint">速度指数</div>
          </div>

          {/* Largest Contentful Paint */}
          <div className="metric-card">
            <div className="metric-name">Largest Contentful Paint</div>
            <div className={`metric-value ${getMetricClass('largestContentfulPaint', metrics.largestContentfulPaint)}`}>
              {formatTime(metrics.largestContentfulPaint)}
            </div>
            <div className="metric-hint">最大内容绘制</div>
          </div>

          {/* Cumulative Layout Shift */}
          <div className="metric-card">
            <div className="metric-name">Cumulative Layout Shift</div>
            <div className={`metric-value ${getMetricClass('cumulativeLayoutShift', metrics.cumulativeLayoutShift)}`}>
              {formatCLS(metrics.cumulativeLayoutShift)}
            </div>
            <div className="metric-hint">累积布局偏移</div>
          </div>

          {/* Total Blocking Time */}
          <div className="metric-card">
            <div className="metric-name">Total Blocking Time</div>
            <div className={`metric-value ${getMetricClass('totalBlockingTime', metrics.totalBlockingTime)}`}>
              {formatTime(metrics.totalBlockingTime)}
            </div>
            <div className="metric-hint">总阻塞时间</div>
          </div>

          {/* Fully Loaded */}
          <div className="metric-card">
            <div className="metric-name">Fully Loaded</div>
            <div className={`metric-value ${getMetricClass('fullyLoaded', metrics.fullyLoaded)}`}>
              {formatTime(metrics.fullyLoaded)}
            </div>
            <div className="metric-hint">完全加载时间</div>
          </div>
        </div>

        {/* 性能评分图例 */}
        <div className="performance-legend">
          <div className="legend-note">
            💡 颜色编码基于 Google Web Vitals 标准
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

      {/* 资源统计 */}
      <div className="resources-section">
        <div className="section-header">
          <h4>📊 资源统计</h4>
          <p className="section-subtitle">
            按类型和域名分析页面资源使用情况
          </p>
        </div>

        <div className="resources-grid">
          {/* 总计 */}
          <div className="resource-card total">
            <div className="resource-icon">📦</div>
            <div className="resource-details">
              <div className="resource-name">总计</div>
              <div className="resource-value">{formatBytes(resources.totalBytes)}</div>
              <div className="resource-count">{resources.totalRequests} 个请求</div>
            </div>
          </div>

          {/* 图片 */}
          <div className="resource-card">
            <div className="resource-icon">🖼️</div>
            <div className="resource-details">
              <div className="resource-name">图片</div>
              <div className="resource-value">{formatBytes(resources.images.bytes)}</div>
              <div className="resource-count">{resources.images.requests} 个请求</div>
            </div>
          </div>

          {/* JavaScript */}
          <div className="resource-card">
            <div className="resource-icon">📜</div>
            <div className="resource-details">
              <div className="resource-name">JavaScript</div>
              <div className="resource-value">{formatBytes(resources.js.bytes)}</div>
              <div className="resource-count">{resources.js.requests} 个请求</div>
            </div>
          </div>

          {/* CSS */}
          <div className="resource-card">
            <div className="resource-icon">🎨</div>
            <div className="resource-details">
              <div className="resource-name">CSS</div>
              <div className="resource-value">{formatBytes(resources.css.bytes)}</div>
              <div className="resource-count">{resources.css.requests} 个请求</div>
            </div>
          </div>
        </div>
      </div>

      {/* 域名统计 */}
      {data.domains && data.domains.length > 0 && (
        <div className="domains-section">
          <div className="section-header">
            <h4>🌐 域名统计 (前10个)</h4>
            <p className="section-subtitle">
              按域名分析资源分布,帮助识别第三方依赖
            </p>
          </div>
          <div className="domains-table">
            <div className="table-header">
              <div className="col-domain">域名</div>
              <div className="col-size">大小</div>
              <div className="col-requests">请求数</div>
              <div className="col-connections">连接数</div>
            </div>
            {data.domains.slice(0, 10).map((domain, index) => (
              <div key={index} className="table-row">
                <div className="col-domain" title={domain.domain}>
                  {domain.domain}
                </div>
                <div className="col-size">{formatBytes(domain.bytes)}</div>
                <div className="col-requests">{domain.requests}</div>
                <div className="col-connections">{domain.connections}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WebPageTest 链接 */}
      {data.testId && (
        <div className="wpt-link-section">
          <a
            href={`https://www.webpagetest.org/result/${data.testId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="wpt-link-button"
          >
            🔗 在 WebPageTest.org 查看完整报告
          </a>
        </div>
      )}
    </div>
  );
}
