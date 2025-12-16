import axios, { AxiosInstance, AxiosError } from 'axios';

// API Base Configuration
// 优先使用环境变量,否则根据 window.location 判断使用相对路径或完整 URL
const getApiBaseUrl = (): string => {
  // 如果设置了环境变量,直接使用
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('[API] Using VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 如果在浏览器环境且不是 localhost,使用相对路径(生产环境通过 Nginx 代理)
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    console.log('[API] Production mode detected, hostname:', window.location.hostname, '-> using /api/v1');
    return '/api/v1';
  }

  // 本地开发环境使用完整 URL
  console.log('[API] Development mode detected -> using http://localhost:80/api/v1');
  return 'http://localhost:80/api/v1';
};

/**
 * 获取完整的 API URL
 * 在生产环境使用相对路径,在开发环境使用完整 URL
 */
export const getFullApiUrl = (path: string): string => {
  // 如果已经是完整 URL,直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log('[API] getFullApiUrl: Already full URL:', path);
    return path;
  }

  // 如果是相对路径,根据环境拼接
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    // 生产环境:使用当前域名
    const result = path.startsWith('/') ? path : `/${path}`;
    console.log('[API] getFullApiUrl (production):', path, '->', result);
    return result;
  }

  // 开发环境:使用 localhost:80
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const result = `http://localhost:80${cleanPath}`;
  console.log('[API] getFullApiUrl (development):', path, '->', result);
  return result;
};

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  timeout: 120000, // 2 minutes (tests can take time)
  headers: {
    'Content-Type': 'application/json',
  },
});

// 使用请求拦截器动态设置 baseURL
apiClient.interceptors.request.use((config) => {
  // 在每次请求时动态计算 baseURL
  config.baseURL = getApiBaseUrl();
  return config;
});

// Types
export type PerformanceTestMode = 'webpagetest' | 'pagespeed';

export interface TestRequest {
  id: string;
  url: string;
  requestedAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config?: {
    timeout?: number;
    waitTime?: number;
    performanceTestMode?: PerformanceTestMode;
    enableWebPageTest?: boolean;
    enablePageSpeed?: boolean;
    deviceStrategy?: 'mobile' | 'desktop';
    testOptions?: {
      links?: boolean;
      forms?: boolean;
      buttons?: boolean;
      images?: boolean;
      performance?: boolean;
    };
  };
}

export interface UITestResult {
  id: string;
  testReportId: string;
  testType: 'link' | 'form' | 'button' | 'image';
  elementId?: string;
  status: 'pass' | 'warning' | 'fail';
  errorMessage?: string;
  screenshotUrl?: string;
  recommendation?: string;
  diagnostics?: Record<string, any>;
}

export interface PerformanceResult {
  id: string;
  testReportId: string;
  metricName: 'loadTime' | 'resourceSize' | 'responseTime' | 'renderTime';
  measuredValue: number;
  unit: 'milliseconds' | 'bytes' | 'percentage';
  threshold: number;
  status: 'pass' | 'warning' | 'fail';
  details?: Record<string, any>;
}

export interface RenderingSnapshot {
  stage: 'initial' | 'fcp' | 'lcp' | 'domload' | 'fullyloaded';
  stageName: string;
  timestamp: number;
  screenshotUrl?: string;
  metrics?: Record<string, any>;
}

export interface PageSpeedInsightsData {
  performanceScore: number;
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    speedIndex: number;
    timeToInteractive: number;
  };
  opportunities?: Array<{
    title: string;
    description: string;
    score: number;
    savings: number;
  }>;
  diagnostics?: Array<{
    title: string;
    description: string;
    score: number;
  }>;
}

export interface WebPageTestData {
  testId: string;
  testUrl: string;
  summary?: string;
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
  resources: {
    totalBytes: number;
    totalRequests: number;
    images: { bytes: number; requests: number };
    js: { bytes: number; requests: number };
    css: { bytes: number; requests: number };
  };
  videoFrames?: Array<{
    time: number;
    image: string;
    visuallyComplete: number;
  }>;
  thumbnails?: {
    waterfall?: string;
    checklist?: string;
    screenShot?: string;
  };
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
  domains?: Array<{
    domain: string;
    bytes: number;
    requests: number;
    connections: number;
  }>;
}

export interface TestReport {
  id: string;
  testRequestId: string;
  url: string;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  testDuration: number;
  completedAt: string;
  performanceTestMode?: PerformanceTestMode;
  uiTestResults: UITestResult[];
  performanceResults: PerformanceResult[];
  renderingSnapshots?: RenderingSnapshot[];
  pageSpeedData?: PageSpeedInsightsData;
  webPageTestData?: WebPageTestData;
}

