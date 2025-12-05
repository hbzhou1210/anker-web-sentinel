// Enums
export enum TestRequestStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed'
}

export enum TestResultStatus {
  Pass = 'pass',
  Fail = 'fail',
  Warning = 'warning'
}

export enum UITestType {
  Link = 'link',
  Form = 'form',
  Button = 'button',
  Image = 'image'
}

export enum PerformanceMetric {
  LoadTime = 'loadTime',
  ResourceSize = 'resourceSize',
  ResponseTime = 'responseTime',
  RenderTime = 'renderTime'
}

export enum MetricUnit {
  Milliseconds = 'ms',
  Bytes = 'bytes',
  Score = 'score'
}

export enum Trend {
  Improving = 'improving',
  Stable = 'stable',
  Degrading = 'degrading'
}

// Entities
export interface TestRequest {
  id: string;  // UUID
  url: string;
  requestedAt: Date;
  status: TestRequestStatus;
  notificationEmail?: string;
  config?: {
    timeout?: number;  // seconds
    waitTime?: number; // seconds
    testOptions?: {
      links?: boolean;
      forms?: boolean;
      buttons?: boolean;
      images?: boolean;
      performance?: boolean;
    };
  };
}

export interface TestReport {
  id: string;  // UUID
  testRequestId: string;  // UUID
  url: string;
  overallScore: number;  // 0-100
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  testDuration: number;  // milliseconds
  completedAt: Date;
  uiTestResults: UITestResult[];
  performanceResults: PerformanceResult[];
}

export interface UITestResult {
  id: string;  // UUID
  testReportId: string;  // UUID
  testType: UITestType;
  elementId?: string;
  status: TestResultStatus;
  errorMessage?: string;
  screenshotUrl?: string;
  recommendation?: string;
  diagnostics?: Record<string, any>;
}

export interface PerformanceResult {
  id: string;  // UUID
  testReportId: string;  // UUID
  metricName: PerformanceMetric;
  measuredValue: number;
  unit: MetricUnit;
  threshold: number;
  status: TestResultStatus;
  recommendation?: string;
  details?: Record<string, any>;
}

export interface TestHistory {
  url: string;
  reports: TestReport[];
  latestScore: number;
  trend: Trend;
  totalRuns: number;
  firstTestedAt: Date;
  lastTestedAt: Date;
}

// Database row types (snake_case from PostgreSQL)
export interface TestRequestRow {
  id: string;
  url: string;
  requested_at: Date;
  status: string;
  config: any;
  notification_email?: string;
}

export interface TestReportRow {
  id: string;
  test_request_id: string;
  url: string;
  overall_score: number;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  warning_checks: number;
  test_duration: number;
  completed_at: Date;
}

export interface UITestResultRow {
  id: string;
  test_report_id: string;
  test_type: string;
  element_id: string | null;
  status: string;
  error_message: string | null;
  screenshot_url: string | null;
  recommendation: string | null;
  diagnostics: any;
}

export interface PerformanceResultRow {
  id: string;
  test_report_id: string;
  metric_name: string;
  measured_value: string;  // DECIMAL from PostgreSQL
  unit: string;
  threshold: string;  // DECIMAL from PostgreSQL
  status: string;
  recommendation: string | null;
  details: any;
}

// Feishu Document Entity
export interface FeishuDocument {
  id: string;  // UUID
  documentId: string;
  documentUrl: string;
  title?: string;
  content?: string;
  importedAt: Date;
  lastSyncedAt?: Date;
  metadata?: Record<string, any>;
}

// Test Point Priority
export enum TestPointPriority {
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

// Test Point Status
export enum TestPointStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  InProgress = 'in_progress',
  Completed = 'completed'
}

// Test Point Entity
export interface TestPoint {
  id: string;  // UUID
  feishuDocumentId?: string;  // UUID
  category?: string;
  feature: string;
  description: string;
  priority: TestPointPriority;
  testType?: string;
  preconditions?: string;
  expectedResult?: string;
  testData?: Record<string, any>;
  status: TestPointStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Database row types for new tables
export interface FeishuDocumentRow {
  id: string;
  document_id: string;
  document_url: string;
  title: string | null;
  content: string | null;
  imported_at: Date;
  last_synced_at: Date | null;
  metadata: any;
}

export interface TestPointRow {
  id: string;
  feishu_document_id: string | null;
  category: string | null;
  feature: string;
  description: string;
  priority: string;
  test_type: string | null;
  preconditions: string | null;
  expected_result: string | null;
  test_data: any;
  status: string;
  created_at: Date;
  updated_at: Date;
  metadata: any;
}

// Responsive Test Entities
export enum DeviceType {
  Mobile = 'mobile',
  Tablet = 'tablet',
  Desktop = 'desktop'
}

export interface ResponsiveTestIssue {
  type: 'horizontal_scroll' | 'viewport_meta' | 'font_size' | 'touch_target' | 'image_responsive';
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
  details?: Record<string, any>;
}

export interface ResponsiveTestResult {
  id: string;  // UUID
  testReportId: string;  // UUID
  deviceName: string;
  deviceType: DeviceType;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;

