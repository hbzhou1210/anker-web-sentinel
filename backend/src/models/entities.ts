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

export enum PerformanceTestMode {
  WebPageTest = 'webpagetest',  // 使用 Playwright 模拟 WebPageTest (默认)
  PageSpeedInsights = 'pagespeed'  // 使用 Google PageSpeed Insights API
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
    performanceTestMode?: PerformanceTestMode;  // 主性能测试方式(用于确定主报告),默认 webpagetest
    enableWebPageTest?: boolean;  // 是否启用 WebPageTest API 测试
    enablePageSpeed?: boolean;     // 是否启用 PageSpeed Insights API 测试
    deviceStrategy?: 'mobile' | 'desktop';  // 设备策略,默认 desktop
    testOptions?: {
      links?: boolean;
      forms?: boolean;
      buttons?: boolean;
      images?: boolean;
      performance?: boolean;
    };
  };
}

// Rendering stage screenshot
export interface RenderingSnapshot {
  stage: 'initial' | 'fcp' | 'lcp' | 'domload' | 'fullyloaded';  // Rendering stage
  stageName: string;  // Display name
  timestamp: number;  // Time since navigation started (ms)
  screenshotUrl?: string;  // Screenshot URL
  metrics?: Record<string, any>;  // Additional metrics at this stage
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
  performanceTestMode?: PerformanceTestMode;  // 性能测试方式
  uiTestResults: UITestResult[];
  performanceResults: PerformanceResult[];
  renderingSnapshots?: RenderingSnapshot[];  // Rendering process screenshots (WebPageTest mode only)
  pageSpeedData?: PageSpeedInsightsData;  // PageSpeed Insights data (PageSpeed mode only)
  webPageTestData?: WebPageTestData;  // Complete WebPageTest data (WebPageTest mode only)
}

// WebPageTest 完整数据结构
export interface WebPageTestData {
  testId: string;
  testUrl: string;
  summary?: string;

  // 核心性能指标
  metrics: {
    loadTime: number;
    TTFB: number;
    startRender: number;
    firstContentfulPaint: number;
    speedIndex: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    totalBlockingTime: number;
    domContentLoaded: number;
    fullyLoaded: number;
  };

  // 资源统计
  resources: {
    totalBytes: number;
    totalRequests: number;
    images: { bytes: number; requests: number };
    js: { bytes: number; requests: number };
    css: { bytes: number; requests: number };
  };

  // 视频帧（Filmstrip）
  videoFrames?: Array<{
    time: number;
    image: string;
    visuallyComplete: number;
  }>;

  // 缩略图
  thumbnails?: {
    waterfall?: string;
    checklist?: string;
    screenShot?: string;
  };

  // 请求瀑布图数据（前50个请求）
  requests?: Array<{
    url: string;
    host: string;
    method: string;
    status: number;
    type: string;
    bytesIn: number;
    startTime: number;
    endTime: number;
    duration: number;
  }>;

  // 域名统计
  domains?: Array<{
    domain: string;
    bytes: number;
    requests: number;
    connections: number;
  }>;
}

// PageSpeed Insights 数据结构
export interface PageSpeedInsightsData {
  performanceScore: number;  // 0-100
  metrics: {
    firstContentfulPaint: number;  // ms
    largestContentfulPaint: number;  // ms
    totalBlockingTime: number;  // ms
    cumulativeLayoutShift: number;  // score
    speedIndex: number;  // ms
    timeToInteractive: number;  // ms
  };
  opportunities?: Array<{
    title: string;
    description: string;
    score: number;
    savings: number;  // ms
  }>;
  diagnostics?: Array<{
    title: string;
    description: string;
    score: number;
  }>;
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

// Monitoring Level (轻量级监控)
export enum MonitoringLevel {
  LIGHTWEIGHT = 'lightweight',  // HTTP 检查 (60% 网站)
  STANDARD = 'standard',         // HTTP + SSL + DNS 检查 (30% 网站)
  BROWSER = 'browser',           // Playwright 浏览器检查 (10% 网站)
  AUTO = 'auto'                  // 自动检测
}

export interface PatrolUrl {
  url: string;
  name: string;
  monitoringLevel?: MonitoringLevel;  // 监控级别（可选，默认为 AUTO）
}

// 巡检配置选项
export interface PatrolConfig {
  // 视觉对比配置
  visualComparison?: {
    enabled: boolean; // 是否启用视觉对比
    diffThreshold?: number; // 差异百分比阈值,默认5%
    saveBaseline?: boolean; // 是否自动更新基线
  };

