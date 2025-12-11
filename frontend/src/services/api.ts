import axios, { AxiosInstance, AxiosError } from 'axios';

// API Base Configuration
// 优先使用环境变量,否则根据 window.location 判断使用相对路径或完整 URL
const getApiBaseUrl = (): string => {
  // 如果设置了环境变量,直接使用
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 如果在浏览器环境且不是 localhost,使用相对路径(生产环境通过 Nginx 代理)
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return '/api/v1';
  }

  // 本地开发环境使用完整 URL
  return 'http://localhost:3000/api/v1';
};

/**
 * 获取完整的 API URL
 * 在生产环境使用相对路径,在开发环境使用完整 URL
 */
export const getFullApiUrl = (path: string): string => {
  // 如果已经是完整 URL,直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // 如果是相对路径,根据环境拼接
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    // 生产环境:使用当前域名
    return path.startsWith('/') ? path : `/${path}`;
  }

  // 开发环境:使用 localhost:3000
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `http://localhost:3000${cleanPath}`;
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
export interface TestRequest {
  id: string;
  url: string;
  requestedAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config?: {
    timeout?: number;
    waitTime?: number;
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
  uiTestResults: UITestResult[];
  performanceResults: PerformanceResult[];
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
      const response = await apiClient.post<TestRequest>('/tests', requestBody);
      return response.data;
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
};

export default api;