  // 检测结果
  hasHorizontalScroll: boolean;
  hasViewportMeta: boolean;
  fontSizeReadable: boolean;
  touchTargetsAdequate: boolean;
  imagesResponsive: boolean;

  // 截图
  screenshotPortraitUrl?: string;
  screenshotLandscapeUrl?: string;

  // 问题列表
  issues: ResponsiveTestIssue[];

  // 元数据
  testDuration: number;  // milliseconds
  createdAt: Date;
}

export interface DevicePreset {
  id: number;
  name: string;
  deviceType: DeviceType;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
  pixelRatio: number;
  hasTouch: boolean;
  isMobile: boolean;
  enabled: boolean;
  createdAt: Date;
}

// Database row types
export interface ResponsiveTestResultRow {
  id: string;
  test_report_id: string;
  device_name: string;
  device_type: string;
  viewport_width: number;
  viewport_height: number;
  user_agent: string;
  has_horizontal_scroll: boolean;
  has_viewport_meta: boolean;
  font_size_readable: boolean;
  touch_targets_adequate: boolean;
  images_responsive: boolean;
  screenshot_portrait_url: string | null;
  screenshot_landscape_url: string | null;
  issues: any;
  test_duration: number;
  created_at: Date;
}

export interface DevicePresetRow {
  id: number;
  name: string;
  device_type: string;
  viewport_width: number;
  viewport_height: number;
  user_agent: string;
  pixel_ratio: string;  // DECIMAL
  has_touch: boolean;
  is_mobile: boolean;
  enabled: boolean;
  created_at: Date;
}

// Patrol System Entities
export enum PatrolExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed'
}

export enum PatrolScheduleType {
  DailyMorning = 'daily_morning',
  DailyAfternoon = 'daily_afternoon',
  DailyTwice = 'daily_twice',
  Custom = 'custom'
}

export interface PatrolUrl {
  url: string;
  name: string;
}

export interface PatrolTestResult {
  url: string;
  name: string;
  status: 'pass' | 'fail';
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
  screenshotUrl?: string;
  testDuration?: number;
  checkDetails?: string; // 检查详情（包含所有检查项的结果）
  isInfrastructureError?: boolean; // 是否为基础设施错误（网络、超时等），不触发邮件通知

  // Core Web Vitals 性能数据
  coreWebVitals?: {
    lcp?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };  // Largest Contentful Paint
    fid?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };  // First Input Delay
    cls?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };  // Cumulative Layout Shift
    fcp?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };  // First Contentful Paint
    tti?: number;  // Time to Interactive
    tbt?: number;  // Total Blocking Time
    ttfb?: number;  // Time to First Byte
    domLoad?: number;  // DOM Content Loaded
    onLoad?: number;  // Window Load
  };

  // 性能等级评估（基于所选场景的阈值）
  performanceLevel?: 'excellent' | 'good' | 'needs_improvement';

  // 使用的性能评估场景
  performanceScenario?: {
    deviceType: string;  // desktop, mobile, low_end
    networkType: string;  // wifi_5g, 4g, 3g, slow
    businessType: string;  // ecommerce, content, tool, enterprise
  };
}

export interface PatrolTask {
  id: string;  // UUID
  name: string;
  description?: string;
  urls: PatrolUrl[];
  config: Record<string, any>;
  notificationEmails: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatrolSchedule {
  id: string;  // UUID
  patrolTaskId: string;  // UUID
  cronExpression: string;
  scheduleType: PatrolScheduleType;
  timeZone: string;
  enabled: boolean;
  lastExecutionAt?: Date;
  nextExecutionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatrolExecution {
  id: string;  // UUID
  patrolTaskId: string;  // UUID
  status: PatrolExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  totalUrls: number;
  passedUrls: number;
  failedUrls: number;
  testResults: PatrolTestResult[];
  emailSent: boolean;
  emailSentAt?: Date;
  errorMessage?: string;
  durationMs?: number;
}

// Database row types for patrol system
export interface PatrolTaskRow {
  id: string;
  name: string;
  description: string | null;
  urls: any;  // JSONB
  config: any;  // JSONB
  notification_emails: string[];  // TEXT[]
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PatrolScheduleRow {
  id: string;
  patrol_task_id: string;
  cron_expression: string;
  schedule_type: string;
  time_zone: string;
  enabled: boolean;
  last_execution_at: Date | null;
  next_execution_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PatrolExecutionRow {
  id: string;
  patrol_task_id: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  total_urls: number;
  passed_urls: number;
  failed_urls: number;
  test_results: any;  // JSONB
  email_sent: boolean;
  email_sent_at: Date | null;
  error_message: string | null;
  duration_ms: number | null;
}
