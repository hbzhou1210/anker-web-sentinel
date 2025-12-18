/**
 * 事件系统初始化
 *
 * 在应用启动时注册所有事件监听器
 */

import { EventEmitter } from './EventEmitter.js';
import { EmailNotificationListener } from './listeners/EmailNotificationListener.js';
import { LoggingListener } from './listeners/LoggingListener.js';

/**
 * 初始化事件系统
 * 注册所有事件监听器
 *
 * @param eventEmitter 事件发射器实例 (可选,默认使用全局单例)
 */
export function initializeEventSystem(eventEmitter?: EventEmitter): void {
  const emitter = eventEmitter || new EventEmitter();

  console.log('[EventSystem] Initializing event listeners...');

  // 注册日志监听器
  const loggingListener = new LoggingListener(emitter);
  loggingListener.register();

  // 注册邮件通知监听器
  const emailListener = new EmailNotificationListener(emitter);
  emailListener.register();

  console.log('[EventSystem] ✅ All event listeners registered successfully');
}

/**
 * 清理事件系统
 * 注销所有事件监听器
 *
 * @param eventEmitter 事件发射器实例 (可选,默认使用全局单例)
 */
export function cleanupEventSystem(eventEmitter?: EventEmitter): void {
  const emitter = eventEmitter || new EventEmitter();

  console.log('[EventSystem] Cleaning up event listeners...');

  // 注销日志监听器
  const loggingListener = new LoggingListener(emitter);
  loggingListener.unregister();

  // 注销邮件通知监听器
  const emailListener = new EmailNotificationListener(emitter);
  emailListener.unregister();

  console.log('[EventSystem] ✅ All event listeners unregistered');
}
