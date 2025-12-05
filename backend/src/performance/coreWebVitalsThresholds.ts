/**
 * Core Web Vitals 性能阈值配置 (2024标准)
 *
 * 参考标准:
 * - Google Core Web Vitals: https://web.dev/vitals/
 * - 阈值等级: excellent(优秀) / good(良好) / needs_improvement(需优化)
 *
 * 核心原则:
 * 1. 优先用户体验指标 (LCP/FID/CLS) 而非技术指标
 * 2. 分场景设置阈值 (设备类型/网络环境/业务类型)
 * 3. 阶段性达标 (达标→优化→卓越)
 */

// ============ 核心指标类型 ============
export enum WebVitalMetric {
  // Core Web Vitals (Google搜索排名指标)
  LCP = 'LCP',  // Largest Contentful Paint - 最大内容绘制
  FID = 'FID',  // First Input Delay - 首次输入延迟
  CLS = 'CLS',  // Cumulative Layout Shift - 累积布局偏移

  // 重要辅助指标
  FCP = 'FCP',  // First Contentful Paint - 首次内容绘制
  TTI = 'TTI',  // Time to Interactive - 可交互时间
  TBT = 'TBT',  // Total Blocking Time - 总阻塞时间

  // 传统指标 (兼容性保留)
  TTFB = 'TTFB',        // Time to First Byte - 首字节时间
  DOMLoad = 'DOMLoad',  // DOMContentLoaded - DOM加载完成
  OnLoad = 'OnLoad',    // Window Load - 页面完全加载
}

// ============ 性能等级定义 ============
export enum PerformanceLevel {
  Excellent = 'excellent',        // 优秀 - 超过75%用户体验良好
  Good = 'good',                 // 良好 - 达到基本标准
  NeedsImprovement = 'needs_improvement', // 需优化 - 低于基本标准
}

// ============ 设备类型 ============
export enum DeviceType {
  Desktop = 'desktop',   // 桌面端
  Mobile = 'mobile',     // 移动端
  LowEnd = 'low_end',    // 低端设备
}

// ============ 网络类型 ============
export enum NetworkType {
  WiFi_5G = 'wifi_5g',  // Wi-Fi/5G - 高速网络
  Mobile_4G = '4g',      // 4G - 常规移动网络
  Mobile_3G = '3g',      // 3G - 慢速网络
  Slow = 'slow',         // 弱网环境
}

// ============ 业务类型 ============
export enum BusinessType {
  Ecommerce = 'ecommerce',     // 电商 (转化优先)
  Content = 'content',         // 内容资讯 (快速呈现)
  Tool = 'tool',               // 工具应用 (交互优先)
  Enterprise = 'enterprise',   // 企业应用 (功能完整)
}

// ============ 单个指标的阈值定义 ============
export interface MetricThreshold {
  metric: WebVitalMetric;
  excellent: number;  // 优秀阈值
  good: number;       // 良好阈值
  unit: 'ms' | 'score' | 'bytes';
  description: string;
}

// ============ 场景化阈值配置 ============
export interface ScenarioThresholds {
  deviceType: DeviceType;
  networkType: NetworkType;
  businessType: BusinessType;
  thresholds: MetricThreshold[];
}

