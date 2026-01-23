import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft,
  Mail, Activity, TrendingUp, BarChart3, Eye, Globe,
  Loader2, ZoomIn, ZoomOut, Maximize2, Download
} from 'lucide-react';

import { getFullApiUrl } from '../services/api';

interface TestResult {
  url: string;
  name: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  responseTime?: number;
  testDuration?: number;
  errorMessage?: string;
  checkDetails?: string;
  screenshotUrl?: string;
  visualDiff?: {
    hasDifference: boolean;
    diffPercentage: number;
    diffImageUrl?: string;
    baselineImageUrl?: string;
  };
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  deviceName?: string;
  viewport?: {
    width: number;
    height: number;
  };
  seoResults?: {
    title?: string;
    hreflangLinks?: Array<{
      lang: string;
      href: string;
      isValid?: boolean;
    }>;
    hreflangIssues?: {
      missingXDefault?: boolean;
      duplicateLangs?: string[];
      invalidUrls?: string[];
    };
    article?: {
      hasArticleTag?: boolean;
      author?: string;
      publishedTime?: string;
      modifiedTime?: string;
      section?: string;
    };
    score?: number;
  };
}

interface PatrolExecution {
  id: string;
  patrolTaskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalUrls: number;
  passedUrls: number;
  failedUrls: number;
  testResults: TestResult[];
  emailSent: boolean;
  emailSentAt?: string;
  errorMessage?: string;
  durationMs?: number;
}

interface PatrolTask {
  id: string;
  name: string;
  description?: string;
}

