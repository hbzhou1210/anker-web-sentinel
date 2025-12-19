/**
 * 轻量级监控模块导出
 *
 * 提供三层监控架构：
 * - LightweightMonitor: HTTP 快速检查 (适用于 60% 网站)
 * - StandardMonitor: HTTP + SSL + DNS (适用于 30% 网站)
 * - MonitoringService: 智能路由服务 (自动选择合适的监控级别)
 */

export { LightweightMonitor } from './LightweightMonitor.js';
export { StandardMonitor, EnhancedCheckResult } from './StandardMonitor.js';
export { MonitoringService } from './MonitoringService.js';

// 默认导出单例
export { default as lightweightMonitor } from './LightweightMonitor.js';
export { default as standardMonitor } from './StandardMonitor.js';
export { default as monitoringService } from './MonitoringService.js';