// ============ Core Web Vitals 基准阈值 (Google官方标准) ============
export const CORE_WEB_VITALS_BASE: Record<WebVitalMetric, MetricThreshold> = {
  // === Core Web Vitals (最高优先级) ===
  [WebVitalMetric.LCP]: {
    metric: WebVitalMetric.LCP,
    excellent: 2500,  // ≤2.5s 优秀
    good: 4000,       // ≤4s 良好
    unit: 'ms',
    description: '最大内容绘制 - 页面主要内容加载完成时间(用户感知的"加载完成")',
  },
  [WebVitalMetric.FID]: {
    metric: WebVitalMetric.FID,
    excellent: 100,   // ≤100ms 优秀
    good: 300,        // ≤300ms 良好
    unit: 'ms',
    description: '首次输入延迟 - 用户首次交互的响应速度',
  },
  [WebVitalMetric.CLS]: {
    metric: WebVitalMetric.CLS,
    excellent: 0.1,   // ≤0.1 优秀
    good: 0.25,       // ≤0.25 良好
    unit: 'score',
    description: '累积布局偏移 - 页面加载中元素意外移动的程度',
  },

  // === 重要辅助指标 ===
  [WebVitalMetric.FCP]: {
    metric: WebVitalMetric.FCP,
    excellent: 1800,  // ≤1.8s 优秀
    good: 3000,       // ≤3s 良好
    unit: 'ms',
    description: '首次内容绘制 - 首次出现文本/图像的时间(白屏结束)',
  },
  [WebVitalMetric.TTI]: {
    metric: WebVitalMetric.TTI,
    excellent: 3800,  // ≤3.8s 优秀
    good: 7000,       // ≤7s 良好
    unit: 'ms',
    description: '可交互时间 - 页面完全可交互的时间',
  },
  [WebVitalMetric.TBT]: {
    metric: WebVitalMetric.TBT,
    excellent: 200,   // ≤200ms 优秀
    good: 600,        // ≤600ms 良好
    unit: 'ms',
    description: '总阻塞时间 - FCP到TTI之间主线程被阻塞的时间',
  },

  // === 传统指标 (低优先级) ===
  [WebVitalMetric.TTFB]: {
    metric: WebVitalMetric.TTFB,
    excellent: 800,   // ≤800ms 优秀
    good: 1800,       // ≤1.8s 良好
    unit: 'ms',
    description: '首字节时间 - 服务器响应速度',
  },
  [WebVitalMetric.DOMLoad]: {
    metric: WebVitalMetric.DOMLoad,
    excellent: 3000,  // ≤3s 优秀
    good: 5000,       // ≤5s 良好
    unit: 'ms',
    description: 'DOM加载完成 - HTML解析完成时间',
  },
  [WebVitalMetric.OnLoad]: {
    metric: WebVitalMetric.OnLoad,
    excellent: 5000,  // ≤5s 优秀
    good: 8000,       // ≤8s 良好
    unit: 'ms',
    description: '页面完全加载 - 所有资源加载完成时间',
  },
};

// ============ 场景化阈值配置库 ============

/**
 * 桌面端 + Wi-Fi/5G + 电商首页
 * 特点: 网络稳定、性能强、转化优先
 */
export const DESKTOP_WIFI_ECOMMERCE: ScenarioThresholds = {
  deviceType: DeviceType.Desktop,
  networkType: NetworkType.WiFi_5G,
  businessType: BusinessType.Ecommerce,
  thresholds: [
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.LCP],
      excellent: 2500,  // 严格标准
      good: 3500,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.FID],
      excellent: 100,
      good: 200,        // 更严格
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.CLS],
      excellent: 0.1,
      good: 0.15,       // 更严格 (电商布局稳定性重要)
    },
    CORE_WEB_VITALS_BASE[WebVitalMetric.FCP],
    CORE_WEB_VITALS_BASE[WebVitalMetric.TTI],
  ],
};

/**
 * 移动端 + 4G + 电商首页
 * 特点: 网络波动、性能一般、转化优先
 */
export const MOBILE_4G_ECOMMERCE: ScenarioThresholds = {
  deviceType: DeviceType.Mobile,
  networkType: NetworkType.Mobile_4G,
  businessType: BusinessType.Ecommerce,
  thresholds: [
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.LCP],
      excellent: 3000,  // 放宽 +0.5s
      good: 4500,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.FID],
      excellent: 150,   // 放宽
      good: 300,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.CLS],
      excellent: 0.1,
      good: 0.2,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.FCP],
      excellent: 2000,  // 放宽
      good: 3500,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.TTI],
      excellent: 5000,  // 放宽
      good: 8000,
    },
  ],
};

/**
 * 移动端 + 3G/弱网 + 电商首页
 * 特点: 网络慢、下沉市场、可用性优先
 */
export const MOBILE_3G_ECOMMERCE: ScenarioThresholds = {
  deviceType: DeviceType.Mobile,
  networkType: NetworkType.Mobile_3G,
  businessType: BusinessType.Ecommerce,
  thresholds: [
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.LCP],
      excellent: 4000,  // 大幅放宽
      good: 6000,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.FID],
      excellent: 200,
      good: 400,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.CLS],
      excellent: 0.15,
      good: 0.25,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.FCP],
      excellent: 3000,
      good: 5000,
    },
  ],
};

/**
 * 移动端 + 4G + 内容资讯
 * 特点: 快速呈现文本、容忍图片延迟
 */