const PatrolExecutionDetail: React.FC = () => {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();

  const [execution, setExecution] = useState<PatrolExecution | null>(null);
  const [task, setTask] = useState<PatrolTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 加载执行记录详情
  useEffect(() => {
    const loadExecutionDetail = async () => {
      if (!executionId) {
        setLoading(false);
        return;
      }

      try {
        // 加载执行记录
        const executionRes = await fetch(getFullApiUrl(`/api/v1/patrol/executions/${executionId}`));
        if (!executionRes.ok) {
          throw new Error('Failed to load execution');
        }
        const executionData = await executionRes.json();
        setExecution(executionData);

        // 加载关联的任务信息
        if (executionData.patrolTaskId) {
          const taskRes = await fetch(getFullApiUrl(`/api/v1/patrol/tasks/${executionData.patrolTaskId}`));
          if (taskRes.ok) {
            const taskData = await taskRes.json();
            setTask(taskData);
          }
        }
      } catch (error) {
        console.error('加载执行详情失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExecutionDetail();
  }, [executionId]);

  // 图片查看器事件处理
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedScreenshot) {
        closeImageViewer();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [expandedScreenshot]);

  const closeImageViewer = () => {
    setExpandedScreenshot(null);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setIsDragging(false);
    setIsFullscreen(false);
  };

  const handleZoomIn = () => setImageScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setImageScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageScale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageScale > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownload = async () => {
    if (!expandedScreenshot) return;
    try {
      const response = await fetch(getFullApiUrl(expandedScreenshot));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载执行详情中...</p>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">执行记录不存在</h2>
          <p className="text-gray-600 mb-6">未找到该执行记录，可能已被删除</p>
          <button
            onClick={() => navigate('/tools/patrol')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            返回巡检列表
          </button>
        </div>
      </div>
    );
  }

  const passRate = execution.totalUrls > 0
    ? ((execution.passedUrls / execution.totalUrls) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/tools/patrol')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">返回巡检列表</span>
        </button>

        {/* 执行概要卡片 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {task?.name || '执行记录详情'}
              </h1>
              {task?.description && (
                <p className="text-gray-600">{task.description}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              {execution.status === 'completed' ? (
                execution.failedUrls === 0 ? (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <AlertCircle className="w-8 h-8 text-white" />
                  </div>
                )
              ) : execution.status === 'failed' ? (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                  <Clock className="w-8 h-8 text-white animate-pulse" />
                </div>
              )}
            </div>
          </div>

          {/* 执行统计 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">执行时间</div>
              <div className="text-lg font-bold text-gray-900">
                {new Date(execution.startedAt).toLocaleString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                通过率
              </div>
              <div className="text-2xl font-bold text-green-600">{passRate}%</div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">测试总数</div>
              <div className="text-2xl font-bold text-gray-900">{execution.totalUrls}</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                通过
              </div>
              <div className="text-2xl font-bold text-green-600">{execution.passedUrls}</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                失败
              </div>
              <div className="text-2xl font-bold text-red-600">{execution.failedUrls}</div>
            </div>
          </div>

          {/* 额外信息 */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
            {execution.durationMs && (
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-700">
                  耗时: <span className="font-bold">{(execution.durationMs / 1000).toFixed(1)}s</span>
                </span>
              </div>
            )}
            {execution.emailSent && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">
                  邮件已发送
                  {execution.emailSentAt && (
                    <span className="ml-1">
                      ({new Date(execution.emailSentAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })})
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
              <Activity className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">
                执行ID: <span className="font-mono text-xs">{execution.id}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 详细测试报告 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">详细测试报告</h2>
          </div>

          <div className="space-y-4">
            {execution.testResults && execution.testResults.map((result, index) => (
              <div
                key={index}
                className={`p-5 rounded-xl border-2 ${
                  result.status === 'pass'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center text-sm font-bold text-gray-700 shadow-sm">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{result.name}</div>
                      <div className="text-sm text-gray-600 break-all">{result.url}</div>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                      result.status === 'pass'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {result.status === 'pass' ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        通过
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        失败
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {result.statusCode && (
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">状态码</div>
                      <div className="text-lg font-bold text-gray-900">{result.statusCode}</div>
                    </div>
                  )}
                  {result.responseTime && (
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">响应时间</div>
                      <div className="text-lg font-bold text-gray-900">{result.responseTime}ms</div>
                    </div>
                  )}
                  {result.testDuration && (
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">测试耗时</div>
                      <div className="text-lg font-bold text-gray-900">{result.testDuration}ms</div>
                    </div>
                  )}
                </div>

                {/* 检查详情 */}
                {result.checkDetails && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-3">检查详情</div>
                    <div className="space-y-2">
                      {result.checkDetails.split('\n').filter(line => line.trim()).map((line, idx) => {
                        const passed = line.trim().startsWith('✓');
                        const failed = line.trim().startsWith('✗');

                        if (!passed && !failed) return null;

                        const content = line.trim().substring(1).trim();
                        const parts = content.split(':');
                        const checkName = parts[0]?.trim() || '';
                        const messageWithConfidence = parts.slice(1).join(':').trim();

                        const confidenceMatch = messageWithConfidence.match(/\[置信度:\s*([^\]]+)\]/);
                        const confidence = confidenceMatch ? confidenceMatch[1] : null;
                        const message = messageWithConfidence.replace(/\s*\[置信度:[^\]]+\]/, '').trim();

                        return (
                          <div key={idx} className={`flex items-start gap-2 p-3 rounded ${
                            passed ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            {passed ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium ${
                                passed ? 'text-green-700' : 'text-red-700'
                              }`}>{checkName}</div>
                              {message && (
                                <div className="text-xs text-gray-600 mt-1">{message}</div>
                              )}
                              {confidence && (
                                <div className="text-xs text-gray-500 mt-1">
                                  置信度: {confidence}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 错误信息 */}
                {result.errorMessage && !result.checkDetails && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-red-600 mb-1">错误信息</div>
                        <div className="text-sm text-gray-700">{result.errorMessage}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 页面截图 */}
                {result.screenshotUrl && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      页面截图
                    </div>
                    <div
                      className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                      onClick={() => setExpandedScreenshot(result.screenshotUrl!)}
                    >
                      <img
                        src={`${getFullApiUrl(result.screenshotUrl)}`}
                        alt={`${result.name}截图`}
                        className="w-full h-64 object-cover object-top"
                        loading="lazy"
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-2 text-center flex items-center justify-center gap-1">
                      <Eye className="w-4 h-4" />
                      点击预览图查看完整截图
                    </div>
                  </div>
                )}

                {/* SEO检查结果 */}
                {result.seoResults && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      SEO检查结果
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                      {/* SEO评分 */}
                      {result.seoResults.score !== undefined && (
                        <div className="flex items-center gap-3">
                          <div className={`px-5 py-3 rounded-lg font-bold text-xl ${
                            result.seoResults.score >= 80 ? 'bg-green-100 text-green-700' :
                            result.seoResults.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {result.seoResults.score}/100
                          </div>
                          <div className="text-sm text-gray-600">
                            SEO总分
                          </div>
                        </div>
                      )}

                      {/* 页面标题 */}
                      {result.seoResults.title && (
                        <div className="border-t border-gray-100 pt-3">
                          <div className="text-xs text-gray-600 mb-1">页面标题</div>
                          <div className="text-sm text-gray-900">{result.seoResults.title}</div>
                        </div>
                      )}

                      {/* Hreflang链接 */}
                      {result.seoResults.hreflangLinks && result.seoResults.hreflangLinks.length > 0 && (
                        <div className="border-t border-gray-100 pt-3">
                          <div className="text-xs text-gray-600 mb-2">
                            Hreflang链接 ({result.seoResults.hreflangLinks.length}个)
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {result.seoResults.hreflangLinks.map((link, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono font-semibold">
                                  {link.lang}
                                </span>
                                <span className="text-gray-600 truncate flex-1">{link.href}</span>
                                {link.isValid !== undefined && (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    link.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {link.isValid ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hreflang问题 */}
                      {result.seoResults.hreflangIssues && (
                        (result.seoResults.hreflangIssues.missingXDefault ||
                         (result.seoResults.hreflangIssues.duplicateLangs && result.seoResults.hreflangIssues.duplicateLangs.length > 0) ||
                         (result.seoResults.hreflangIssues.invalidUrls && result.seoResults.hreflangIssues.invalidUrls.length > 0))
                      ) && (
                        <div className="border-t border-gray-100 pt-3">
                          <div className="text-xs text-red-600 font-semibold mb-2 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            检测到的问题
                          </div>
                          <div className="space-y-1">
                            {result.seoResults.hreflangIssues.missingXDefault && (
                              <div className="text-xs text-gray-700 p-2 bg-yellow-50 rounded">
                                ⚠️ 缺少 x-default 标签
                              </div>
                            )}
                            {result.seoResults.hreflangIssues.duplicateLangs && result.seoResults.hreflangIssues.duplicateLangs.length > 0 && (
                              <div className="text-xs text-gray-700 p-2 bg-yellow-50 rounded">
                                ⚠️ 重复的语言代码: {result.seoResults.hreflangIssues.duplicateLangs.join(', ')}
                              </div>
                            )}
                            {result.seoResults.hreflangIssues.invalidUrls && result.seoResults.hreflangIssues.invalidUrls.length > 0 && (
                              <div className="text-xs text-gray-700 p-2 bg-red-50 rounded">
                                ❌ {result.seoResults.hreflangIssues.invalidUrls.length}个无效URL
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Article信息 */}
                      {result.seoResults.article && (
                        <div className="border-t border-gray-100 pt-3">
                          <div className="text-xs text-gray-600 mb-2">Article元数据</div>
                          <div className="space-y-1 text-xs">
                            {result.seoResults.article.author && (
                              <div className="flex gap-2">
                                <span className="text-gray-600">作者:</span>
                                <span className="text-gray-900">{result.seoResults.article.author}</span>
                              </div>
                            )}
                            {result.seoResults.article.publishedTime && (
                              <div className="flex gap-2">
                                <span className="text-gray-600">发布时间:</span>
                                <span className="text-gray-900">{new Date(result.seoResults.article.publishedTime).toLocaleString('zh-CN')}</span>
                              </div>
                            )}
                            {result.seoResults.article.modifiedTime && (
                              <div className="flex gap-2">
                                <span className="text-gray-600">修改时间:</span>
                                <span className="text-gray-900">{new Date(result.seoResults.article.modifiedTime).toLocaleString('zh-CN')}</span>
                              </div>
                            )}
                            {!result.seoResults.article.author && !result.seoResults.article.publishedTime && (
                              <div className="text-gray-500">未检测到Article元数据</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 图片查看器 */}
      {expandedScreenshot && (
        <div
          className={`fixed inset-0 bg-black z-50 flex items-center justify-center ${
            isFullscreen ? '' : 'bg-opacity-95'
          }`}
          onClick={closeImageViewer}
        >
          {/* 工具栏 */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg backdrop-blur-sm transition-all"
              title="缩小"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg backdrop-blur-sm transition-all"
              title="重置"
            >
              <span className="text-sm font-medium">{(imageScale * 100).toFixed(0)}%</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg backdrop-blur-sm transition-all"
              title="放大"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(!isFullscreen);
              }}
              className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg backdrop-blur-sm transition-all"
              title="全屏"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg backdrop-blur-sm transition-all"
              title="下载"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* 图片容器 - 支持滚动查看完整截图 */}
          <div
            className={`relative overflow-auto ${isFullscreen ? 'w-full h-full' : 'max-w-[90vw] max-h-[90vh]'}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              // 自定义滚动条样式
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
            }}
          >
            <div
              className="inline-block min-w-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: imageScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              <img
                src={`${getFullApiUrl(expandedScreenshot)}`}
                alt="放大截图"
                className="w-auto h-auto max-w-none"
                style={{
                  transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  transformOrigin: 'top left',
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* 关闭提示 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-lg backdrop-blur-sm">
            按 ESC 或点击背景关闭
          </div>
        </div>
      )}
    </div>
  );
};

export default PatrolExecutionDetail;
