/**
 * 邮件通知事件监听器
 *
 * 监听巡检完成和失败事件,发送邮件通知
 * 从 PatrolService 中解耦邮件发送逻辑
 */

import {
  PatrolCompletedEvent,
  PatrolFailedEvent,
  PatrolEventType,
} from '../types.js';
import { EventEmitter } from '../EventEmitter.js';
import { PatrolEmailService } from '../../services/PatrolEmailService.js';

export class EmailNotificationListener {
  private emailService: PatrolEmailService;

  constructor(
    private eventEmitter: EventEmitter,
    emailService?: PatrolEmailService
  ) {
    this.emailService = emailService || new PatrolEmailService();
  }

  /**
   * 注册所有邮件通知相关的事件监听器
   */
  register(): void {
    // 监听巡检完成事件
    this.eventEmitter.on<PatrolCompletedEvent>(
      PatrolEventType.PATROL_COMPLETED,
      this.handlePatrolCompleted.bind(this)
    );

    // 监听巡检失败事件
    this.eventEmitter.on<PatrolFailedEvent>(
      PatrolEventType.PATROL_FAILED,
      this.handlePatrolFailed.bind(this)
    );

    console.log('[EmailNotificationListener] Registered');
  }

  /**
   * 处理巡检完成事件
   */
  private async handlePatrolCompleted(event: PatrolCompletedEvent): Promise<void> {
    try {
      console.log(`[EmailNotificationListener] Handling PATROL_COMPLETED for execution ${event.executionId}`);

      // 使用 PatrolEmailService 发送报告
      // PatrolEmailService 会自动查询任务和执行记录,生成邮件内容
      await this.emailService.sendPatrolReport(event.executionId);

      console.log(`[EmailNotificationListener] Email report sent for execution ${event.executionId}`);
    } catch (error) {
      console.error('[EmailNotificationListener] Failed to send completion email:', error);
      // 邮件发送失败不应该影响巡检流程
    }
  }

  /**
   * 处理巡检失败事件
   */
  private async handlePatrolFailed(event: PatrolFailedEvent): Promise<void> {
    try {
      console.log(`[EmailNotificationListener] Handling PATROL_FAILED for execution ${event.executionId}`);

      // 对于失败的巡检,也尝试发送报告(如果执行记录已创建)
      await this.emailService.sendPatrolReport(event.executionId);

      console.log(`[EmailNotificationListener] Failure notification sent for execution ${event.executionId}`);
    } catch (error) {
      console.error('[EmailNotificationListener] Failed to send failure email:', error);
      // 邮件发送失败不应该影响巡检流程
    }
  }

  /**
   * 注销所有事件监听器
   */
  unregister(): void {
    this.eventEmitter.off(
      PatrolEventType.PATROL_COMPLETED,
      this.handlePatrolCompleted.bind(this)
    );
    this.eventEmitter.off(
      PatrolEventType.PATROL_FAILED,
      this.handlePatrolFailed.bind(this)
    );

    console.log('[EmailNotificationListener] Unregistered');
  }
}