export interface TestReportSummary {
  id: string;
  url: string;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  completedAt: string;
}

export interface ReportListResponse {
  reports: TestReportSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Error handler
function handleAPIError(error: any): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    const message = axiosError.response?.data?.message || axiosError.message || 'Unknown error';
    const statusCode = axiosError.response?.status;
    throw new APIError(message, statusCode, error);
  }
  throw new APIError(error.message || 'Unknown error', undefined, error);
}

// API Methods
export const api = {
  // Create a new test request
  async createTest(params: {
    url: string;
    config?: {
      timeout?: number;
      waitTime?: number;
      performanceTestMode?: PerformanceTestMode;
      enableWebPageTest?: boolean;
      enablePageSpeed?: boolean;
      deviceStrategy?: 'mobile' | 'desktop';
      testOptions?: {
        links?: boolean;
        forms?: boolean;
        buttons?: boolean;
        images?: boolean;
        performance?: boolean;
      };
    };
    notificationEmail?: string;
  }): Promise<TestRequest> {
    try {
      console.log('[API] createTest called with params:', params);
      const requestBody = {
        url: params.url,
        config: params.config,
        notificationEmail: params.notificationEmail,
      };
      console.log('[API] Request body to send:', requestBody);

      // 使用 fetch + getFullApiUrl 确保生产环境正确
      const apiUrl = getFullApiUrl('/api/v1/tests');
      console.log('[API] Calling:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get test request status
  async getTestStatus(testId: string): Promise<TestRequest> {
    try {
      const response = await apiClient.get<TestRequest>(`/tests/${testId}`);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get full test report by ID
  async getTestReport(reportId: string): Promise<TestReport> {
    try {
      const response = await apiClient.get<TestReport>(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get test report by test request ID
  async getTestReportByRequestId(testRequestId: string): Promise<TestReport> {
    try {
      const response = await apiClient.get<TestReport>(`/tests/${testRequestId}/report`);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // List recent test reports
  async listReports(params?: {
    url?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReportListResponse> {
    try {
      const response = await apiClient.get<ReportListResponse>('/reports', { params });
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // ==================== Patrol APIs ====================

  // Create patrol task
  async createPatrolTask(params: {
    name: string;
    description?: string;
    urls: Array<{ url: string; name: string }>;
    notificationEmails: string[];
    config?: Record<string, any>;
    enabled?: boolean;
  }): Promise<any> {
    try {
      const response = await apiClient.post('/patrol/tasks', params);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get patrol tasks
  async getPatrolTasks(enabledOnly = false): Promise<any[]> {
    try {
      const response = await apiClient.get('/patrol/tasks', {
        params: { enabledOnly },
      });
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get patrol task by ID
  async getPatrolTask(taskId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/patrol/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Update patrol task
  async updatePatrolTask(taskId: string, updates: Partial<any>): Promise<any> {
    try {
      const response = await apiClient.put(`/patrol/tasks/${taskId}`, updates);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Delete patrol task
  async deletePatrolTask(taskId: string): Promise<void> {
    try {
      await apiClient.delete(`/patrol/tasks/${taskId}`);
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Execute patrol task manually
  async executePatrolTask(taskId: string): Promise<{ executionId: string }> {
    try {
      const response = await apiClient.post(`/patrol/tasks/${taskId}/execute`);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Create patrol schedule
  async createPatrolSchedule(params: {
    patrolTaskId: string;
    cronExpression: string;
    scheduleType: string;
    timeZone?: string;
    enabled?: boolean;
  }): Promise<any> {
    try {
      const response = await apiClient.post('/patrol/schedules', params);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get patrol schedules
  async getPatrolSchedules(taskId?: string): Promise<any[]> {
    try {
      const response = await apiClient.get('/patrol/schedules', {
        params: taskId ? { taskId } : undefined,
      });
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Update patrol schedule
  async updatePatrolSchedule(scheduleId: string, updates: Partial<any>): Promise<any> {
    try {
      const response = await apiClient.put(`/patrol/schedules/${scheduleId}`, updates);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Delete patrol schedule
  async deletePatrolSchedule(scheduleId: string): Promise<void> {
    try {
      await apiClient.delete(`/patrol/schedules/${scheduleId}`);
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get patrol executions
  async getPatrolExecutions(taskId?: string, limit = 10): Promise<any[]> {
    try {
      const response = await apiClient.get('/patrol/executions', {
        params: { taskId, limit },
      });
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },

  // Get patrol execution detail
  async getPatrolExecution(executionId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/patrol/executions/${executionId}`);
      return response.data;
    } catch (error) {
      return handleAPIError(error);
    }
  },
};

export default api;
