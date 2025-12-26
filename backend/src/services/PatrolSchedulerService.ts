import cron from 'node-cron';
import { BitablePatrolScheduleRepository } from '../models/repositories/BitablePatrolScheduleRepository.js';
import { PatrolSchedule } from '../models/entities.js';
import { patrolService } from './PatrolService.js';
import taskQueue from './TaskQueueService.js';

interface ScheduledTask {
  schedule: PatrolSchedule;
  cronTask: cron.ScheduledTask;
}

export class PatrolSchedulerService {
  private scheduleRepository: BitablePatrolScheduleRepository;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Use Bitable for schedule repository
    this.scheduleRepository = new BitablePatrolScheduleRepository();
  }

  /**
   * 初始化调度器 - 加载所有启用的调度配置
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('PatrolSchedulerService already initialized');
      return;
    }

    const storageMode = process.env.DATABASE_STORAGE || 'postgres';
    console.log(`Initializing PatrolSchedulerService (${storageMode} mode)...`);

    try {
      const enabledSchedules = await this.scheduleRepository.findAllEnabled();
      console.log(`Found ${enabledSchedules.length} enabled patrol schedules`);

      for (const schedule of enabledSchedules) {
        await this.scheduleTask(schedule);
      }

      this.isInitialized = true;
      console.log('✓ PatrolSchedulerService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PatrolSchedulerService:', error);
      throw error;
    }
  }

  /**
   * 调度单个任务
   */
  async scheduleTask(schedule: PatrolSchedule): Promise<void> {
    try {
      // 如果已经调度过,先取消
      if (this.scheduledTasks.has(schedule.id)) {
        this.unscheduleTask(schedule.id);
      }

      // 验证 cron 表达式
      if (!cron.validate(schedule.cronExpression)) {
        console.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
        return;
      }

      // 创建 cron 任务
      const cronTask = cron.schedule(
        schedule.cronExpression,
        async () => {
          await this.executeScheduledTask(schedule);
        },
        {
          timezone: schedule.timeZone,
        }
      );

      // 保存到内存
      this.scheduledTasks.set(schedule.id, {
        schedule,
        cronTask,
      });

      // 计算下次执行时间
      const nextExecution = this.calculateNextExecution(schedule.cronExpression, schedule.timeZone);
      if (nextExecution) {
        await this.scheduleRepository.update(schedule.id, {
          nextExecutionAt: nextExecution,
        });
      }

      console.log(
        `✓ Scheduled patrol task ${schedule.patrolTaskId} with cron: ${schedule.cronExpression} (${schedule.timeZone})`
      );
    } catch (error) {
      console.error(`Failed to schedule task ${schedule.id}:`, error);
    }
  }

  /**
   * 取消调度任务
   */
  unscheduleTask(scheduleId: string): void {
    const scheduledTask = this.scheduledTasks.get(scheduleId);
    if (scheduledTask) {
      scheduledTask.cronTask.stop();
      this.scheduledTasks.delete(scheduleId);
      console.log(`✓ Unscheduled patrol task ${scheduleId}`);
    }
  }

  /**
   * 执行调度的巡检任务
   * 使用低优先级队列,避免与用户测试抢占资源
   */
  private async executeScheduledTask(schedule: PatrolSchedule): Promise<void> {
    const now = new Date();
    console.log(`⏰ Triggering scheduled patrol task: ${schedule.patrolTaskId} at ${now.toISOString()}`);

    // 将定时巡检任务加入低优先级队列
    await taskQueue.executeLowPriority({
      id: `patrol-${schedule.patrolTaskId}-${Date.now()}`,
      name: `Patrol: ${schedule.patrolTaskId}`,
      execute: async () => {
        try {
          console.log(`[PatrolScheduler] Executing patrol task: ${schedule.patrolTaskId}`);

          // 🌐 使用环境变量配置的应用 URL
          const originUrl = process.env.APP_URL || process.env.FRONTEND_URL;
          console.log(`[PatrolScheduler] Using origin URL: ${originUrl || 'not set (will use default)'}`);

          // 执行巡检 (邮件将在 PatrolService.runPatrolTests() 中自动发送)
          const executionId = await patrolService.executePatrol(schedule.patrolTaskId, originUrl);

          // 更新最后执行时间和下次执行时间
          const nextExecution = this.calculateNextExecution(schedule.cronExpression, schedule.timeZone);
          await this.scheduleRepository.updateExecutionTime(
            schedule.id,
            now,
            nextExecution || new Date()
          );

          console.log(`[PatrolScheduler] ✓ Patrol task completed: ${schedule.patrolTaskId}`);
        } catch (error) {
          console.error(`[PatrolScheduler] Failed to execute patrol task ${schedule.patrolTaskId}:`, error);
          throw error; // 让队列记录失败
        }
      }
    });
  }

  /**
   * 计算下次执行时间
   */
  private calculateNextExecution(cronExpression: string, timeZone: string): Date | null {
    try {
      // node-cron 不提供直接计算下次执行时间的方法
      // 这里使用简单的估算:如果是每天执行,计算到明天的时间
      // 对于更复杂的 cron 表达式,可以使用 cron-parser 库

      // 简单实现:解析 cron 表达式中的小时和分钟
      const parts = cronExpression.split(' ');
      if (parts.length >= 5) {
        const minute = parseInt(parts[0]);
        const hour = parseInt(parts[1]);

        if (!isNaN(minute) && !isNaN(hour)) {
          const now = new Date();
          const next = new Date(now);
          next.setHours(hour, minute, 0, 0);

          // 如果今天的时间已过,移到明天
          if (next <= now) {
            next.setDate(next.getDate() + 1);
          }

          return next;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to calculate next execution time:', error);
      return null;
    }
  }

  /**
   * 重新加载所有调度配置
   */
  async reloadSchedules(): Promise<void> {
    console.log('Reloading all patrol schedules...');

    // 停止所有现有任务
    for (const scheduleId of this.scheduledTasks.keys()) {
      this.unscheduleTask(scheduleId);
    }

    // 重新加载
    const enabledSchedules = await this.scheduleRepository.findAllEnabled();
    for (const schedule of enabledSchedules) {
      await this.scheduleTask(schedule);
    }

    console.log(`✓ Reloaded ${enabledSchedules.length} patrol schedules`);
  }

  /**
   * 添加新的调度配置
   */
  async addSchedule(schedule: PatrolSchedule): Promise<void> {
    if (schedule.enabled) {
      await this.scheduleTask(schedule);
    }
  }

  /**
   * 更新调度配置
   */
  async updateSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId);
    if (schedule) {
      // 先取消现有调度
      this.unscheduleTask(scheduleId);

      // 如果启用,重新调度
      if (schedule.enabled) {
        await this.scheduleTask(schedule);
      }
    }
  }

  /**
   * 删除调度配置
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    this.unscheduleTask(scheduleId);
  }

  /**
   * 获取当前调度状态
   */
  getScheduleStatus(): { scheduleId: string; patrolTaskId: string; isRunning: boolean }[] {
    const status: { scheduleId: string; patrolTaskId: string; isRunning: boolean }[] = [];

    for (const [scheduleId, task] of this.scheduledTasks.entries()) {
      status.push({
        scheduleId,
        patrolTaskId: task.schedule.patrolTaskId,
        isRunning: true,
      });
    }

    return status;
  }

  /**
   * 停止所有调度任务
   */
  shutdown(): void {
    console.log('Shutting down PatrolSchedulerService...');

    for (const scheduleId of this.scheduledTasks.keys()) {
      this.unscheduleTask(scheduleId);
    }

    this.isInitialized = false;
    console.log('✓ PatrolSchedulerService shut down');
  }
}

export const patrolSchedulerService = new PatrolSchedulerService();
