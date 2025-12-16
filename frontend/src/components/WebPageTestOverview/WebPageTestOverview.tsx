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

  // 安全地解构数据,提供默认值
  const metrics = data.metrics || {} as any;
  const resources = data.resources || { totalBytes: 0, totalRequests: 0, images: { bytes: 0, requests: 0 }, js: { bytes: 0, requests: 0 }, css: { bytes: 0, requests: 0 } };

  // 如果没有metrics数据,显示错误提示
  if (!data.metrics) {
    return (
      <div className="webpagetest-overview">
        <div className="no-data-message">
          <span className="warning-icon">⚠️</span>
          <p>WebPageTest 指标数据不可用</p>
        </div>
      </div>
    );
  }

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
                  {frame.image ? (
                    <img
                      src={frame.image}
                      alt={`Frame at ${formatTime(frame.time)}`}
                      className="frame-image"
                      loading="lazy"
                      onClick={() => window.open(frame.image, '_blank')}
                    />
                  ) : (
                    <div className="frame-placeholder">
                      <div className="placeholder-icon">🎬</div>
                      <div className="placeholder-text">帧数据已优化</div>
                    </div>
                  )}
                </div>
                <div className="frame-progress">
                  {frame.visuallyComplete}% 可见
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提示信息 - 引导用户查看完整报告 */}
      <div className="guide-section">
        <div className="guide-content">
          <div className="guide-icon">📊</div>
          <div className="guide-text">
            <h4>查看完整性能报告</h4>
            <p>点击下方按钮前往 WebPageTest 查看详细的性能指标、资源统计和优化建议</p>
          </div>
        </div>
      </div>

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
