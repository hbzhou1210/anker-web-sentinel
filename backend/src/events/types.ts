/**
 * 事件系统类型定义
 * 定义了巡检系统中所有可能触发的事件类型
 */

import { PatrolTask, PatrolExecution, PatrolExecutionStatus } from '../models/entities.js';

/**
 * 巡检生命周期事件类型
 */
export enum PatrolEventType {
  // 巡检任务事件
  PATROL_STARTED = 'patrol.started',
  PATROL_COMPLETED = 'patrol.completed',
  PATROL_FAILED = 'patrol.failed',
  PATROL_URL_TESTED = 'patrol.url.tested',

  // 任务管理事件
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_DELETED = 'task.deleted',
  TASK_ENABLED = 'task.enabled',
  TASK_DISABLED = 'task.disabled',

  // 执行记录事件
  EXECUTION_CREATED = 'execution.created',
  EXECUTION_STATUS_CHANGED = 'execution.status.changed',
}

/**
 * 事件基类
 */
export interface BaseEvent {
  type: PatrolEventType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 巡检开始事件
 */
export interface PatrolStartedEvent extends BaseEvent {
  type: PatrolEventType.PATROL_STARTED;
  executionId: string;
  task: PatrolTask;
}

/**
 * 巡检完成事件
 */
export interface PatrolCompletedEvent extends BaseEvent {
  type: PatrolEventType.PATROL_COMPLETED;
  executionId: string;
  task: PatrolTask;
  execution: PatrolExecution;
  passedUrls: number;
  failedUrls: number;
  durationMs: number;
}

/**
 * 巡检失败事件
 */
export interface PatrolFailedEvent extends BaseEvent {
  type: PatrolEventType.PATROL_FAILED;
  executionId: string;
  task: PatrolTask;
  error: Error;
  errorMessage: string;
}

/**
 * URL 测试完成事件
 */
export interface PatrolUrlTestedEvent extends BaseEvent {
  type: PatrolEventType.PATROL_URL_TESTED;
  executionId: string;
  taskId: string;
  url: string;
  passed: boolean;
  screenshot?: string;
  error?: string;
}

/**
 * 任务创建事件
 */
export interface TaskCreatedEvent extends BaseEvent {
  type: PatrolEventType.TASK_CREATED;
  task: PatrolTask;
}

/**
 * 任务更新事件
 */
export interface TaskUpdatedEvent extends BaseEvent {
  type: PatrolEventType.TASK_UPDATED;
  taskId: string;
  task: PatrolTask;
  changes: Partial<PatrolTask>;
}

/**
 * 任务删除事件
 */
export interface TaskDeletedEvent extends BaseEvent {
  type: PatrolEventType.TASK_DELETED;
  taskId: string;
}

/**
 * 任务启用事件
 */
export interface TaskEnabledEvent extends BaseEvent {
  type: PatrolEventType.TASK_ENABLED;
  taskId: string;
  task: PatrolTask;
}

/**
 * 任务禁用事件
 */
export interface TaskDisabledEvent extends BaseEvent {
  type: PatrolEventType.TASK_DISABLED;
  taskId: string;
  task: PatrolTask;
}

/**
 * 执行记录创建事件
 */
export interface ExecutionCreatedEvent extends BaseEvent {
  type: PatrolEventType.EXECUTION_CREATED;
  executionId: string;
  taskId: string;
}

/**
 * 执行状态变更事件
 */
export interface ExecutionStatusChangedEvent extends BaseEvent {
  type: PatrolEventType.EXECUTION_STATUS_CHANGED;
  executionId: string;
  taskId: string;
  oldStatus: PatrolExecutionStatus;
  newStatus: PatrolExecutionStatus;
}

/**
 * 所有事件类型的联合类型
 */
export type PatrolEvent =
  | PatrolStartedEvent
  | PatrolCompletedEvent
  | PatrolFailedEvent
  | PatrolUrlTestedEvent
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskDeletedEvent
  | TaskEnabledEvent
  | TaskDisabledEvent
  | ExecutionCreatedEvent
  | ExecutionStatusChangedEvent;

/**
 * 事件监听器函数类型
 */
export type EventListener<T extends PatrolEvent = PatrolEvent> = (event: T) => void | Promise<void>;

/**
 * 事件监听器映射类型
 */
export type EventListenerMap = {
  [K in PatrolEventType]?: EventListener[];
};
