import React, { useState } from 'react';
import { useCreateTest } from '../../services/queries';
import './TestInput.css';

interface TestInputProps {
  onTestCreated?: (testId: string) => void;
}

export function TestInput({ onTestCreated }: TestInputProps) {
  const [url, setUrl] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeout, setTimeout] = useState(30);
  const [waitTime, setWaitTime] = useState(5);

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

      const result = await createTestMutation.mutateAsync({
        url: url.trim(),
        notificationEmail: emailToSend,
        config: {
          timeout,
          waitTime,
          testOptions,
        },
      });

      // Clear form
      setUrl('');
      setNotificationEmail('');
      setTimeout(30);
      setWaitTime(5);
      setAdvancedOpen(false);

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

        <div className="advanced-section">
          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <span>{advancedOpen ? '▼' : '▶'} 高级选项</span>
          </button>

          {advancedOpen && (
            <div className="advanced-options">
              {/* Test Options Section */}
              <div className="test-options-section">
                <div className="section-header">
                  <label>测试项目</label>
                  <button
                    type="button"
                    className="select-all-btn"
                    onClick={handleSelectAll}
                    disabled={isLoading}
                  >
                    {allTestsSelected ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="checkbox-grid">
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
                    <span className="checkbox-hint">检测页面链接可点击性和有效性</span>
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
                    </span>
                    <span className="checkbox-hint">检测加载速度和资源大小</span>
                  </label>
                </div>
              </div>

              {/* Configuration Section */}
              <div className="config-section">
                <div className="section-header">
                  <label>配置参数</label>
                </div>
                <div className="option-group">
                  <label htmlFor="timeout">
                    页面超时 (秒)
                    <span className="option-hint">加载页面的最大等待时间</span>
                  </label>
                  <input
                    id="timeout"
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeout(Number(e.target.value))}
                    min={5}
                    max={120}
                    disabled={isLoading}
                  />
                </div>

                <div className="option-group">
                  <label htmlFor="waitTime">
                    JavaScript等待 (秒)
                    <span className="option-hint">等待JavaScript执行的时间</span>
                  </label>
                  <input
                    id="waitTime"
                    type="number"
                    value={waitTime}
                    onChange={(e) => setWaitTime(Number(e.target.value))}
                    min={0}
                    max={30}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="info-message">
          <span className="info-icon">ℹ️</span>
          检测包括: 链接、表单、按钮、图片功能测试,以及加载速度、资源大小、响应时间等性能指标
        </div>
      </form>
    </div>
  );
}
