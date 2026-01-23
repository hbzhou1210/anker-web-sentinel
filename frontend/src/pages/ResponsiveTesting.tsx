import { useState, useEffect } from 'react';
import { Smartphone, Tablet, Monitor, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { CircularProgress } from '../components/CircularProgress';
import { LazyImage } from '../components/LazyImage';
import { getFullApiUrl } from '../services/api';

/**
 * 处理截图URL - 支持飞书图片key和传统路径
 * 飞书图片key格式: img_v3_xxx 或 img_xxx
 * 传统路径格式: /screenshots/xxx.webp
 */
function getScreenshotUrl(urlOrKey: string): string {
  // 如果是飞书图片key(以img_开头)
  if (urlOrKey.startsWith('img_')) {
    return getFullApiUrl(`/api/v1/images/feishu/${urlOrKey}`);
  }
  // 如果已经是完整URL，直接返回
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey;
  }
  // 其他情况（如/screenshots/xxx.webp），使用getFullApiUrl处理
  return getFullApiUrl(urlOrKey);
}

interface Device {
  id: number;
  name: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  viewportWidth: number;
  viewportHeight: number;
  enabled: boolean;
}

interface ResponsiveTestResult {
  deviceName: string;
  deviceType: string;
  viewportWidth: number;
  viewportHeight: number;
  hasHorizontalScroll: boolean;
  hasViewportMeta: boolean;
  fontSizeReadable: boolean;
  touchTargetsAdequate: boolean;
  imagesResponsive: boolean;
  screenshotPortraitUrl?: string;
  screenshotLandscapeUrl?: string;
  issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    details?: any;
  }>;
  testDuration: number;
}

interface Stats {
  totalDevices: number;
  passed: number;
  failed: number;
  totalIssues: number;
}

