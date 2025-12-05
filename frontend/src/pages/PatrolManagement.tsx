import React, { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, Clock, Play, Plus, Trash2, Calendar,
  Mail, Link as LinkIcon, Activity, TrendingUp, AlertCircle,
  Zap, Shield, Globe, ChevronRight, ExternalLink,
  BarChart3, Eye, EyeOff, Loader2, Edit, ZoomIn, ZoomOut, Maximize2, Download
} from 'lucide-react';

interface PatrolUrl {
  url: string;
  name: string;
}

interface TestResult {
  url: string;
  name: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  responseTime?: number;
  testDuration?: number;
  errorMessage?: string;
  checkDetails?: string; // 检查详情
  screenshotUrl?: string; // 截图URL

  // Core Web Vitals 性能数据
  coreWebVitals?: {
    lcp?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fid?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    cls?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fcp?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    tti?: number;
    tbt?: number;
    ttfb?: number;
    domLoad?: number;
    onLoad?: number;
  };
  performanceLevel?: 'excellent' | 'good' | 'needs_improvement';
  performanceScenario?: {
    deviceType: string;
    networkType: string;
    businessType: string;
  };
}

interface PatrolTask {
  id: string;
  name: string;
  description?: string;
  urls: PatrolUrl[];
  notificationEmails: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
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
  testResults?: TestResult[];
  emailSent: boolean;
  durationMs?: number;
}

// 默认的巡检链接配置
const DEFAULT_PATROL_URLS = [
  { url: 'https://www.anker.com', name: '首页' },
  { url: 'https://www.anker.com/products', name: '产品页' },
  { url: 'https://www.anker.com/about', name: '关于我们' },
];

