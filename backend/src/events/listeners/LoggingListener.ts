/**
 * 日志事件监听器
 *
 * 监听所有巡检事件,记录详细的日志信息
 * 提供统一的事件日志记录,便于审计和调试
 */

import {
  PatrolEvent,
  PatrolEventType,
  PatrolStartedEvent,
  PatrolCompletedEvent,
  PatrolFailedEvent,
  PatrolUrlTestedEvent,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  ExecutionCreatedEvent,
  ExecutionStatusChangedEvent,
} from '../types.js';
import { EventEmitter } from '../EventEmitter.js';

export class LoggingListener {
  constructor(private eventEmitter: EventEmitter) {}

  /**
   * 注册所有日志相关的事件监听器
   */
  register(): void {
    // 巡检生命周期事件
    this.eventEmitter.on<PatrolStartedEvent>(
      PatrolEventType.PATROL_STARTED,
      this.handlePatrolStarted.bind(this)
    );

    this.eventEmitter.on<PatrolCompletedEvent>(
      PatrolEventType.PATROL_COMPLETED,
      this.handlePatrolCompleted.bind(this)
    );

    this.eventEmitter.on<PatrolFailedEvent>(
      PatrolEventType.PATROL_FAILED,
      this.handlePatrolFailed.bind(this)
    );

    this.eventEmitter.on<PatrolUrlTestedEvent>(
      PatrolEventType.PATROL_URL_TESTED,
      this.handleUrlTested.bind(this)
    );

    // 任务管理事件
    this.eventEmitter.on<TaskCreatedEvent>(
      PatrolEventType.TASK_CREATED,
      this.handleTaskCreated.bind(this)
    );

    this.eventEmitter.on<TaskUpdatedEvent>(
      PatrolEventType.TASK_UPDATED,
      this.handleTaskUpdated.bind(this)
    );

    this.eventEmitter.on<TaskDeletedEvent>(
      PatrolEventType.TASK_DELETED,
      this.handleTaskDeleted.bind(this)
    );

    // 执行记录事件
    this.eventEmitter.on<ExecutionCreatedEvent>(
      PatrolEventType.EXECUTION_CREATED,
      this.handleExecutionCreated.bind(this)
    );

    this.eventEmitter.on<ExecutionStatusChangedEvent>(
      PatrolEventType.EXECUTION_STATUS_CHANGED,
      this.handleExecutionStatusChanged.bind(this)
    );

    console.log('[LoggingListener] Registered');
  }

  /**
   * 处理巡检开始事件
   */
  private handlePatrolStarted(event: PatrolStartedEvent): void {
    console.log(
      `📋 [PATROL_STARTED] Execution ${event.executionId} | Task: "${event.task.name}" | URLs: ${event.task.urls.length}`
    );
  }

  /**
   * 处理巡检完成事件
   */
  private handlePatrolCompleted(event: PatrolCompletedEvent): void {
    const { executionId, task, passedUrls, failedUrls, durationMs } = event;
    const status = failedUrls > 0 ? '⚠️' : '✅';

    console.log(
      `${status} [PATROL_COMPLETED] Execution ${executionId} | Task: "${task.name}" | ` +
      `Passed: ${passedUrls}/${passedUrls + failedUrls} | Duration: ${(durationMs / 1000).toFixed(2)}s`
    );
  }

  /**
   * 处理巡检失败事件
   */
  private handlePatrolFailed(event: PatrolFailedEvent): void {
    console.error(
      `❌ [PATROL_FAILED] Execution ${event.executionId} | Task: "${event.task.name}" | ` +
      `Error: ${event.errorMessage}`
    );
  }

  /**
   * 处理 URL 测试事件
   */
  private handleUrlTested(event: PatrolUrlTestedEvent): void {
    const status = event.passed ? '✓' : '✗';
    const emoji = event.passed ? '🟢' : '🔴';

    console.log(
      `${emoji} [URL_TESTED] ${status} ${event.url} | Execution: ${event.executionId}` +
      (event.error ? ` | Error: ${event.error}` : '')
    );
  }

  /**
   * 处理任务创建事件
   */
  private handleTaskCreated(event: TaskCreatedEvent): void {
    console.log(
      `➕ [TASK_CREATED] Task "${event.task.name}" (${event.task.id}) | URLs: ${event.task.urls.length} | ` +
      `Enabled: ${event.task.enabled}`
    );
  }

  /**
   * 处理任务更新事件
   */
  private handleTaskUpdated(event: TaskUpdatedEvent): void {
    const changedFields = Object.keys(event.changes).join(', ');
    console.log(
      `📝 [TASK_UPDATED] Task ${event.taskId} | Changed: ${changedFields}`
    );
  }

  /**
   * 处理任务删除事件
   */
  private handleTaskDeleted(event: TaskDeletedEvent): void {
    console.log(`🗑️  [TASK_DELETED] Task ${event.taskId}`);
  }

  /**
   * 处理执行记录创建事件
   */
  private handleExecutionCreated(event: ExecutionCreatedEvent): void {
    console.log(
      `📊 [EXECUTION_CREATED] Execution ${event.executionId} | Task: ${event.taskId}`
    );
  }

  /**
   * 处理执行状态变更事件
   */
  private handleExecutionStatusChanged(event: ExecutionStatusChangedEvent): void {
    console.log(
      `🔄 [STATUS_CHANGED] Execution ${event.executionId} | ` +
      `${event.oldStatus} → ${event.newStatus}`
    );
  }

  /**
   * 注销所有事件监听器
   */
  unregister(): void {
    this.eventEmitter.removeAllListeners();
    console.log('[LoggingListener] Unregistered');
  }
}
