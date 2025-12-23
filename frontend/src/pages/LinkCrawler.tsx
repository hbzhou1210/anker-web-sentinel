/**
 * 链接爬取工具页面
 *
 * 功能:
 * - 输入起始 URL 和最大爬取深度
 * - 启动链接爬取任务
 * - 实时显示爬取进度
 * - 按层级展示爬取到的链接
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import './LinkCrawler.css';

// 类型定义
interface CrawledLink {
  url: string;
  title?: string;
  level: number;
  parentUrl?: string;
  statusCode?: number;
  error?: string;
  crawledAt: string;
}

interface LinkCrawlTask {
  id: string;
  startUrl: string;
  maxDepth: number;
  mode?: 'crawl' | '404check' | 'csv';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  totalLinks: number;
  crawledLinks: number;
  links: CrawledLink[];
  stats?: {
    total404: number;
    total200: number;
    totalOther: number;
  };
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

// API 基础 URL
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return '/api/v1';
  }
  return 'http://localhost:3000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

const LinkCrawler: React.FC = () => {
  const [mode, setMode] = useState<'crawl' | '404check' | 'csv'>('crawl');
  const [startUrl, setStartUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUrls, setCsvUrls] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // 获取所有任务列表
  const { data: tasks = [] } = useQuery<LinkCrawlTask[]>({
    queryKey: ['link-crawler-tasks'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/link-crawler`);
      return response.data;
    },
    refetchInterval: 2000, // 每2秒刷新一次
  });

  // 获取选中任务的详情
  const { data: selectedTask } = useQuery<LinkCrawlTask>({
    queryKey: ['link-crawler-task', selectedTaskId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/link-crawler/${selectedTaskId}`);
      return response.data;
    },
    enabled: !!selectedTaskId,
    refetchInterval: (query) => {
      const task = query.state.data;
      return task?.status === 'running' ? 1000 : false;
    },
  });

  // 创建爬取任务
  const createTaskMutation = useMutation({
    mutationFn: async (data: { mode: string; startUrl?: string; maxDepth?: number; urls?: string[] }) => {
      const response = await axios.post(`${API_BASE_URL}/link-crawler`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['link-crawler-tasks'] });
      setSelectedTaskId(data.id);
      setStartUrl('');
      setCsvFile(null);
      setCsvUrls([]);
    },
  });

  // 删除任务
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await axios.delete(`${API_BASE_URL}/link-crawler/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-crawler-tasks'] });
      if (selectedTaskId) {
        setSelectedTaskId(null);
      }
    },
  });

  // 暂停任务
  const pauseTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await axios.post(`${API_BASE_URL}/link-crawler/${taskId}/pause`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-crawler-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['link-crawler-task', selectedTaskId] });
    },
  });

  // 恢复任务
  const resumeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await axios.post(`${API_BASE_URL}/link-crawler/${taskId}/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-crawler-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['link-crawler-task', selectedTaskId] });
    },
  });

  // 下载CSV模版
  const downloadCsvTemplate = () => {
    // 创建CSV模版内容
    const templateContent = `URL,Description
https://example.com,Example Site 1
https://example.com/page1,Example Page 1
https://example.com/page2,Example Page 2
https://another-example.com,Another Example Site

# 说明:
# 1. 第一行为表头,可以保留或删除
# 2. 第一列为要检查的URL (必填)
# 3. 第二列为描述信息 (可选)
# 4. 以 # 开头的行会被忽略
# 5. 每行一个URL
`;

    // 创建Blob对象
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });

    // 创建下载链接
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'url-check-template.csv');
    link.style.visibility = 'hidden';

    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 释放URL对象
    URL.revokeObjectURL(url);
  };

  // 处理CSV文件上传
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);

      // 解析CSV,提取URL列(假设第一列是URL或直接是URL列表)
      const urls = lines
        .filter(line => line.startsWith('http://') || line.startsWith('https://'))
        .map(line => {
          // 如果是CSV格式,取第一个逗号前的内容
          const parts = line.split(',');
          return parts[0].trim();
        });

      setCsvUrls(urls);
    };
    reader.readAsText(file);
  };

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'csv') {
      if (csvUrls.length === 0) {
        alert('请上传包含URL的CSV文件');
        return;
      }
      createTaskMutation.mutate({ mode: 'csv', urls: csvUrls });
    } else {
      if (!startUrl.trim()) {
        alert('请输入URL');
        return;
      }

      if (mode === 'crawl') {
        createTaskMutation.mutate({ mode: 'crawl', startUrl: startUrl.trim(), maxDepth });
      } else {
        createTaskMutation.mutate({ mode: '404check', startUrl: startUrl.trim() });
      }
    }
  };

  // 导出为TXT
  const exportToTxt = () => {
    if (!displayTask) return;

    const failedLinks = displayTask.links.filter(link => link.statusCode === 404 || link.error);

    let content = `链接检测报告\n`;
    content += `检测时间: ${new Date(displayTask.startedAt).toLocaleString()}\n`;
    content += `主页面: ${displayTask.startUrl}\n\n`;

    if (displayTask.stats) {
      content += `统计信息:\n`;
      content += `- 总链接数: ${displayTask.totalLinks}\n`;
      content += `- 正常 (200): ${displayTask.stats.total200}\n`;
      content += `- 失效 (404): ${displayTask.stats.total404}\n`;
      content += `- 其他状态: ${displayTask.stats.totalOther}\n\n`;
    }

    content += `失效链接列表 (${failedLinks.length} 个):\n`;
    content += `${'='.repeat(80)}\n`;

    failedLinks.forEach((link, index) => {
      content += `\n${index + 1}. ${link.url}\n`;
      content += `   状态: ${link.statusCode || '错误'}\n`;
      if (link.error) {
        content += `   错误: ${link.error}\n`;
      }
      if (link.parentUrl) {
        content += `   来源: ${link.parentUrl}\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-check-report-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导出为CSV
  const exportToCsv = () => {
    if (!displayTask) return;

    const failedLinks = displayTask.links.filter(link => link.statusCode === 404 || link.error);

    let csv = 'URL,状态码,错误信息,来源页面,检测时间\n';

    failedLinks.forEach(link => {
      const url = `"${link.url}"`;
      const statusCode = link.statusCode || '';
      const error = link.error ? `"${link.error.replace(/"/g, '""')}"` : '';
      const parentUrl = link.parentUrl ? `"${link.parentUrl}"` : '';
      const crawledAt = new Date(link.crawledAt).toLocaleString();

      csv += `${url},${statusCode},${error},${parentUrl},${crawledAt}\n`;
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // \ufeff 是 BOM,确保 Excel 正确识别
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed-links-${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 复制失效链接
  const copyFailedLinks = () => {
    if (!displayTask) return;

    const failedLinks = displayTask.links.filter(link => link.statusCode === 404 || link.error);
    const text = failedLinks.map(link => link.url).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      alert('已复制失效链接到剪贴板');
    });
  };

  // 按层级分组链接
  const groupLinksByLevel = (links: CrawledLink[]) => {
    const grouped: Record<number, CrawledLink[]> = {};
    links.forEach((link) => {
      if (!grouped[link.level]) {
        grouped[link.level] = [];
      }
      grouped[link.level].push(link);
    });
    return grouped;
  };

  const displayTask = selectedTask || (tasks.length > 0 ? tasks[0] : null);
  const groupedLinks = displayTask ? groupLinksByLevel(displayTask.links) : {};
  const failedLinks = displayTask ? displayTask.links.filter(link => link.statusCode === 404 || link.error) : [];

  return (
    <div className="link-crawler">
      <div className="page-header">
        <h1>链接爬取工具</h1>
        <p className="subtitle">支持链接爬取、404检查和CSV批量导入</p>
      </div>

      {/* 模式选择 */}
      <div className="crawler-form-section">
        <div className="mode-selector" style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>选择模式:</label>
          <div style={{ display: 'flex', gap: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="crawl"
                checked={mode === 'crawl'}
                onChange={(e) => setMode(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>🔍 链接爬取 (多级递归)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="404check"
                checked={mode === '404check'}
                onChange={(e) => setMode(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>🚨 404排查 (主页+子链接)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="csv"
                checked={mode === 'csv'}
                onChange={(e) => setMode(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>📄 CSV批量检查</span>
            </label>
          </div>
        </div>

        {/* 创建任务表单 */}
        <form onSubmit={handleSubmit} className="crawler-form">
          {mode !== 'csv' ? (
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="startUrl">
                  {mode === 'crawl' ? '起始 URL' : '检查 URL'}
                </label>
                <input
                  type="url"
                  id="startUrl"
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </div>

              {mode === 'crawl' && (
                <div className="form-group">
                  <label htmlFor="maxDepth">爬取深度</label>
                  <select
                    id="maxDepth"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                  >
                    <option value={1}>1 级</option>
                    <option value={2}>2 级(推荐)</option>
                    <option value={3}>3 级</option>
                    <option value={4}>4 级</option>
                    <option value={5}>5 级(最大)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={createTaskMutation.isPending || !startUrl.trim()}
              >
                {createTaskMutation.isPending ? '创建中...' : mode === 'crawl' ? '开始爬取' : '开始检查'}
              </button>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="csvFile">上传CSV文件</label>
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    style={{
                      padding: '4px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📥 下载模版
                  </button>
                </div>
                <input
                  type="file"
                  id="csvFile"
                  accept=".csv,.txt"
                  onChange={handleCsvUpload}
                  style={{ padding: '8px' }}
                />
                {csvUrls.length > 0 && (
                  <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                    已解析 {csvUrls.length} 个URL
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={createTaskMutation.isPending || csvUrls.length === 0}
              >
                {createTaskMutation.isPending ? '创建中...' : '开始批量检查'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="tasks-section">
          <h2>检测任务</h2>
          <div className="tasks-list">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`task-card ${selectedTaskId === task.id ? 'selected' : ''}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="task-header">
                  <span className={`status-badge status-${task.status}`}>
                    {task.status === 'running' ? '进行中' :
                     task.status === 'paused' ? '已暂停' :
                     task.status === 'completed' ? '已完成' :
                     task.status === 'failed' ? '失败' : '等待中'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                    {task.mode === 'crawl' ? '🔍 爬取' : task.mode === '404check' ? '🚨 404检查' : '📄 CSV检查'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    {task.status === 'running' && (
                      <button
                        className="btn-pause"
                        onClick={(e) => {
                          e.stopPropagation();
                          pauseTaskMutation.mutate(task.id);
                        }}
                        style={{
                          padding: '4px 12px',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ⏸ 暂停
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        className="btn-resume"
                        onClick={(e) => {
                          e.stopPropagation();
                          resumeTaskMutation.mutate(task.id);
                        }}
                        style={{
                          padding: '4px 12px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ▶ 恢复
                      </button>
                    )}
                    <button
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTaskMutation.mutate(task.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="task-url">{task.startUrl}</div>
                <div className="task-stats">
                  {task.mode === 'crawl' && <span>深度: {task.maxDepth}</span>}
                  <span>链接: {task.crawledLinks}/{task.totalLinks || '?'}</span>
                  {task.stats && (
                    <>
                      <span style={{ color: '#10b981' }}>✓ {task.stats.total200}</span>
                      <span style={{ color: '#ef4444' }}>✗ {task.stats.total404}</span>
                    </>
                  )}
                  {task.durationMs && (
                    <span>耗时: {(task.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 检测结果 */}
      {displayTask && (
        <div className="results-section">
          <div className="results-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>检测结果</h2>
              {displayTask.status === 'running' && (
                <div className="progress-info">
                  <span>正在检测... {displayTask.crawledLinks}/{displayTask.totalLinks || '?'} 个链接</span>
                  <div className="spinner"></div>
                  <button
                    onClick={() => pauseTaskMutation.mutate(displayTask.id)}
                    style={{
                      marginLeft: '15px',
                      padding: '6px 16px',
                      background: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    ⏸ 暂停任务
                  </button>
                </div>
              )}
              {displayTask.status === 'paused' && (
                <div className="progress-info">
                  <span style={{ color: '#f59e0b' }}>任务已暂停 - {displayTask.crawledLinks} 个链接已爬取</span>
                  <button
                    onClick={() => resumeTaskMutation.mutate(displayTask.id)}
                    style={{
                      marginLeft: '15px',
                      padding: '6px 16px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    ▶ 恢复任务
                  </button>
                </div>
              )}
              {displayTask.status === 'completed' && displayTask.stats && (
                <div style={{ marginTop: '10px', fontSize: '14px' }}>
                  <span style={{ marginRight: '20px' }}>总计: {displayTask.totalLinks}</span>
                  <span style={{ marginRight: '20px', color: '#10b981' }}>✓ 正常: {displayTask.stats.total200}</span>
                  <span style={{ marginRight: '20px', color: '#ef4444' }}>✗ 失效: {displayTask.stats.total404}</span>
                  <span style={{ color: '#f59e0b' }}>⚠ 其他: {displayTask.stats.totalOther}</span>
                </div>
              )}
            </div>

            {displayTask.status === 'completed' && failedLinks.length > 0 && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={copyFailedLinks}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📋 复制失效链接
                </button>
                <button
                  onClick={exportToTxt}
                  style={{
                    padding: '8px 16px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  💾 导出TXT
                </button>
                <button
                  onClick={exportToCsv}
                  style={{
                    padding: '8px 16px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📊 导出CSV
                </button>
              </div>
            )}
          </div>

          {displayTask.errorMessage && (
            <div className="error-message">
              错误: {displayTask.errorMessage}
            </div>
          )}

          {/* 表格式展示失效链接 */}
          {displayTask.status === 'completed' && (
            <div style={{ marginTop: '20px' }}>
              {failedLinks.length > 0 ? (
                <>
                  <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#ef4444' }}>
                    ⚠️ 失效链接列表 ({failedLinks.length} 个)
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', width: '60px' }}>#</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>URL</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '100px' }}>状态</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', width: '300px' }}>错误信息</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', width: '200px' }}>来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failedLinks.map((link, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px', color: '#6b7280' }}>{index + 1}</td>
                            <td style={{ padding: '12px' }}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#3b82f6', textDecoration: 'none', wordBreak: 'break-all' }}
                              >
                                {link.url}
                              </a>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                background: link.statusCode === 404 ? '#fee2e2' : '#fef3c7',
                                color: link.statusCode === 404 ? '#991b1b' : '#92400e',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '600'
                              }}>
                                {link.statusCode || '错误'}
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                              {link.error || '-'}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#9ca3af', wordBreak: 'break-all' }}>
                              {link.parentUrl || displayTask.startUrl}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  border: '2px solid #10b981'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
                  <h3 style={{ color: '#10b981', marginBottom: '5px' }}>检测完成,未发现失效链接!</h3>
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    所有 {displayTask.totalLinks} 个链接均正常访问
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 原有的层级展示(仅在爬取模式下显示) */}
          {displayTask.mode === 'crawl' && displayTask.status === 'completed' && (
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>
                📋 完整链接列表(按层级)
              </h3>
              <div className="links-by-level">
                {Object.keys(groupedLinks)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((level) => (
                    <div key={level} className="level-section">
                      <h3 className="level-title">
                        第 {level} 级 ({groupedLinks[level].length} 个链接)
                      </h3>
                      <div className="links-list">
                        {groupedLinks[level].map((link, index) => (
                          <div key={`${link.url}-${index}`} className="link-item">
                            <div className="link-info">
                              {link.error ? (
                                <>
                                  <span className="link-url error">{link.url}</span>
                                  <span className="link-error">{link.error}</span>
                                </>
                              ) : (
                                <>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link-url"
                                  >
                                    {link.url}
                                  </a>
                                  {link.title && <span className="link-title">{link.title}</span>}
                                  {link.statusCode && (
                                    <span className={`status-code status-${Math.floor(link.statusCode / 100)}xx`}>
                                      {link.statusCode}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            {link.parentUrl && level > 1 && (
                              <div className="link-parent">
                                来自: {link.parentUrl}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="empty-state">
          <p>还没有检测任务</p>
          <p className="hint">选择模式并输入 URL 或上传 CSV 文件来开始</p>
        </div>
      )}
    </div>
  );
};

export default LinkCrawler;