const PatrolManagement: React.FC = () => {
  const [tasks, setTasks] = useState<PatrolTask[]>([]);
  const [executions, setExecutions] = useState<PatrolExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<PatrolTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<PatrolExecution | null>(null);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 创建/编辑任务表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    urls: [...DEFAULT_PATROL_URLS],
    notificationEmails: [''],
    enabled: true,
    scheduleType: 'daily_morning' as 'daily_morning' | 'daily_afternoon' | 'daily_twice' | 'custom',
    customCron: '',
  });

  // 加载巡检任务列表
  const loadTasks = async () => {
    try {
      const response = await fetch('/api/v1/patrol/tasks');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('加载巡检任务失败:', error);
    }
  };

  // 加载执行历史
  const loadExecutions = async (taskId?: string) => {
    try {
      const url = taskId
        ? `/api/v1/patrol/executions?taskId=${taskId}&limit=10`
        : '/api/v1/patrol/executions?limit=20';
      const response = await fetch(url);
      const data = await response.json();
      setExecutions(data);
    } catch (error) {
      console.error('加载执行历史失败:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadTasks(), loadExecutions()]);
      setLoading(false);
    };
    loadData();

    // 定期刷新执行历史(每5秒)
    const interval = setInterval(() => {
      loadExecutions(selectedTask || undefined);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedTask]);

  // ESC键关闭截图模态框
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedScreenshot) {
        closeImageViewer();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [expandedScreenshot]);

  // 重置图片查看器状态
  const closeImageViewer = () => {
    setExpandedScreenshot(null);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setIsDragging(false);
    setIsFullscreen(false);
  };

  // 图片缩放
  const handleZoom = (delta: number) => {
    setImageScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  // 鼠标滚轮缩放 (仅在按住 Ctrl/Cmd 时触发)
  const handleWheel = (e: React.WheelEvent) => {
    // 只有按住 Ctrl 或 Cmd 键时才缩放,否则允许正常滚动
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleZoom(delta);
    }
    // 如果没有按修饰键,浏览器会自然处理滚动
  };

  // 开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageScale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  // 拖拽中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // 结束拖拽
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // 下载图片
  const downloadImage = () => {
    if (expandedScreenshot) {
      const link = document.createElement('a');
      link.href = `http://localhost:3000${expandedScreenshot}`;
      link.download = `screenshot-${Date.now()}.png`;
      link.click();
    }
  };

  // 手动执行巡检
  const handleExecute = async (taskId: string) => {
    try {
      setRunningTasks(prev => new Set(prev).add(taskId));
      const response = await fetch(`/api/v1/patrol/tasks/${taskId}/execute`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('巡检任务已开始执行,请稍候查看结果');
        setTimeout(() => {
          loadExecutions();
          setRunningTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }, 3000);
      }
    } catch (error) {
      console.error('执行巡检失败:', error);
      alert('执行巡检失败');
      setRunningTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  // 删除任务
  const handleDelete = async (taskId: string) => {
    if (!confirm('确定要删除这个巡检任务吗?')) return;

    try {
      const response = await fetch(`/api/v1/patrol/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('删除成功');
        loadTasks();
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败');
    }
  };

  // 启用/禁用任务
  const handleToggleEnabled = async (task: PatrolTask) => {
    try {
      const response = await fetch(`/api/v1/patrol/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
    }
  };

  // 打开编辑模态框
  const handleEditTask = (task: PatrolTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      description: task.description || '',
      urls: task.urls.length > 0 ? task.urls : [...DEFAULT_PATROL_URLS],
      notificationEmails: task.notificationEmails.length > 0 ? task.notificationEmails : [''],
      enabled: task.enabled,
      scheduleType: 'daily_morning',
      customCron: '',
    });
    setShowEditModal(true);
  };

  // 创建任务
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('请输入任务名称');
      return;
    }

    const validUrls = formData.urls.filter((u) => u.url.trim() && u.name.trim());
    if (validUrls.length === 0) {
      alert('请至少添加一个有效的检测URL');
      return;
    }

    const validEmails = formData.notificationEmails.filter((email) => {
      const trimmed = email.trim();
      return trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    });

    if (validEmails.length === 0) {
      alert('请至少添加一个有效的邮箱地址');
      return;
    }

    // 验证自定义cron表达式
    if (formData.scheduleType === 'custom' && !formData.customCron.trim()) {
      alert('请输入有效的Cron表达式');
      return;
    }

    try {
      // 创建巡检任务
      const taskResponse = await fetch('/api/v1/patrol/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          urls: validUrls,
          notificationEmails: validEmails,
          enabled: formData.enabled,
        }),
      });

      if (!taskResponse.ok) {
        const error = await taskResponse.json();
        alert(`创建任务失败: ${error.message || '未知错误'}`);
        return;
      }

      const createdTask = await taskResponse.json();

      // 根据选择的调度类型生成cron表达式
      let cronExpression = '';
      switch (formData.scheduleType) {
        case 'daily_morning':
          cronExpression = '0 9 * * *'; // 每天早上9点
          break;
        case 'daily_afternoon':
          cronExpression = '0 14 * * *'; // 每天下午2点
          break;
        case 'daily_twice':
          cronExpression = '0 9,14 * * *'; // 每天早上9点和下午2点
          break;
        case 'custom':
          cronExpression = formData.customCron.trim();
          break;
      }

      // 创建调度配置
      const scheduleResponse = await fetch('/api/v1/patrol/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patrolTaskId: createdTask.id,
          cronExpression,
          scheduleType: formData.scheduleType,
          timeZone: 'Asia/Shanghai',
          enabled: formData.enabled,
        }),
      });

      if (!scheduleResponse.ok) {
        console.error('创建调度配置失败,但任务已创建成功');
        alert('任务创建成功,但调度配置创建失败,请手动配置');
      } else {
        alert('创建成功');
      }

      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        urls: [...DEFAULT_PATROL_URLS],
        notificationEmails: [''],
        enabled: true,
        scheduleType: 'daily_morning',
        customCron: '',
      });
      loadTasks();
    } catch (error) {
      console.error('创建任务失败:', error);
      alert('创建任务失败');
    }
  };

  // 更新任务
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTask) return;

    if (!formData.name.trim()) {
      alert('请输入任务名称');
      return;
    }

    const validUrls = formData.urls.filter((u) => u.url.trim() && u.name.trim());
    if (validUrls.length === 0) {
      alert('请至少添加一个有效的检测URL');
      return;
    }

    const validEmails = formData.notificationEmails.filter((email) => {
      const trimmed = email.trim();
      return trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    });

    if (validEmails.length === 0) {
      alert('请至少添加一个有效的邮箱地址');
      return;
    }

    try {
      const response = await fetch(`/api/v1/patrol/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          urls: validUrls,
          notificationEmails: validEmails,
          enabled: formData.enabled,
        }),
      });

      if (response.ok) {
        alert('更新成功');
        setShowEditModal(false);
        setEditingTask(null);
        setFormData({
          name: '',
          description: '',
          urls: [...DEFAULT_PATROL_URLS],
          notificationEmails: [''],
          enabled: true,
          scheduleType: 'daily_morning',
          customCron: '',
        });
        loadTasks();
      } else {
        const error = await response.json();
        alert(`更新失败: ${error.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新任务失败:', error);
      alert('更新任务失败');
    }
  };

  // URL 相关操作
  const handleAddUrl = () => {
    setFormData({ ...formData, urls: [...formData.urls, { url: '', name: '' }] });
  };

  const handleRemoveUrl = (index: number) => {
    const newUrls = formData.urls.filter((_, i) => i !== index);
    setFormData({ ...formData, urls: newUrls });
  };

  const handleUpdateUrl = (index: number, field: 'url' | 'name', value: string) => {
    const newUrls = [...formData.urls];
    newUrls[index][field] = value;
    setFormData({ ...formData, urls: newUrls });
  };

  // 邮箱相关操作
  const handleAddEmail = () => {
    setFormData({ ...formData, notificationEmails: [...formData.notificationEmails, ''] });
  };

  const handleRemoveEmail = (index: number) => {
    const newEmails = formData.notificationEmails.filter((_, i) => i !== index);
    setFormData({ ...formData, notificationEmails: newEmails });
  };

  const handleUpdateEmail = (index: number, value: string) => {
    const newEmails = [...formData.notificationEmails];
    newEmails[index] = value;
    setFormData({ ...formData, notificationEmails: newEmails });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* 页头区域 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                日常巡检管理
              </h1>
              <p className="text-gray-600 mt-1">自动化监控网站可用性,及时发现问题并通知相关人员</p>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">总任务数</p>
                <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">已启用</p>
                <p className="text-3xl font-bold text-green-600">{tasks.filter((t) => t.enabled).length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">检测URL</p>
                <p className="text-3xl font-bold text-purple-600">
                  {tasks.reduce((sum, t) => sum + t.urls.length, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">执行记录</p>
                <p className="text-3xl font-bold text-orange-600">{executions.length}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 操作栏 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">巡检任务</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {tasks.length} 个任务
            </span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">创建任务</span>
          </button>
        </div>

        {/* 任务列表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {tasks.map((task) => {
            const isRunning = runningTasks.has(task.id);
            return (
              <div
                key={task.id}
                className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* 任务头部 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{task.name}</h3>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${
                          task.enabled
                            ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {task.enabled ? (
                          <>
                            <Zap className="w-3 h-3" />
                            运行中
                          </>
                        ) : (
                          '已停止'
                        )}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
                    )}
                  </div>
                </div>

                {/* 任务详情 */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <LinkIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-0.5">检测URL</p>
                      <p className="text-sm font-semibold text-gray-900">{task.urls.length} 个链接</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Mail className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 mb-0.5">通知邮箱</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {task.notificationEmails.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* URL列表 */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase">检测列表</span>
                  </div>
                  <div className="space-y-2">
                    {task.urls.map((urlConfig, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-2 bg-white rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{urlConfig.name}</div>
                          <div className="text-xs text-gray-500 truncate">{urlConfig.url}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleExecute(task.id)}
                    disabled={isRunning}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl transition-all shadow-sm hover:shadow-md font-medium ${
                      isRunning
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600'
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        执行中
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        执行
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEditTask(task)}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm hover:shadow-md font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(task)}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all font-medium"
                  >
                    {task.enabled ? '暂停' : '启用'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTask(task.id);
                      loadExecutions(task.id);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm hover:shadow-md font-medium"
                  >
                    <Calendar className="w-4 h-4" />
                    历史
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all shadow-sm hover:shadow-md font-medium col-span-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 执行历史 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedTask ? '任务执行历史' : '最近执行记录'}
              </h2>
            </div>
            {selectedTask && (
              <button
                onClick={() => {
                  setSelectedTask(null);
                  loadExecutions();
                }}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                查看全部
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {executions.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">暂无执行记录</p>
              <p className="text-sm text-gray-400 mt-1">执行任务后将在这里显示结果</p>
            </div>
          ) : (
            <div className="space-y-4">
              {executions.map((execution) => {
                const task = tasks.find((t) => t.id === execution.patrolTaskId);
                const passRate =
                  execution.totalUrls > 0
                    ? ((execution.passedUrls / execution.totalUrls) * 100).toFixed(1)
                    : '0';
                const isExpanded = selectedExecution?.id === execution.id;

                return (
                  <div
                    key={execution.id}
                    className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-all"
                  >
                    {/* 执行概要 */}
                    <div
                      className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer"
                      onClick={() => setSelectedExecution(isExpanded ? null : execution)}
                    >
                      {/* 状态图标 */}
                      <div className="flex-shrink-0">
                        {execution.status === 'completed' ? (
                          execution.failedUrls === 0 ? (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                              <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                              <AlertCircle className="w-6 h-6 text-white" />
                            </div>
                          )
                        ) : execution.status === 'failed' ? (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg">
                            <XCircle className="w-6 h-6 text-white" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                            <Clock className="w-6 h-6 text-white animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* 执行信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">{task?.name || '未知任务'}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(execution.startedAt).toLocaleString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-600">{passRate}%</span>
                            <span className="text-gray-600">通过率</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-gray-900">
                              {execution.passedUrls}/{execution.totalUrls}
                            </span>
                            <span className="text-gray-600">通过</span>
                          </div>
                          {execution.durationMs && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm">
                              <Clock className="w-4 h-4 text-purple-600" />
                              <span className="font-semibold text-gray-900">
                                {(execution.durationMs / 1000).toFixed(1)}s
                              </span>
                            </div>
                          )}
                          {execution.emailSent && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg shadow-sm">
                              <Mail className="w-4 h-4" />
                              <span className="text-xs font-medium">已发送</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 展开/收起按钮 */}
                      <button className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        {isExpanded ? (
                          <EyeOff className="w-5 h-5 text-gray-600" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {/* 详细测试结果 */}
                    {isExpanded && execution.testResults && (
                      <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-lg font-bold text-gray-900">详细测试报告</h3>
                        </div>

                        <div className="space-y-3">
                          {execution.testResults.map((result, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-xl border-2 ${
                                result.status === 'pass'
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-red-50 border-red-200'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-gray-700 shadow-sm">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <div className="font-bold text-gray-900">{result.name}</div>
                                    <div className="text-sm text-gray-600 truncate max-w-md">{result.url}</div>
                                  </div>
                                </div>
                                <div
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${
                                    result.status === 'pass'
                                      ? 'bg-green-500 text-white'
                                      : 'bg-red-500 text-white'
                                  }`}
                                >
                                  {result.status === 'pass' ? (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      通过
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4" />
                                      失败
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 mt-3">
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

                              {/* Core Web Vitals 性能指标 */}
                              {result.coreWebVitals && (
                                <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Activity className="w-4 h-4 text-blue-600" />
                                    <div className="text-sm font-bold text-blue-900">
                                      Core Web Vitals 性能指标
                                      {result.performanceLevel && (
                                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                                          result.performanceLevel === 'excellent' ? 'bg-green-500 text-white' :
                                          result.performanceLevel === 'good' ? 'bg-yellow-500 text-white' :
                                          'bg-orange-500 text-white'
                                        }`}>
                                          {result.performanceLevel === 'excellent' ? '优秀' :
                                           result.performanceLevel === 'good' ? '良好' : '需优化'}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Core Metrics (LCP, FID, CLS) */}
                                  <div className="grid grid-cols-3 gap-2 mb-2">
                                    {result.coreWebVitals.lcp && (
                                      <div className={`bg-white rounded p-2 border-2 ${
                                        result.coreWebVitals.lcp.rating === 'good' ? 'border-green-300' :
                                        result.coreWebVitals.lcp.rating === 'needs-improvement' ? 'border-yellow-300' :
                                        'border-red-300'
                                      }`}>
                                        <div className="text-xs text-gray-600 mb-0.5">LCP (最大内容绘制)</div>
                                        <div className="text-sm font-bold text-gray-900">
                                          {result.coreWebVitals.lcp.value.toFixed(0)}ms
                                        </div>
                                      </div>
                                    )}
                                    {result.coreWebVitals.fid && (
                                      <div className={`bg-white rounded p-2 border-2 ${
                                        result.coreWebVitals.fid.rating === 'good' ? 'border-green-300' :
                                        result.coreWebVitals.fid.rating === 'needs-improvement' ? 'border-yellow-300' :
                                        'border-red-300'
                                      }`}>
                                        <div className="text-xs text-gray-600 mb-0.5">FID (首次输入延迟)</div>
                                        <div className="text-sm font-bold text-gray-900">
                                          {result.coreWebVitals.fid.value.toFixed(0)}ms
                                        </div>
                                      </div>
                                    )}
                                    {result.coreWebVitals.cls && (
                                      <div className={`bg-white rounded p-2 border-2 ${
                                        result.coreWebVitals.cls.rating === 'good' ? 'border-green-300' :
                                        result.coreWebVitals.cls.rating === 'needs-improvement' ? 'border-yellow-300' :
                                        'border-red-300'
                                      }`}>
                                        <div className="text-xs text-gray-600 mb-0.5">CLS (累积布局偏移)</div>
                                        <div className="text-sm font-bold text-gray-900">
                                          {result.coreWebVitals.cls.value.toFixed(3)}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Auxiliary Metrics (FCP, TTI, TBT) */}
                                  <div className="grid grid-cols-3 gap-2">
                                    {result.coreWebVitals.fcp && (
                                      <div className="bg-white rounded p-2">
                                        <div className="text-xs text-gray-500 mb-0.5">FCP</div>
                                        <div className="text-xs font-semibold text-gray-700">
                                          {result.coreWebVitals.fcp.value.toFixed(0)}ms
                                        </div>
                                      </div>
                                    )}
                                    {result.coreWebVitals.tti && (
                                      <div className="bg-white rounded p-2">
                                        <div className="text-xs text-gray-500 mb-0.5">TTI</div>
                                        <div className="text-xs font-semibold text-gray-700">
                                          {result.coreWebVitals.tti.toFixed(0)}ms
                                        </div>
                                      </div>
                                    )}
                                    {result.coreWebVitals.tbt !== undefined && (
                                      <div className="bg-white rounded p-2">
                                        <div className="text-xs text-gray-500 mb-0.5">TBT</div>
                                        <div className="text-xs font-semibold text-gray-700">
                                          {result.coreWebVitals.tbt.toFixed(0)}ms
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Scenario info */}
                                  {result.performanceScenario && (
                                    <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                                      <Globe className="w-3 h-3" />
                                      评估场景: {result.performanceScenario.deviceType} / {result.performanceScenario.networkType} / {result.performanceScenario.businessType}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 检查详情 - 始终显示 */}
                              {result.checkDetails && (
                                <div className={`mt-3 p-3 bg-white rounded-lg border ${
                                  result.status === 'pass' ? 'border-green-200' : 'border-red-200'
                                }`}>
                                  <div className="flex items-start gap-2">
                                    {result.status === 'pass' ? (
                                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                      <div className={`text-xs font-semibold mb-1 ${
                                        result.status === 'pass' ? 'text-green-600' : 'text-red-600'
                                      }`}>检查详情</div>
                                      <div className="text-sm text-gray-700 whitespace-pre-line">{result.checkDetails}</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 错误信息（仅失败时的额外信息） */}
                              {result.errorMessage && !result.checkDetails && (
                                <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <div className="text-xs font-semibold text-red-600 mb-1">错误信息</div>
                                      <div className="text-sm text-gray-700">{result.errorMessage}</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 页面截图 */}
                              {result.screenshotUrl && (
                                <div className="mt-4">
                                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    页面截图
                                  </div>
                                  <div
                                    className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                                    onClick={() => setExpandedScreenshot(result.screenshotUrl!)}
                                  >
                                    <img
                                      src={`http://localhost:3000${result.screenshotUrl}`}
                                      alt={`${result.name}截图`}
                                      className="w-full h-48 object-cover object-top"
                                      loading="lazy"
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1 text-center flex items-center justify-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    点击预览图查看完整截图
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 测试统计 */}
                        <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                          <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{execution.totalUrls}</div>
                              <div className="text-xs text-gray-600 mt-1">总计</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">{execution.passedUrls}</div>
                              <div className="text-xs text-gray-600 mt-1">通过</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">{execution.failedUrls}</div>
                              <div className="text-xs text-gray-600 mt-1">失败</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-indigo-600">{passRate}%</div>
                              <div className="text-xs text-gray-600 mt-1">通过率</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 创建任务模态框 */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">创建巡检任务</h2>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      任务名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="例如: 官网日常巡检"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      任务描述
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="描述这个巡检任务的目的和内容"
                      rows={3}
                    />
                  </div>
                </div>

                {/* 检测URL列表 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      检测URL列表 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddUrl}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      添加URL
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.urls.map((urlConfig, index) => (
                      <div key={index} className="flex gap-2 items-start group">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={urlConfig.name}
                            onChange={(e) => handleUpdateUrl(index, 'name', e.target.value)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="名称 (例如: 首页)"
                            required
                          />
                          <input
                            type="url"
                            value={urlConfig.url}
                            onChange={(e) => handleUpdateUrl(index, 'url', e.target.value)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="URL (例如: https://www.example.com)"
                            required
                          />
                        </div>
                        {formData.urls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveUrl(index)}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    系统将定期检测这些URL的可用性
                  </p>
                </div>

                {/* 通知邮箱列表 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      通知邮箱 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      添加邮箱
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.notificationEmails.map((email, index) => (
                      <div key={index} className="flex gap-2 group">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleUpdateEmail(index, e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="example@company.com"
                          required
                        />
                        {formData.notificationEmails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(index)}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    巡检报告将发送到这些邮箱地址
                  </p>
                </div>

                {/* 调度时间 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    巡检调度时间
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'daily_morning' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'daily_morning'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold">每日早上</div>
                      <div className="text-xs text-gray-500 mt-1">09:00 AM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'daily_afternoon' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'daily_afternoon'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold">每日下午</div>
                      <div className="text-xs text-gray-500 mt-1">02:00 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'daily_twice' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'daily_twice'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold">每日两次</div>
                      <div className="text-xs text-gray-500 mt-1">09:00 AM & 02:00 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'custom' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'custom'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold">自定义</div>
                      <div className="text-xs text-gray-500 mt-1">Cron 表达式</div>
                    </button>
                  </div>
                  {formData.scheduleType === 'custom' && (
                    <input
                      type="text"
                      value={formData.customCron}
                      onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
                      className="mt-3 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="例如: 0 9,14 * * * (每天09:00和14:00执行)"
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    选择任务的定时执行时间,启用后将自动按时执行
                  </p>
                </div>

                {/* 启用状态 */}
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="enabled" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    创建后立即启用(将参与定时调度)
                  </label>
                </div>

                {/* 按钮组 */}
                <div className="flex gap-3 pt-6 border-t-2 border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium"
                  >
                    创建任务
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 编辑任务模态框 */}
        {showEditModal && editingTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={() => {
              setShowEditModal(false);
              setEditingTask(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">编辑巡检任务</h2>
              </div>

              <form onSubmit={handleUpdateTask} className="space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      任务名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      placeholder="例如: 官网日常巡检"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      任务描述
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                      placeholder="描述这个巡检任务的目的和内容"
                      rows={3}
                    />
                  </div>
                </div>

                {/* 检测URL列表 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      检测URL列表 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddUrl}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      添加URL
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.urls.map((urlConfig, index) => (
                      <div key={index} className="flex gap-2 items-start group">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={urlConfig.name}
                            onChange={(e) => handleUpdateUrl(index, 'name', e.target.value)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                            placeholder="名称 (例如: 首页)"
                            required
                          />
                          <input
                            type="url"
                            value={urlConfig.url}
                            onChange={(e) => handleUpdateUrl(index, 'url', e.target.value)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                            placeholder="URL (例如: https://www.example.com)"
                            required
                          />
                        </div>
                        {formData.urls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveUrl(index)}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    系统将定期检测这些URL的可用性
                  </p>
                </div>

                {/* 通知邮箱列表 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      通知邮箱 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      添加邮箱
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.notificationEmails.map((email, index) => (
                      <div key={index} className="flex gap-2 group">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleUpdateEmail(index, e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                          placeholder="example@company.com"
                          required
                        />
                        {formData.notificationEmails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(index)}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    巡检报告将发送到这些邮箱地址
                  </p>
                </div>

                {/* 调度时间 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    巡检调度时间
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'daily_morning' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'daily_morning'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="font-semibold">每日早上</div>
                      <div className="text-xs text-gray-500 mt-1">09:00 AM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'daily_afternoon' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'daily_afternoon'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="font-semibold">每日下午</div>
                      <div className="text-xs text-gray-500 mt-1">02:00 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'daily_twice' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'daily_twice'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="font-semibold">每日两次</div>
                      <div className="text-xs text-gray-500 mt-1">09:00 AM & 02:00 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: 'custom' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.scheduleType === 'custom'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="font-semibold">自定义</div>
                      <div className="text-xs text-gray-500 mt-1">Cron 表达式</div>
                    </button>
                  </div>
                  {formData.scheduleType === 'custom' && (
                    <input
                      type="text"
                      value={formData.customCron}
                      onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
                      className="mt-3 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      placeholder="例如: 0 9,14 * * * (每天09:00和14:00执行)"
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    选择任务的定时执行时间,启用后将自动按时执行
                  </p>
                </div>

                {/* 启用状态 */}
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="editEnabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-2 focus:ring-amber-500"
                  />
                  <label htmlFor="editEnabled" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    启用任务(将参与定时调度)
                  </label>
                </div>

                {/* 按钮组 */}
                <div className="flex gap-3 pt-6 border-t-2 border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingTask(null);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl font-medium"
                  >
                    保存更改
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* 增强版截图查看器 */}
      {expandedScreenshot && (
        <div
          className={`fixed inset-0 bg-black ${isFullscreen ? 'bg-opacity-100' : 'bg-opacity-95'} flex items-center justify-center z-[9999] select-none`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeImageViewer();
            }
          }}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* 工具栏 */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-90 rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl z-10">
            {/* 缩放控制 */}
            <div className="flex items-center gap-2 border-r border-gray-700 pr-4">
              <button
                onClick={() => handleZoom(-0.2)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="缩小 (Ctrl + -)"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
              <span className="text-white font-mono text-sm min-w-[60px] text-center">
                {Math.round(imageScale * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.2)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="放大 (Ctrl + +)"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => {
                  setImageScale(1);
                  setImagePosition({ x: 0, y: 0 });
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-white text-xs"
                title="重置 (Ctrl + 0)"
              >
                重置
              </button>
            </div>

            {/* 其他控制 */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title={isFullscreen ? "退出全屏" : "全屏查看"}
              >
                <Maximize2 className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={downloadImage}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="下载图片"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={closeImageViewer}
                className="p-2 hover:bg-red-600 rounded-lg transition-colors ml-2"
                title="关闭 (ESC)"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* 图片容器 */}
          <div
            className={`relative ${isFullscreen ? 'w-full h-full' : 'w-[90vw] h-[90vh]'} overflow-auto`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : imageScale > 1 ? 'grab' : 'default' }}
          >
            <div className="min-h-full flex items-start justify-center p-4">
              <img
                src={`http://localhost:3000${expandedScreenshot}`}
                alt="完整截图"
                className="transition-transform duration-200"
                style={{
                  maxWidth: imageScale === 1 ? '100%' : 'none',
                  width: imageScale === 1 ? '100%' : 'auto',
                  height: 'auto',
                  display: 'block',
                  transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                  transformOrigin: 'top center',
                }}
                draggable={false}
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  console.error('Screenshot load error:', expandedScreenshot);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'text-white text-center p-8 bg-red-500 rounded-lg';
                  errorDiv.textContent = '截图加载失败';
                  target.parentElement?.appendChild(errorDiv);
                }}
              />
            </div>
          </div>

          {/* 提示信息 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-75 rounded-lg px-4 py-2 text-white text-sm">
            💡 滚轮滚动 · Ctrl+滚轮缩放 · 拖动查看 · ESC 关闭
          </div>
        </div>
      )}
      </div>

      {/* 添加自定义动画样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PatrolManagement;
