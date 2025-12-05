// Performance thresholds based on industry standards
// Reference: quickstart.md:341-347

export const PERFORMANCE_THRESHOLDS = {
  loadTime: 3000,      // 3 seconds (milliseconds)
  resourceSize: 2 * 1024 * 1024,  // 2MB (bytes)
  responseTime: 500,   // 500ms (milliseconds)
  renderTime: 2000     // 2 seconds (milliseconds)
};

export type PerformanceThresholds = typeof PERFORMANCE_THRESHOLDS;
