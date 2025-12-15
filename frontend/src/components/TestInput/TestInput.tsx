import React, { useState } from 'react';
import { useCreateTest } from '../../services/queries';
import { PerformanceTestMode } from '../../services/api';
import './TestInput.css';

interface TestInputProps {
  onTestCreated?: (testId: string) => void;
}

export function TestInput({ onTestCreated }: TestInputProps) {
  const [url, setUrl] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [timeout, setTimeout] = useState(30);
  const [waitTime, setWaitTime] = useState(5);
  const [showPerformanceInfo, setShowPerformanceInfo] = useState(false);
  // 支持多选性能测试模式
  const [performanceTestModes, setPerformanceTestModes] = useState<Set<PerformanceTestMode>>(
    new Set(['webpagetest'])
  );

  // Test options state
  const [testOptions, setTestOptions] = useState({
    links: true,
    forms: true,
    buttons: true,
    images: true,
    performance: true,
  });

  const createTestMutation = useCreateTest();

  // Handle test option toggle
  const handleTestOptionToggle = (option: keyof typeof testOptions) => {
    setTestOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  // Handle select all / deselect all
  const handleSelectAll = () => {
    const allSelected = Object.values(testOptions).every((v) => v);
    const newValue = !allSelected;
    setTestOptions({
      links: newValue,
      forms: newValue,
      buttons: newValue,
      images: newValue,
      performance: newValue,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      return;
    }

    try {
      const emailToSend = notificationEmail.trim() || undefined;
      console.log('[Frontend] handleSubmit - notificationEmail:', notificationEmail);
      console.log('[Frontend] handleSubmit - emailToSend:', emailToSend);

      // 使用第一个选中的模式(暂时后端只支持单模式)
      const performanceTestMode = Array.from(performanceTestModes)[0] || 'webpagetest';

      const result = await createTestMutation.mutateAsync({
        url: url.trim(),
        notificationEmail: emailToSend,
        config: {
          timeout,
          waitTime,
          performanceTestMode,
          testOptions,
        },
      });

      // Clear form
      setUrl('');
      setNotificationEmail('');
      setTimeout(30);
      setWaitTime(5);

      // Notify parent component
      if (onTestCreated) {
        onTestCreated(result.id);
      }
    } catch (error) {
      // Error is already handled by mutation
      console.error('Failed to create test:', error);
    }
  };

  // Check if at least one test is selected
  const isAnyTestSelected = Object.values(testOptions).some((v) => v);
  const allTestsSelected = Object.values(testOptions).every((v) => v);

  const isLoading = createTestMutation.isPending;
  const error = createTestMutation.error;

  return (
    <div className="test-input">
      <form onSubmit={handleSubmit} className="test-input-form">
        <div className="form-header">
          <h2>网页自动化检测</h2>
          <p className="subtitle">输入URL开始检测页面功能和性能</p>
        </div>

        <div className="url-input-group">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="url-input"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            className="submit-button"
            disabled={isLoading || !url.trim() || !isAnyTestSelected}
          >
            {isLoading ? '检测中...' : '开始检测'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error.message}
          </div>
        )}

        {/* Test Options Section - Moved out of advanced options */}
        <div className="test-options-section">
          <div className="section-header">
            <label>选择测试项目</label>
            <button
              type="button"
              className="select-all-btn"
              onClick={handleSelectAll}
              disabled={isLoading}
            >
              {allTestsSelected ? '取消全选' : '全选'}
            </button>
          </div>

          {/* 第一行: 4个UI测试项目 */}
          <div className="checkbox-grid ui-tests-row">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={testOptions.links}
                onChange={() => handleTestOptionToggle('links')}
                disabled={isLoading}
              />
              <span className="checkbox-label">
                <span className="checkbox-icon">🔗</span>
                <span>链接测试</span>
              </span>
              <span className="checkbox-hint">检测链接可访问性及是否包含 beta 路由</span>
            </label>

            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={testOptions.forms}
                onChange={() => handleTestOptionToggle('forms')}
                disabled={isLoading}
              />
              <span className="checkbox-label">
                <span className="checkbox-icon">📝</span>
                <span>表单测试</span>
              </span>
              <span className="checkbox-hint">检测表单提交功能</span>
            </label>

            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={testOptions.buttons}
                onChange={() => handleTestOptionToggle('buttons')}
                disabled={isLoading}
              />
              <span className="checkbox-label">
                <span className="checkbox-icon">🔘</span>
                <span>按钮测试</span>
              </span>
              <span className="checkbox-hint">检测按钮可点击性</span>
            </label>

            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={testOptions.images}
                onChange={() => handleTestOptionToggle('images')}
                disabled={isLoading}
              />
              <span className="checkbox-label">
                <span className="checkbox-icon">🖼️</span>
                <span>图片测试</span>
              </span>
              <span className="checkbox-hint">检测图片加载状态</span>
            </label>
          </div>

          {/* 第二行: 性能测试选项 */}
          <div className="performance-tests-row">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={testOptions.performance}
                onChange={() => handleTestOptionToggle('performance')}
                disabled={isLoading}
              />
              <span className="checkbox-label">
                <span className="checkbox-icon">⚡</span>
                <span>性能测试</span>
                <button
                  type="button"
                  className="info-tooltip-trigger"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPerformanceInfo(!showPerformanceInfo);
                  }}
                  title="了解性能指标"
                >
                  ?
                </button>
              </span>
              <span className="checkbox-hint">检测加载速度和资源大小</span>
            </label>

            {/* Performance Test Mode Selector - 修改为多选checkbox */}
            {testOptions.performance && (
              <div className="performance-mode-selector">
                <label className="mode-selector-label">性能测试方式 (可多选):</label>
                <div className="mode-options">
                  <label className={`mode-option ${performanceTestModes.has('webpagetest') ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={performanceTestModes.has('webpagetest')}
                      onChange={(e) => {
                        const newModes = new Set(performanceTestModes);
                        if (e.target.checked) {
                          newModes.add('webpagetest');
                        } else {
                          newModes.delete('webpagetest');
                        }
                        setPerformanceTestModes(newModes);
                      }}
                      disabled={isLoading}
                    />
                    <div className="mode-content">
                      <div className="mode-title">
                        🎬 WebPageTest 性能测试 <span className="mode-badge default">默认</span>
                      </div>
                      <div className="mode-description">
                        集成 WebPageTest 官方 API,使用真实浏览器环境进行性能测试,提供视频帧、TTFB、FCP、LCP 等完整指标
                      </div>
                    </div>
                  </label>
                  <label className={`mode-option ${performanceTestModes.has('pagespeed') ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={performanceTestModes.has('pagespeed')}
                      onChange={(e) => {
                        const newModes = new Set(performanceTestModes);
                        if (e.target.checked) {
                          newModes.add('pagespeed');
                        } else {
                          newModes.delete('pagespeed');
                        }
                        setPerformanceTestModes(newModes);
                      }}
                      disabled={isLoading}
                    />
                    <div className="mode-content">
                      <div className="mode-title">
                        🚀 PageSpeed Insights
                      </div>
                      <div className="mode-description">
                        使用 Google PageSpeed API,提供详细的优化建议和诊断信息
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {showPerformanceInfo && (
          <div className="performance-info-popup">
            <div className="performance-info-overlay" onClick={() => setShowPerformanceInfo(false)} />
            <div className="performance-info-content">
              <div className="performance-info-header">
                <h4>性能检测指标说明</h4>
                <button
                  type="button"
                  className="performance-info-close"
                  onClick={() => setShowPerformanceInfo(false)}
                >
                  ✕
                </button>
              </div>
              <div className="performance-info-body">
                <div className="performance-metric performance-metric-primary">
                  <div className="metric-badge">最关注</div>
                  <div className="metric-title">
                    <span className="metric-icon">🎯</span>
                    <strong>LCP - 最大内容绘制 (Largest Contentful Paint)</strong>
                  </div>
                  <p className="metric-desc">
                    <strong>页面主要内容加载完成的时间</strong>，衡量用户感知加载速度的核心指标。
                    通常是页面中最大的图片、视频或文本块完全渲染的时间点。
                    <br />
                    <span className="metric-threshold metric-threshold-primary">
                      Google Core Web Vitals 标准: &lt;2.5秒为优秀，2.5-4秒需改进，&gt;4秒为差
                    </span>
                  </p>
                </div>

                <div className="performance-metric">
                  <div className="metric-title">
                    <span className="metric-icon">⚡</span>
                    <strong>FCP - 首次内容绘制 (First Contentful Paint)</strong>
                  </div>
                  <p className="metric-desc">
                    浏览器首次渲染任何内容（文本、图片等）到屏幕的时间。
                    <br />
                    <span className="metric-threshold">标准: &lt;1.8秒为优秀，1.8-3秒需改进，&gt;3秒为差</span>
                  </p>
                </div>

                <div className="performance-metric">
                  <div className="metric-title">
                    <span className="metric-icon">🔄</span>
                    <strong>TTFB - 首字节时间 (Time To First Byte)</strong>
                  </div>
                  <p className="metric-desc">
                    服务器响应首字节的时间，反映服务器性能和网络延迟。
                    <br />
                    <span className="metric-threshold">标准: &lt;200ms为优秀，200-600ms为良好，&gt;600ms需要优化</span>
                  </p>
                </div>

                <div className="performance-metric">
                  <div className="metric-title">
                    <span className="metric-icon">⏱️</span>
                    <strong>Load Time - 完整加载时间</strong>
                  </div>
                  <p className="metric-desc">
                    页面完全加载所需的时间，包括HTML、CSS、JavaScript和所有资源的下载和执行。
                    <br />
                    <span className="metric-threshold">标准: &lt;3秒为优秀，3-5秒为良好，&gt;5秒需要优化</span>
                  </p>
                </div>

                <div className="performance-metric">
                  <div className="metric-title">
                    <span className="metric-icon">📦</span>
                    <strong>Resource Size - 资源大小</strong>
                  </div>
                  <p className="metric-desc">
                    页面所有资源（图片、脚本、样式表等）的总大小。
                    <br />
                    <span className="metric-threshold">标准: &lt;2MB为优秀，2-5MB为良好，&gt;5MB需要优化</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="email-input-group">
        <label htmlFor="notification-email">
          📧 接收测试报告 (选填)
          <span className="email-hint">测试完成后发送报告到您的邮箱</span>
        </label>
        <input
          id="notification-email"
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          placeholder="your-email@example.com"
          className="email-input"
          disabled={isLoading}
        />
      </div>

      <div className="info-message">
        <span className="info-icon">ℹ️</span>
        检测包括: 链接、表单、按钮、图片功能测试,以及加载速度、资源大小、响应时间等性能指标
      </div>
      </form>
    </div>
  );
}
