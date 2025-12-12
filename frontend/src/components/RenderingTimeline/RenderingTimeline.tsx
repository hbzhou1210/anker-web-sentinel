import React from 'react';
import { RenderingSnapshot } from '../../services/api';
import { getFullApiUrl } from '../../services/api';
import './RenderingTimeline.css';

interface RenderingTimelineProps {
  snapshots: RenderingSnapshot[];
}

export function RenderingTimeline({ snapshots }: RenderingTimelineProps) {
  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  // Get stage icon
  const getStageIcon = (stage: string): string => {
    const icons: Record<string, string> = {
      initial: '🔄',
      fcp: '🎨',
      domload: '📄',
      lcp: '🖼️',
      fullyloaded: '✅',
    };
    return icons[stage] || '📸';
  };

  // Format timestamp
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="rendering-timeline">
      <div className="timeline-header">
        <h3>🎬 页面加载过程(Filmstrip View)</h3>
        <p className="timeline-subtitle">
          类似 WebPageTest 的电影胶片视图,展示页面在不同加载阶段的实际渲染效果
        </p>
      </div>

      {/* Filmstrip - 胶片式截图序列 */}
      <div className="filmstrip-container">
        {snapshots.map((snapshot, index) => (
          <div key={snapshot.stage} className="filmstrip-frame">
            <div className="frame-header">
              <span className="frame-icon">{getStageIcon(snapshot.stage)}</span>
              <span className="frame-title">{snapshot.stageName}</span>
              <span className="frame-time">{formatTime(snapshot.timestamp)}</span>
            </div>

            {snapshot.screenshotUrl && (
              <div className="frame-screenshot">
                <img
                  src={getFullApiUrl(`/api/v1/images/feishu/${snapshot.screenshotUrl}`)}
                  alt={`${snapshot.stageName}截图`}
                  loading="lazy"
                  onClick={(e) => {
                    window.open(e.currentTarget.src, '_blank');
                  }}
                />
              </div>
            )}

            {snapshot.metrics?.description && (
              <div className="frame-description">
                {snapshot.metrics.description}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="filmstrip-hint">
        💡 点击任意截图可以查看大图 | 截图按时间顺序从左到右排列
      </div>
    </div>
  );
}
