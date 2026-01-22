/**
 * 任务队列服务
 *
 * 功能:
 * - 双队列设计:高优先级(用户交互)、低优先级(定时任务)
 * - 高优先级任务立即执行,不受队列影响
 * - 低优先级任务串行执行,避免资源抢占
 * - 支持队列状态监控
 */

import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('TaskQueue');

interface QueueTask {
  id: string;
  name: string;
  priority: 'high' | 'low';
  execute: () => Promise<void>;
  createdAt: Date;
}

interface QueueStats {
  highPriorityRunning: number;
  lowPriorityQueue: number;
  lowPriorityRunning: boolean;
  totalExecuted: number;
  totalFailed: number;
}

export class TaskQueueService {
  private static instance: TaskQueueService;

  // 低优先级队列(定时巡检)
  private lowPriorityQueue: QueueTask[] = [];
  private isExecutingLowPriority = false;

  // 高优先级任务计数(用户测试)
  private highPriorityRunning = 0;

  // 统计
  private stats = {
    totalExecuted: 0,
    totalFailed: 0,
  };

  private constructor() {}

  static getInstance(): TaskQueueService {
    if (!TaskQueueService.instance) {
      TaskQueueService.instance = new TaskQueueService();
    }
    return TaskQueueService.instance;
  }

  /**
   * 添加高优先级任务(用户交互)
   * 立即执行,不进入队列
   */
  async executeHighPriority(task: Omit<QueueTask, 'priority' | 'createdAt'>): Promise<void> {
    this.highPriorityRunning++;

    logger.info(`[TaskQueue] 🚀 Executing HIGH priority task: ${task.name} (${task.id})`);
    logger.info(`[TaskQueue] Active high-priority tasks: ${this.highPriorityRunning}`);

    try {
      await task.execute();
      this.stats.totalExecuted++;
      logger.info(`[TaskQueue] ✓ HIGH priority task completed: ${task.name}`);
    } catch (error) {
      this.stats.totalFailed++;
      logger.error(`[TaskQueue] ✗ HIGH priority task failed: ${task.name}`, error);
      throw error;
    } finally {
      this.highPriorityRunning--;
    }
  }

  /**
   * 添加低优先级任务(定时巡检)
   * 进入队列,串行执行
   */
  async executeLowPriority(task: Omit<QueueTask, 'priority' | 'createdAt'>): Promise<string> {
    const queueTask: QueueTask = {
      ...task,
      priority: 'low',
      createdAt: new Date(),
    };

    this.lowPriorityQueue.push(queueTask);

    logger.info(`[TaskQueue] 📥 Added LOW priority task to queue: ${task.name} (${task.id})`);
    logger.info(`[TaskQueue] Queue length: ${this.lowPriorityQueue.length}`);

    // 触发队列处理(异步)
    this.processLowPriorityQueue();

    return task.id;
  }

  /**
   * 处理低优先级队列
   * 串行执行,一次只执行一个
   */
  private async processLowPriorityQueue(): Promise<void> {
    // 如果正在执行,则跳过
    if (this.isExecutingLowPriority) {
      return;
    }

    // 如果队列为空,则返回
    if (this.lowPriorityQueue.length === 0) {
      return;
    }

    this.isExecutingLowPriority = true;

    while (this.lowPriorityQueue.length > 0) {
      const task = this.lowPriorityQueue.shift()!;

      const waitTime = Date.now() - task.createdAt.getTime();
      logger.info(`[TaskQueue] 🔄 Executing LOW priority task: ${task.name} (waited ${Math.round(waitTime / 1000)}s)`);
      logger.info(`[TaskQueue] Remaining in queue: ${this.lowPriorityQueue.length}`);

      try {
        await task.execute();
        this.stats.totalExecuted++;
        logger.info(`[TaskQueue] ✓ LOW priority task completed: ${task.name}`);
      } catch (error) {
        this.stats.totalFailed++;
        logger.error(`[TaskQueue] ✗ LOW priority task failed: ${task.name}`, error);
        // 继续执行下一个任务,不中断队列
      }

      // 任务间添加短暂延迟,避免资源立即抢占
      if (this.lowPriorityQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒间隔
      }
    }

    this.isExecutingLowPriority = false;
    logger.info(`[TaskQueue] ✓ LOW priority queue cleared`);
  }

  /**
   * 获取队列状态
   */
  getStats(): QueueStats {
    return {
      highPriorityRunning: this.highPriorityRunning,
      lowPriorityQueue: this.lowPriorityQueue.length,
      lowPriorityRunning: this.isExecutingLowPriority,
      totalExecuted: this.stats.totalExecuted,
      totalFailed: this.stats.totalFailed,
    };
  }

  /**
   * 获取队列中的任务列表
   */
  getQueuedTasks(): Array<{ id: string; name: string; waitTime: number }> {
    return this.lowPriorityQueue.map(task => ({
      id: task.id,
      name: task.name,
      waitTime: Date.now() - task.createdAt.getTime(),
    }));
  }

  /**
   * 清空队列(慎用)
   */
  clearQueue(): void {
    const cleared = this.lowPriorityQueue.length;
    this.lowPriorityQueue = [];
    logger.info(`[TaskQueue] ⚠️  Cleared ${cleared} tasks from queue`);
  }
}

// 导出单例
export default TaskQueueService.getInstance();
