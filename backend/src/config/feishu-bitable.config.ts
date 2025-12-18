/**
 * 飞书多维表格配置
 *
 * App Token: X66Mb4mPRagcrSsBlRQcNrHQnKh
 * App URL: https://anker-in.feishu.cn/base/X66Mb4mPRagcrSsBlRQcNrHQnKh
 *
 * 创建时间: 2025-12-10
 * 创建方式: 使用 HTTP API 创建,拥有完整权限
 * 协作者: anita.zhou (需手动添加)
 */

export const FEISHU_BITABLE_CONFIG = {
  // 多维表格 App Token
  appToken: process.env.FEISHU_BITABLE_APP_TOKEN || 'X66Mb4mPRagcrSsBlRQcNrHQnKh',

  // 数据表 ID 映射
  tables: {
    // 测试报告表
    testReports: process.env.FEISHU_TABLE_TEST_REPORTS || 'tbllXmgEKdXOwFfE',

    // 响应式测试结果表
    responsiveTestResults: process.env.FEISHU_TABLE_RESPONSIVE_RESULTS || 'tbl8Qi8wNm8FRU4y',

    // 设备预设表
    devicePresets: process.env.FEISHU_TABLE_DEVICE_PRESETS || 'tblmB4EAqP1Xbsnb',

    // 巡检任务表
    patrolTasks: process.env.FEISHU_TABLE_PATROL_TASKS || 'tblbvi9w4QU1LleK',

    // 巡检调度表
    patrolSchedules: process.env.FEISHU_TABLE_PATROL_SCHEDULES || 'tblIxfaEKRZSMksy',

    // 巡检执行记录表
    patrolExecutions: process.env.FEISHU_TABLE_PATROL_EXECUTIONS || 'tbleHxX6bYCwCuVW',

    // 折扣规则查询报告表
    discountRuleReports: process.env.FEISHU_TABLE_DISCOUNT_REPORTS || '',
  },

  // 飞书应用凭证
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
};

// 表字段映射 (用于数据转换)
export const FIELD_MAPPINGS = {
  testReports: {
    id: 'id',
    url: 'url',
    overallScore: 'overall_score',
    totalChecks: 'total_checks',
    passedChecks: 'passed_checks',
    failedChecks: 'failed_checks',
    warningChecks: 'warning_checks',
    testDuration: 'test_duration',
    completedAt: 'completed_at',
    status: 'status',
  },
  responsiveTestResults: {
    id: 'id',
    testReportId: 'test_report_id',
    deviceName: 'device_name',
    deviceType: 'device_type',
    viewportWidth: 'viewport_width',
    viewportHeight: 'viewport_height',
    hasHorizontalScroll: 'has_horizontal_scroll',
    hasViewportMeta: 'has_viewport_meta',
    fontSizeReadable: 'font_size_readable',
    touchTargetsAdequate: 'touch_targets_adequate',
    imagesResponsive: 'images_responsive',
    screenshotPortraitUrl: 'screenshot_portrait_url',
    screenshotLandscapeUrl: 'screenshot_landscape_url',
    issues: 'issues',
    testDuration: 'test_duration',
    createdAt: 'created_at',
  },
  devicePresets: {
    id: 'id',
    name: 'name',
    deviceType: 'device_type',
    viewportWidth: 'viewport_width',
    viewportHeight: 'viewport_height',
    userAgent: 'user_agent',
    pixelRatio: 'pixel_ratio',
    hasTouch: 'has_touch',
    isMobile: 'is_mobile',
    enabled: 'enabled',
  },
  patrolTasks: {
    id: 'id',
    name: 'name',
    description: 'description',
    urls: 'urls',
    config: 'config',
    notificationEmails: 'notification_emails',
    enabled: 'enabled',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  patrolSchedules: {
    id: 'id',
    patrolTaskId: 'patrol_task_id',
    cronExpression: 'cron_expression',
    scheduleType: 'schedule_type',
    timeZone: 'time_zone',
    enabled: 'enabled',
    lastExecutionAt: 'last_execution_at',
    nextExecutionAt: 'next_execution_at',
  },
  patrolExecutions: {
    id: 'id',
    patrolTaskId: 'patrol_task_id',
    status: 'status',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    totalUrls: 'total_urls',
    passedUrls: 'passed_urls',
    failedUrls: 'failed_urls',
    testResults: 'test_results',
    emailSent: 'email_sent',
    emailSentAt: 'email_sent_at',
    errorMessage: 'error_message',
    durationMs: 'duration_ms',
  },
  discountRuleReports: {
    recordId: 'record_id',
    reportId: 'report_id',
    type: 'type',
    shopDomain: 'shop_domain',
    ruleIds: 'rule_ids',
    createdAt: 'created_at',
    summary: 'summary',
    detailResults: 'detail_results',
    status: 'status',
    htmlReportUrl: 'html_report_url',
  },
};