export default function ResponsiveTesting() {
  const [url, setUrl] = useState(() => {
    // 从 localStorage 恢复 URL
    return localStorage.getItem('responsiveTest_url') || '';
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<number[]>(() => {
    // 从 localStorage 恢复选中的设备
    const saved = localStorage.getItem('responsiveTest_selectedDevices');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(() => {
    // 从 localStorage 恢复加载状态
    return localStorage.getItem('responsiveTest_loading') === 'true';
  });
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [results, setResults] = useState<ResponsiveTestResult[] | null>(() => {
    // 从 localStorage 恢复测试结果
    const saved = localStorage.getItem('responsiveTest_results');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 验证数据结构:检查是否有截图 URL 字段(新版本数据应该有)
        // 如果是旧版本数据(没有截图字段),清空缓存
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasScreenshotFields = parsed.some(
            result => result.screenshotPortraitUrl !== undefined
          );
          if (!hasScreenshotFields) {
            console.log('[ResponsiveTesting] Clearing outdated cached data (missing screenshot fields)');
            localStorage.removeItem('responsiveTest_results');
            localStorage.removeItem('responsiveTest_stats');
            return null;
          }
        }
        return parsed;
      } catch (e) {
        console.error('[ResponsiveTesting] Failed to parse cached results:', e);
        localStorage.removeItem('responsiveTest_results');
        return null;
      }
    }
    return null;
  });
  const [stats, setStats] = useState<Stats | null>(() => {
    // 从 localStorage 恢复统计数据
    const saved = localStorage.getItem('responsiveTest_stats');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState('');
  const [expandedResults, setExpandedResults] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // 加载设备列表
  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const response = await fetch(getFullApiUrl('/api/v1/responsive/devices'));
      const data = await response.json();

      if (data.success && data.data) {
        setDevices(data.data);
        // 只在没有已保存的设备选择时，才设置默认选中所有移动设备
        if (selectedDevices.length === 0) {
          const mobileDeviceIds = data.data
            .filter((d: Device) => d.deviceType === 'mobile')
            .map((d: Device) => d.id);
          setSelectedDevices(mobileDeviceIds);
        }
      } else {
        console.error('Failed to load devices:', data.error || data.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadDevices();

    // 检查是否有遗留的 loading 状态（页面刷新或崩溃后）
    const savedLoading = localStorage.getItem('responsiveTest_loading');
    const savedTaskId = localStorage.getItem('responsiveTest_taskId');

    if (savedLoading === 'true' && savedTaskId) {
      // 尝试恢复任务状态
      console.log('[ResponsiveTesting] Detected orphaned loading state, checking task:', savedTaskId);

      fetch(getFullApiUrl(`/api/v1/responsive/tasks/${savedTaskId}`))
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const task = data.data;
            if (task.status === 'completed' || task.status === 'failed') {
              // 任务已完成，清理 loading 状态
              console.log('[ResponsiveTesting] Task already completed, clearing loading state');
              setLoading(false);
              localStorage.setItem('responsiveTest_loading', 'false');
              localStorage.removeItem('responsiveTest_taskId');
            } else {
              // 任务仍在运行，恢复轮询
              console.log('[ResponsiveTesting] Task still running, resuming poll');
              setTaskId(savedTaskId);
              pollTaskStatus(savedTaskId);
            }
          } else {
            // 任务不存在，清理状态
            console.log('[ResponsiveTesting] Task not found, clearing loading state');
            setLoading(false);
            localStorage.setItem('responsiveTest_loading', 'false');
            localStorage.removeItem('responsiveTest_taskId');
          }
        })
        .catch(err => {
          // 请求失败，清理状态
          console.error('[ResponsiveTesting] Failed to check task status:', err);
          setLoading(false);
          localStorage.setItem('responsiveTest_loading', 'false');
          localStorage.removeItem('responsiveTest_taskId');
        });
    } else if (savedLoading === 'true') {
      // loading 是 true 但没有 taskId，直接清理
      console.log('[ResponsiveTesting] Orphaned loading state without taskId, clearing');
      setLoading(false);
      localStorage.setItem('responsiveTest_loading', 'false');
    }
  }, []);

  // 保存 URL 到 localStorage
  useEffect(() => {
    if (url) {
      localStorage.setItem('responsiveTest_url', url);
    } else {
      localStorage.removeItem('responsiveTest_url');
    }
  }, [url]);

  // 保存选中的设备到 localStorage
  useEffect(() => {
    localStorage.setItem('responsiveTest_selectedDevices', JSON.stringify(selectedDevices));
  }, [selectedDevices]);

  // 保存加载状态到 localStorage
  useEffect(() => {
    localStorage.setItem('responsiveTest_loading', loading.toString());
  }, [loading]);

  // 保存测试结果和统计数据到 localStorage
  useEffect(() => {
    if (results) {
      localStorage.setItem('responsiveTest_results', JSON.stringify(results));
    } else {
      localStorage.removeItem('responsiveTest_results');
    }

    if (stats) {
      localStorage.setItem('responsiveTest_stats', JSON.stringify(stats));
    } else {
      localStorage.removeItem('responsiveTest_stats');
    }

    // 当测试完成(有结果且不在加载中)时,清理加载状态
    if (results && !loading) {
      localStorage.setItem('responsiveTest_loading', 'false');
    }
  }, [results, stats, loading]);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('请输入URL');
      return;
    }

    if (selectedDevices.length === 0) {
      setError('请至少选择一个设备');
      return;
    }

    // 开始新测试时清理之前的结果
    setLoading(true);
    setError('');
    setResults(null);
    setStats(null);
    setProgress(0);
    setProgressMessage('正在启动测试...');

    // 清理 localStorage 中的旧结果
    localStorage.removeItem('responsiveTest_results');
    localStorage.removeItem('responsiveTest_stats');

    try {
      // 步骤 1: 启动异步测试任务
      const response = await fetch(getFullApiUrl('/api/v1/responsive/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          deviceIds: selectedDevices,
        }),
      });

      const data = await response.json();

      if (data.success && data.data && data.data.taskId) {
        const newTaskId = data.data.taskId;
        setTaskId(newTaskId);
        // 保存 taskId 到 localStorage，以便页面刷新后恢复
        localStorage.setItem('responsiveTest_taskId', newTaskId);
        setProgressMessage(`测试已启动，预计需要 ${data.data.estimatedTime} 秒`);

        // 步骤 2: 轮询任务状态
        await pollTaskStatus(newTaskId);
      } else {
        setError(data.message || data.error || '启动测试失败');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
      setLoading(false);
    }
  };

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string) => {
    const pollInterval = 2000; // 每2秒轮询一次
    const maxAttempts = 300; // 最多轮询5分钟 (300 * 2s = 600s)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('任务超时，请重试');
        setLoading(false);
        return;
      }

      attempts++;

      try {
        const response = await fetch(getFullApiUrl(`/api/v1/responsive/tasks/${taskId}`));
        const data = await response.json();

        if (!data.success) {
          setError(data.message || '获取任务状态失败');
          setLoading(false);
          return;
        }

        const task = data.data;

        // 更新进度
        if (task.progress !== undefined) {
          setProgress(task.progress);
        }
        if (task.progressMessage) {
          setProgressMessage(task.progressMessage);
        }

        // 检查任务状态
        if (task.status === 'completed') {
          // 任务完成
          console.log('[ResponsiveTesting] Task completed, results:', task.result);

          if (task.result && task.result.results) {
            setResults(task.result.results);
            setStats(task.result.stats);
            setProgress(100);
            setProgressMessage('测试完成');
          } else {
            setError('测试结果为空');
          }
          setLoading(false);
          // 清理 taskId
          localStorage.removeItem('responsiveTest_taskId');
        } else if (task.status === 'failed') {
          // 任务失败
          setError(task.error || '测试失败');
          setLoading(false);
          // 清理 taskId
          localStorage.removeItem('responsiveTest_taskId');
        } else {
          // 继续轮询
          setTimeout(poll, pollInterval);
        }
      } catch (err) {
        console.error('[ResponsiveTesting] Poll error:', err);
        setError(err instanceof Error ? err.message : '网络错误');
        setLoading(false);
      }
    };

    // 开始轮询
    poll();
  };

  const toggleDevice = (deviceId: number) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAllDevices = (type?: 'mobile' | 'tablet' | 'desktop') => {
    if (type) {
      const typeDevices = devices.filter(d => d.deviceType === type).map(d => d.id);
      setSelectedDevices(typeDevices);
    } else {
      setSelectedDevices(devices.map(d => d.id));
    }
  };

  const getDeviceIcon = (type: string, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
    switch (type) {
      case 'mobile':
        return <Smartphone className={sizeClass} />;
      case 'tablet':
        return <Tablet className={sizeClass} />;
      case 'desktop':
        return <Monitor className={sizeClass} />;
      default:
        return <Smartphone className={sizeClass} />;
    }
  };

  const isPassed = (result: ResponsiveTestResult) => {
    // 只有 error 级别的问题才算测试失败
    // warning 级别的问题(字体大小、触摸目标、图片响应式)不影响通过状态
    const hasError = result.issues.some(issue => issue.severity === 'error');
    return !hasError;
  };

  const toggleResultExpand = (index: number) => {
    setExpandedResults(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getFilteredResults = () => {
    if (!results) return [];
    if (filterStatus === 'all') return results;
    return results.filter(result =>
      filterStatus === 'passed' ? isPassed(result) : !isPassed(result)
    );
  };

  const getSeverityColor = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getDeviceTypeGroups = () => {
    const groups = {
      mobile: devices.filter(d => d.deviceType === 'mobile'),
      tablet: devices.filter(d => d.deviceType === 'tablet'),
      desktop: devices.filter(d => d.deviceType === 'desktop'),
    };
    return groups;
  };

  const deviceGroups = getDeviceTypeGroups();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">移动端/响应式测试</h1>
          <p className="text-sm md:text-base text-gray-600">测试网站在不同设备上的响应式表现</p>
        </div>

        {/* 测试表单 */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                网站 URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>

            {/* 设备选择 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  选择测试设备
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectAllDevices()}
                    className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllDevices('mobile')}
                    className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    仅手机
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllDevices('tablet')}
                    className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    仅平板
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDevices([])}
                    className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                  >
                    清空
                  </button>
                </div>
              </div>

              {loadingDevices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">加载设备列表...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 移动设备组 */}
                  {deviceGroups.mobile.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Smartphone className="w-5 h-5 text-gray-600" />
                        <h3 className="text-sm font-semibold text-gray-700">移动设备</h3>
                        <span className="text-xs text-gray-500">({deviceGroups.mobile.length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {deviceGroups.mobile.map((device) => (
                          <button
                            key={device.id}
                            type="button"
                            onClick={() => toggleDevice(device.id)}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              selectedDevices.includes(device.id)
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {selectedDevices.includes(device.id) && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                              </div>
                            )}
                            <div className={`${selectedDevices.includes(device.id) ? 'text-blue-600' : 'text-gray-600'}`}>
                              {getDeviceIcon(device.deviceType, 'lg')}
                            </div>
                            <div className="text-center w-full">
                              <div className={`font-medium text-sm ${selectedDevices.includes(device.id) ? 'text-blue-700' : 'text-gray-800'}`}>
                                {device.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {device.viewportWidth}×{device.viewportHeight}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 平板设备组 */}
                  {deviceGroups.tablet.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Tablet className="w-5 h-5 text-gray-600" />
                        <h3 className="text-sm font-semibold text-gray-700">平板设备</h3>
                        <span className="text-xs text-gray-500">({deviceGroups.tablet.length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {deviceGroups.tablet.map((device) => (
                          <button
                            key={device.id}
                            type="button"
                            onClick={() => toggleDevice(device.id)}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              selectedDevices.includes(device.id)
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {selectedDevices.includes(device.id) && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                              </div>
                            )}
                            <div className={`${selectedDevices.includes(device.id) ? 'text-blue-600' : 'text-gray-600'}`}>
                              {getDeviceIcon(device.deviceType, 'lg')}
                            </div>
                            <div className="text-center w-full">
                              <div className={`font-medium text-sm ${selectedDevices.includes(device.id) ? 'text-blue-700' : 'text-gray-800'}`}>
                                {device.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {device.viewportWidth}×{device.viewportHeight}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 桌面设备组 */}
                  {deviceGroups.desktop.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Monitor className="w-5 h-5 text-gray-600" />
                        <h3 className="text-sm font-semibold text-gray-700">桌面设备</h3>
                        <span className="text-xs text-gray-500">({deviceGroups.desktop.length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {deviceGroups.desktop.map((device) => (
                          <button
                            key={device.id}
                            type="button"
                            onClick={() => toggleDevice(device.id)}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              selectedDevices.includes(device.id)
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {selectedDevices.includes(device.id) && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                              </div>
                            )}
                            <div className={`${selectedDevices.includes(device.id) ? 'text-blue-600' : 'text-gray-600'}`}>
                              {getDeviceIcon(device.deviceType, 'lg')}
                            </div>
                            <div className="text-center w-full">
                              <div className={`font-medium text-sm ${selectedDevices.includes(device.id) ? 'text-blue-700' : 'text-gray-800'}`}>
                                {device.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {device.viewportWidth}×{device.viewportHeight}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || selectedDevices.length === 0}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm hover:shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  测试中... ({progress}%)
                </>
              ) : (
                '开始测试'
              )}
            </button>
          </form>

          {/* 进度条 */}
          {loading && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">测试进度</span>
                <span className="text-sm font-semibold text-blue-700">{progress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              {progressMessage && (
                <p className="text-xs text-blue-700 mt-2">{progressMessage}</p>
              )}
            </div>
          )}
        </div>

        {/* 统计摘要 */}
        {stats && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">测试统计概览</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setFilterStatus('passed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === 'passed'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  仅通过
                </button>
                <button
                  onClick={() => setFilterStatus('failed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === 'failed'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  仅失败
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 测试设备数 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-blue-800">测试设备</div>
                  <Monitor className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-4xl font-bold text-blue-900">{stats.totalDevices}</div>
                <div className="text-xs text-blue-700 mt-2">共测试 {stats.totalDevices} 个设备</div>
              </div>

              {/* 通过数 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-green-800">通过测试</div>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-green-900">{stats.passed}</div>
                <div className="mt-3 bg-green-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-green-600 h-full transition-all duration-500"
                    style={{ width: `${(stats.passed / stats.totalDevices) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-green-700 mt-2">
                  通过率 {((stats.passed / stats.totalDevices) * 100).toFixed(1)}%
                </div>
              </div>

              {/* 失败数 */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-red-800">测试失败</div>
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-4xl font-bold text-red-900">{stats.failed}</div>
                <div className="mt-3 bg-red-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-600 h-full transition-all duration-500"
                    style={{ width: `${(stats.failed / stats.totalDevices) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-red-700 mt-2">
                  失败率 {((stats.failed / stats.totalDevices) * 100).toFixed(1)}%
                </div>
              </div>

              {/* 问题总数 */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-orange-800">发现问题</div>
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-4xl font-bold text-orange-900">{stats.totalIssues}</div>
                <div className="text-xs text-orange-700 mt-2">
                  平均每设备 {(stats.totalIssues / stats.totalDevices).toFixed(1)} 个问题
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 测试结果 */}
        {results && results.length > 0 && (
          <div className="space-y-4">
            {getFilteredResults().map((result, index) => {
              const passed = isPassed(result);
              const isExpanded = expandedResults.includes(index);
              const checksCount = 5;
              const passedChecks = [
                !result.hasHorizontalScroll,
                result.hasViewportMeta,
                result.fontSizeReadable,
                result.touchTargetsAdequate,
                result.imagesResponsive
              ].filter(Boolean).length;
              const passPercentage = (passedChecks / checksCount) * 100;

              return (
                <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
                  {/* 设备头部 - 可点击展开/折叠 */}
                  <div
                    className={`p-5 cursor-pointer transition-colors ${
                      passed
                        ? 'bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-150'
                        : 'bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-150'
                    }`}
                    onClick={() => toggleResultExpand(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* 圆形进度指示器 */}
                        <div>
                          <CircularProgress
                            percentage={passPercentage}
                            size={80}
                            strokeWidth={8}
                            passed={passed}
                          />
                        </div>

                        {/* 设备信息 */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className={`p-2 rounded-lg ${passed ? 'bg-green-200' : 'bg-red-200'}`}>
                              {getDeviceIcon(result.deviceType, 'lg')}
                            </div>
                            <h3 className="font-bold text-lg text-gray-900">{result.deviceName}</h3>
                            {passed ? (
                              <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold shadow-sm">
                                ✓ 通过
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold shadow-sm">
                                ✗ 失败
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Monitor className="w-4 h-4" />
                              {result.viewportWidth}×{result.viewportHeight}
                            </span>
                            <span>•</span>
                            <span>{result.testDuration}ms</span>
                            <span>•</span>
                            <span className="font-medium">
                              {passedChecks}/{checksCount} 检测通过
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 右侧:问题统计和展开按钮 */}
                      <div className="flex items-center gap-4">
                        {result.issues.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
                              <AlertTriangle className="w-5 h-5 text-orange-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {result.issues.filter(i => i.severity === 'error').length} 个错误
                                {result.issues.filter(i => i.severity === 'warning').length > 0 &&
                                  `, ${result.issues.filter(i => i.severity === 'warning').length} 个警告`
                                }
                              </span>
                            </div>
                            {!passed && passedChecks >= 3 && (
                              <div className="text-xs text-red-600 font-medium px-3">
                                ⚠️ 建议人工复核
                              </div>
                            )}
                          </div>
                        )}
                        <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                          <span className="text-2xl text-gray-700">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 展开的详细内容 */}
                  {isExpanded && (
                    <div className="p-6 bg-gray-50 border-t border-gray-200">
                      {/* 检测项 - 卡片式布局 */}
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">详细检测结果</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                          {[
                            { passed: !result.hasHorizontalScroll, label: '无横向滚动', desc: '页面不应超出视口宽度', isError: true },
                            { passed: result.hasViewportMeta, label: 'Viewport Meta', desc: '必须包含正确的 meta 标签', isError: true },
                            { passed: result.fontSizeReadable, label: '字体可读性', desc: '字体大小应 ≥ 12px', isError: false },
                            { passed: result.touchTargetsAdequate, label: '触摸目标', desc: '可点击元素 ≥ 44x44px', isError: false },
                            { passed: result.imagesResponsive, label: '图片响应式', desc: '图片应自适应容器', isError: false }
                          ].map((check, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                check.passed
                                  ? 'bg-green-50 border-green-300 hover:border-green-400'
                                  : check.isError
                                  ? 'bg-red-50 border-red-300 hover:border-red-400'
                                  : 'bg-yellow-50 border-yellow-300 hover:border-yellow-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {check.passed ? (
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                ) : check.isError ? (
                                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                )}
                                <span className={`text-sm font-medium ${
                                  check.passed
                                    ? 'text-green-900'
                                    : check.isError
                                    ? 'text-red-900'
                                    : 'text-yellow-900'
                                }`}>
                                  {check.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 ml-7">{check.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 问题列表 */}
                      {result.issues.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            <h4 className="text-sm font-semibold text-gray-700">
                              发现的问题 ({result.issues.length})
                            </h4>
                          </div>
                          <div className="space-y-3">
                            {result.issues.map((issue, issueIndex) => (
                              <div
                                key={issueIndex}
                                className={`rounded-lg border-l-4 p-4 shadow-sm ${getSeverityColor(issue.severity)}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0">
                                    {issue.severity === 'error' ? (
                                      <XCircle className="w-5 h-5 text-red-600" />
                                    ) : (
                                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                                        issue.severity === 'error'
                                          ? 'bg-red-200 text-red-900'
                                          : 'bg-yellow-200 text-yellow-900'
                                      }`}>
                                        {issue.severity === 'error' ? '错误' : '警告'}
                                      </span>
                                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                                        {issue.type.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 mb-1">
                                      {issue.message}
                                    </p>
                                    {issue.details?.recommendation && (
                                      <div className="mt-2 p-2 bg-white/50 rounded border border-current/20">
                                        <p className="text-xs text-gray-700">
                                          <span className="font-semibold">💡 建议:</span> {issue.details.recommendation}
                                        </p>
                                      </div>
                                    )}
                                    {issue.details && Object.keys(issue.details).filter(k => k !== 'recommendation').length > 0 && (
                                      <details className="mt-2">
                                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                          查看详细信息
                                        </summary>
                                        <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-x-auto">
                                          {JSON.stringify(issue.details, null, 2)}
                                        </pre>
                                      </details>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 截图 */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Smartphone className="w-5 h-5 text-blue-600" />
                          <h4 className="text-sm font-semibold text-gray-700">屏幕截图</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.screenshotPortraitUrl && (
                            <div className="group relative">
                              <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all shadow-sm hover:shadow-md">
                                <LazyImage
                                  src={`${getScreenshotUrl(result.screenshotPortraitUrl)}`}
                                  alt="竖屏截图"
                                  className="w-full cursor-pointer transition-transform group-hover:scale-105"
                                  rootMargin="100px"
                                  onLoad={() => {}}
                                />
                                <div
                                  className="absolute inset-0 cursor-pointer"
                                  onClick={() => setSelectedScreenshot(`${getScreenshotUrl(result.screenshotPortraitUrl)}`)}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                  <button
                                    onClick={() => setSelectedScreenshot(`${getScreenshotUrl(result.screenshotPortraitUrl)}`)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-3 shadow-lg"
                                  >
                                    <span className="text-2xl text-blue-600">🔍</span>
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  <Smartphone className="w-3 h-3" />
                                  竖屏 ({result.viewportWidth}×{result.viewportHeight})
                                </span>
                              </div>
                            </div>
                          )}
                          {result.screenshotLandscapeUrl && (
                            <div className="group relative">
                              <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all shadow-sm hover:shadow-md">
                                <LazyImage
                                  src={`${getScreenshotUrl(result.screenshotLandscapeUrl)}`}
                                  alt="横屏截图"
                                  className="w-full cursor-pointer transition-transform group-hover:scale-105"
                                  rootMargin="100px"
                                  onLoad={() => {}}
                                />
                                <div
                                  className="absolute inset-0 cursor-pointer"
                                  onClick={() => setSelectedScreenshot(`${getScreenshotUrl(result.screenshotLandscapeUrl)}`)}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                  <button
                                    onClick={() => setSelectedScreenshot(`${getScreenshotUrl(result.screenshotLandscapeUrl)}`)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-3 shadow-lg"
                                  >
                                    <span className="text-2xl text-blue-600">🔍</span>
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                  <Monitor className="w-3 h-3" />
                                  横屏 ({result.viewportHeight}×{result.viewportWidth})
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 截图放大查看模态框 */}
        {selectedScreenshot && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={() => setSelectedScreenshot(null)}
          >
            <div className="relative max-w-6xl max-h-full">
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              >
                <XCircle className="w-10 h-10" />
              </button>
              <LazyImage
                src={selectedScreenshot}
                alt="放大查看"
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                rootMargin="0px"
                onLoad={() => {}}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
