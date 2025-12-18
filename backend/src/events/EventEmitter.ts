/**
 * 事件发射器
 *
 * 轻量级的事件系统实现,用于解耦巡检系统的各个组件
 * 支持同步和异步事件监听器
 */

import { PatrolEvent, PatrolEventType, EventListener } from './types.js';

export class EventEmitter {
  private listeners: Map<PatrolEventType, Set<EventListener>> = new Map();
  private onceListeners: Map<PatrolEventType, Set<EventListener>> = new Map();

  /**
   * 注册事件监听器
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  on<T extends PatrolEvent>(
    eventType: T['type'],
    listener: EventListener<T>
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener as EventListener);
  }

  /**
   * 注册一次性事件监听器(触发一次后自动移除)
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  once<T extends PatrolEvent>(
    eventType: T['type'],
    listener: EventListener<T>
  ): void {
    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, new Set());
    }
    this.onceListeners.get(eventType)!.add(listener as EventListener);
  }

  /**
   * 移除事件监听器
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  off<T extends PatrolEvent>(
    eventType: T['type'],
    listener: EventListener<T>
  ): void {
    this.listeners.get(eventType)?.delete(listener as EventListener);
    this.onceListeners.get(eventType)?.delete(listener as EventListener);
  }

  /**
   * 移除指定事件类型的所有监听器
   * @param eventType 事件类型
   */
  removeAllListeners(eventType?: PatrolEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
      this.onceListeners.delete(eventType);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * 发射事件
   * @param event 事件对象
   */
  async emit<T extends PatrolEvent>(event: T): Promise<void> {
    const eventType = event.type;

    // 获取所有监听器
    const regularListeners = Array.from(this.listeners.get(eventType) || []);
    const onceListeners = Array.from(this.onceListeners.get(eventType) || []);

    // 清除一次性监听器
    if (onceListeners.length > 0) {
      this.onceListeners.delete(eventType);
    }

    // 合并所有监听器
    const allListeners = [...regularListeners, ...onceListeners];

    // 执行所有监听器
    const promises = allListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        console.error(`[EventEmitter] Error in listener for ${eventType}:`, error);
        // 监听器错误不应该阻止其他监听器执行
      }
    });

    // 等待所有监听器执行完成
    await Promise.allSettled(promises);
  }

  /**
   * 同步发射事件(不等待异步监听器完成)
   * @param event 事件对象
   */
  emitSync<T extends PatrolEvent>(event: T): void {
    // 异步执行,但不等待
    this.emit(event).catch((error) => {
      console.error(`[EventEmitter] Error emitting event ${event.type}:`, error);
    });
  }

  /**
   * 获取指定事件类型的监听器数量
   * @param eventType 事件类型
   */
  listenerCount(eventType: PatrolEventType): number {
    const regularCount = this.listeners.get(eventType)?.size || 0;
    const onceCount = this.onceListeners.get(eventType)?.size || 0;
    return regularCount + onceCount;
  }

  /**
   * 获取所有事件类型
   */
  eventNames(): PatrolEventType[] {
    const names = new Set<PatrolEventType>();
    this.listeners.forEach((_, type) => names.add(type));
    this.onceListeners.forEach((_, type) => names.add(type));
    return Array.from(names);
  }
}

// 导出全局单例
export const eventEmitter = new EventEmitter();