export const MOBILE_4G_CONTENT: ScenarioThresholds = {
  deviceType: DeviceType.Mobile,
  networkType: NetworkType.Mobile_4G,
  businessType: BusinessType.Content,
  thresholds: [
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.LCP],
      excellent: 3000,
      good: 4500,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.FCP],
      excellent: 1500,  // FCP更重要 (文本先显示)
      good: 2500,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.CLS],
      excellent: 0.1,
      good: 0.2,
    },
  ],
};

/**
 * 桌面端 + Wi-Fi + 企业应用
 * 特点: 功能完整、用户容忍度高
 */
export const DESKTOP_WIFI_ENTERPRISE: ScenarioThresholds = {
  deviceType: DeviceType.Desktop,
  networkType: NetworkType.WiFi_5G,
  businessType: BusinessType.Enterprise,
  thresholds: [
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.LCP],
      excellent: 4000,  // 放宽 (企业应用功能优先)
      good: 6000,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.TTI],
      excellent: 3000,  // TTI更重要 (需快速交互)
      good: 5000,
    },
    {
      ...CORE_WEB_VITALS_BASE[WebVitalMetric.CLS],
      excellent: 0.1,
      good: 0.25,
    },
  ],
};

// ============ 场景匹配函数 ============

/**
 * 根据场景自动选择最合适的阈值配置
 */
export function getThresholdsForScenario(
  deviceType: DeviceType,
  networkType: NetworkType,
  businessType: BusinessType
): ScenarioThresholds {
  // 精确匹配预设场景
  const scenarios: ScenarioThresholds[] = [
    DESKTOP_WIFI_ECOMMERCE,
    MOBILE_4G_ECOMMERCE,
    MOBILE_3G_ECOMMERCE,
    MOBILE_4G_CONTENT,
    DESKTOP_WIFI_ENTERPRISE,
  ];

  const exactMatch = scenarios.find(
    (s) =>
      s.deviceType === deviceType &&
      s.networkType === networkType &&
      s.businessType === businessType
  );

  if (exactMatch) {
    return exactMatch;
  }

  // 模糊匹配 (优先匹配设备+网络,忽略业务类型)
  const partialMatch = scenarios.find(
    (s) => s.deviceType === deviceType && s.networkType === networkType
  );

  if (partialMatch) {
    return partialMatch;
  }

  // 默认: 移动端4G电商标准 (最通用)
  return MOBILE_4G_ECOMMERCE;
}

/**
 * 获取单个指标的阈值
 */
export function getMetricThreshold(
  metric: WebVitalMetric,
  scenario: ScenarioThresholds
): MetricThreshold {
  const found = scenario.thresholds.find((t) => t.metric === metric);
  return found || CORE_WEB_VITALS_BASE[metric];
}

/**
 * 判断指标是否达标
 */
export function evaluateMetric(
  value: number,
  threshold: MetricThreshold
): PerformanceLevel {
  if (value <= threshold.excellent) {
    return PerformanceLevel.Excellent;
  }
  if (value <= threshold.good) {
    return PerformanceLevel.Good;
  }
  return PerformanceLevel.NeedsImprovement;
}

/**
 * 获取推荐阈值配置 (用于前端展示)
 */
export function getRecommendedThresholds(): {
  name: string;
  scenario: ScenarioThresholds;
  description: string;
}[] {
  return [
    {
      name: '桌面端电商(高速网络)',
      scenario: DESKTOP_WIFI_ECOMMERCE,
      description: '适用于桌面端电商首页/商品页,Wi-Fi/5G网络环境',
    },
    {
      name: '移动端电商(4G网络)',
      scenario: MOBILE_4G_ECOMMERCE,
      description: '适用于移动端电商,4G网络环境(最通用)',
    },
    {
      name: '移动端电商(3G/弱网)',
      scenario: MOBILE_3G_ECOMMERCE,
      description: '适用于移动端电商,3G或弱网环境(下沉市场)',
    },
    {
      name: '移动端资讯(4G网络)',
      scenario: MOBILE_4G_CONTENT,
      description: '适用于移动端内容资讯页面,4G网络',
    },
    {
      name: '桌面端企业应用',
      scenario: DESKTOP_WIFI_ENTERPRISE,
      description: '适用于企业级后台系统,Wi-Fi网络',
    },
  ];
}