  // 设备测试配置
  devices?: Array<{
    type: 'desktop' | 'mobile' | 'tablet';
    name: string;
    viewport: { width: number; height: number };
    userAgent?: string;
  }>;

  // 重试配置
  retry?: {
    enabled: boolean; // 是否启用重试
    maxAttempts?: number; // 最大重试次数,默认3
    retryDelay?: number; // 重试间隔(毫秒),默认2000
    retryOnInfraError?: boolean; // 是否对基础设施错误重试,默认true
  };

  // 页脚newsletter配置(向后兼容的顶级配置)
  requireFooterNewsletter?: boolean; // 是否要求邮件订阅,默认false

  // 页面检查配置
  pageChecks?: {
    // 首页/落地页检查项
    homepage?: {
      requireNavigation?: boolean; // 是否要求导航栏,默认true
      requireBanner?: boolean; // 是否要求主Banner,默认true
      requireFooter?: boolean; // 是否要求页脚,默认true
      minContentModules?: number; // 最少内容模块数,默认3
    };

    // 页脚功能要求(可根据品牌特性自定义)
    footer?: {
      requireLinks?: boolean; // 是否要求导航链接,默认true
      requireSocial?: boolean; // 是否要求社交媒体,默认false
      requireNewsletter?: boolean; // 是否要求邮件订阅,默认false(对某些品牌很重要)
      requireCopyright?: boolean; // 是否要求版权信息,默认true
    };

    // 产品页检查项
    product?: {
      requireTitle?: boolean; // 是否要求产品标题,默认true
      requireImage?: boolean; // 是否要求产品图片,默认true
      requirePrice?: boolean; // 是否要求价格信息,默认true
      requireAddToCart?: boolean; // 是否要求加购按钮,默认true
      requireBuyNow?: boolean; // 是否要求立即购买按钮,默认false
    };
  };

  // 其他配置
  timeout?: number; // 页面加载超时(秒)
  waitAfterLoad?: number; // 加载后等待时间(秒)
}

export interface PatrolTestResult {
  url: string;
  name: string;
  status: 'pass' | 'fail';
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
  screenshotUrl?: string; // 飞书图片URL
  testDuration?: number;
  checkDetails?: string; // 检查详情（包含所有检查项的结果）
  isInfrastructureError?: boolean; // 是否为基础设施错误（网络、超时等），不触发邮件通知

  // 视觉对比结果
  visualDiff?: {
    hasDifference: boolean;
    diffPercentage: number; // 差异百分比 0-100
    diffImageUrl?: string; // 差异图像URL
    baselineImageUrl?: string; // 基线图像URL
  };

  // 设备类型（用于移动端测试）
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  deviceName?: string; // 设备名称，如 "iPhone 14", "iPad Pro"
  viewport?: {
    width: number;
    height: number;
  };

  // 监控级别（轻量级监控）
  checkType?: 'quick' | 'standard' | 'full';  // 检查类型
  monitoringLevel?: MonitoringLevel;  // 使用的监控级别
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

// Link Crawler Entities
export enum CrawlStatus {
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed'
}

export interface CrawledLink {
  url: string;              // 链接地址
  title?: string;           // 页面标题
  level: number;            // 爬取层级 (1, 2, 3...)
  parentUrl?: string;       // 父页面 URL
  statusCode?: number;      // HTTP 状态码
  error?: string;           // 错误信息
  crawledAt: Date;          // 爬取时间
}

export interface LinkCrawlTask {
  id: string;               // UUID
  startUrl: string;         // 起始 URL
  maxDepth: number;         // 最大爬取深度
  mode?: 'crawl' | '404check' | 'csv';  // 任务模式
  status: CrawlStatus;      // 爬取状态
  totalLinks: number;       // 总链接数
  crawledLinks: number;     // 已爬取链接数
  links: CrawledLink[];     // 爬取到的链接列表
  stats?: {                 // 统计信息
    total404: number;       // 404错误数量
    total200: number;       // 正常链接数量
    totalOther: number;     // 其他状态数量
  };
  startedAt: Date;          // 开始时间
  completedAt?: Date;       // 完成时间
  durationMs?: number;      // 耗时(毫秒)
  errorMessage?: string;    // 错误信息
}
