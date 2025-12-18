/**
 * 异步任务管理服务
 *
 * 功能:
 * - 管理长时间运行的异步任务
 * - 跟踪任务状态 (pending, running, completed, failed)
 * - 存储任务结果
 * - 支持任务进度查询
 */

import { v4 as uuidv4 } from 'uuid';

export enum AsyncTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface AsyncTask<T = any> {
  id: string;
  type: string;
  status: AsyncTaskStatus;
  progress?: number; // 0-100
  progressMessage?: string;
  result?: T;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export class AsyncTaskService {
  private static instance: AsyncTaskService;
  private tasks: Map<string, AsyncTask> = new Map();

  // 清理已完成任务的时间(默认1小时)
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时
  private readonly TASK_TTL = 24 * 60 * 60 * 1000; // 24小时

  private constructor() {
    // 启动定期清理
    this.startCleanup();
  }

  static getInstance(): AsyncTaskService {
    if (!AsyncTaskService.instance) {
      AsyncTaskService.instance = new AsyncTaskService();
    }
    return AsyncTaskService.instance;
  }

  /**
   * 创建新任务
   */
  createTask<T = any>(type: string, metadata?: Record<string, any>): AsyncTask<T> {
    const task: AsyncTask<T> = {
      id: uuidv4(),
      type,
      status: AsyncTaskStatus.PENDING,
      createdAt: new Date(),
      metadata,
    };

    this.tasks.set(task.id, task);
    console.log(`[AsyncTask] Created task ${task.id} (${type})`);

    return task;
  }

  /**
   * 获取任务
   */
  getTask<T = any>(taskId: string): AsyncTask<T> | undefined {
    return this.tasks.get(taskId) as AsyncTask<T> | undefined;
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, status: AsyncTaskStatus): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[AsyncTask] Task ${taskId} not found`);
      return;
    }

    task.status = status;

    if (status === AsyncTaskStatus.RUNNING && !task.startedAt) {
      task.startedAt = new Date();
    }

    if (status === AsyncTaskStatus.COMPLETED || status === AsyncTaskStatus.FAILED) {
      task.completedAt = new Date();
      const duration = task.startedAt
        ? task.completedAt.getTime() - task.startedAt.getTime()
        : 0;
      console.log(`[AsyncTask] Task ${taskId} ${status} (duration: ${duration}ms)`);
    }

    this.tasks.set(taskId, task);
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(taskId: string, progress: number, message?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[AsyncTask] Task ${taskId} not found`);
      return;
    }

    task.progress = Math.min(100, Math.max(0, progress));
    if (message) {
      task.progressMessage = message;
    }

    this.tasks.set(taskId, task);
  }

  /**
   * 设置任务结果
   */
  setTaskResult<T = any>(taskId: string, result: T): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[AsyncTask] Task ${taskId} not found`);
      return;
    }

    task.result = result;
    task.status = AsyncTaskStatus.COMPLETED;
    task.completedAt = new Date();
    task.progress = 100;

    this.tasks.set(taskId, task);
  }

  /**
   * 设置任务错误
   */
  setTaskError(taskId: string, error: Error | string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[AsyncTask] Task ${taskId} not found`);
      return;
    }

    task.error = error instanceof Error ? error.message : error;
    task.status = AsyncTaskStatus.FAILED;
    task.completedAt = new Date();

    this.tasks.set(taskId, task);
    console.error(`[AsyncTask] Task ${taskId} failed:`, task.error);
  }

  /**
   * 执行异步任务
   */
  async executeTask<T = any>(
    type: string,
    executor: (taskId: string) => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<string> {
    const task = this.createTask<T>(type, metadata);

    // 异步执行,不等待结果
    this.runTask(task.id, executor).catch(error => {
      console.error(`[AsyncTask] Unhandled error in task ${task.id}:`, error);
    });

    return task.id;
  }

  /**
   * 内部方法: 运行任务
   */
  private async runTask<T = any>(
    taskId: string,
    executor: (taskId: string) => Promise<T>
  ): Promise<void> {
    this.updateTaskStatus(taskId, AsyncTaskStatus.RUNNING);

    try {
      const result = await executor(taskId);
      this.setTaskResult(taskId, result);
    } catch (error) {
      this.setTaskError(taskId, error as Error);
    }
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): AsyncTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取指定类型的任务
   */
  getTasksByType(type: string): AsyncTask[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): boolean {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      console.log(`[AsyncTask] Deleted task ${taskId}`);
    }
    return deleted;
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanupOldTasks();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * 清理过期任务
   */
  private cleanupOldTasks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      // 只清理已完成或失败的任务
      if (task.status === AsyncTaskStatus.COMPLETED || task.status === AsyncTaskStatus.FAILED) {
        const age = now - task.createdAt.getTime();
        if (age > this.TASK_TTL) {
          this.tasks.delete(taskId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[AsyncTask] Cleaned up ${cleaned} old tasks`);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === AsyncTaskStatus.PENDING).length,
      running: tasks.filter(t => t.status === AsyncTaskStatus.RUNNING).length,
      completed: tasks.filter(t => t.status === AsyncTaskStatus.COMPLETED).length,
      failed: tasks.filter(t => t.status === AsyncTaskStatus.FAILED).length,
    };
  }
}

// 导出单例
export default AsyncTaskService.getInstance();
