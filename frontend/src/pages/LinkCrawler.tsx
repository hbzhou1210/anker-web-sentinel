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
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalLinks: number;
  crawledLinks: number;
  links: CrawledLink[];
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
  const [startUrl, setStartUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
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
    mutationFn: async (data: { startUrl: string; maxDepth: number }) => {
      const response = await axios.post(`${API_BASE_URL}/link-crawler`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['link-crawler-tasks'] });
      setSelectedTaskId(data.id);
      setStartUrl('');
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

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startUrl.trim()) return;

    createTaskMutation.mutate({ startUrl: startUrl.trim(), maxDepth });
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

  return (
    <div className="link-crawler">
      <div className="page-header">
        <h1>链接爬取工具</h1>
        <p className="subtitle">爬取网页链接并按层级展示</p>
      </div>

      {/* 创建任务表单 */}
      <div className="crawler-form-section">
        <form onSubmit={handleSubmit} className="crawler-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startUrl">起始 URL</label>
              <input
                type="url"
                id="startUrl"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="maxDepth">爬取深度</label>
              <select
                id="maxDepth"
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
              >
                <option value={1}>1 级(仅当前页面)</option>
                <option value={2}>2 级(推荐)</option>
                <option value={3}>3 级</option>
                <option value={4}>4 级</option>
                <option value={5}>5 级(最大)</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={createTaskMutation.isPending || !startUrl.trim()}
            >
              {createTaskMutation.isPending ? '创建中...' : '开始爬取'}
            </button>
          </div>
        </form>
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="tasks-section">
          <h2>爬取任务</h2>
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
                     task.status === 'completed' ? '已完成' :
                     task.status === 'failed' ? '失败' : '等待中'}
                  </span>
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
                <div className="task-url">{task.startUrl}</div>
                <div className="task-stats">
                  <span>深度: {task.maxDepth}</span>
                  <span>链接: {task.crawledLinks}/{task.totalLinks || '?'}</span>
                  {task.durationMs && (
                    <span>耗时: {(task.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 爬取结果 */}
      {displayTask && (
        <div className="results-section">
          <div className="results-header">
            <h2>爬取结果</h2>
            {displayTask.status === 'running' && (
              <div className="progress-info">
                <span>正在爬取... {displayTask.crawledLinks} 个链接</span>
                <div className="spinner"></div>
              </div>
            )}
            {displayTask.status === 'completed' && (
              <div className="completion-info">
                ✓ 完成! 共爬取 {displayTask.totalLinks} 个链接
              </div>
            )}
          </div>

          {displayTask.errorMessage && (
            <div className="error-message">
              错误: {displayTask.errorMessage}
            </div>
          )}

          {/* 按层级展示链接 */}
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

      {tasks.length === 0 && (
        <div className="empty-state">
          <p>还没有爬取任务</p>
          <p className="hint">输入 URL 并选择爬取深度来开始</p>
        </div>
      )}
    </div>
  );
};

export default LinkCrawler;
