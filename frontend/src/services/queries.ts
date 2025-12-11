import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import api, { TestRequest, TestReport, ReportListResponse } from './api';

// Query Keys
export const queryKeys = {
  testStatus: (testId: string) => ['test-status', testId] as const,
  testReport: (reportId: string) => ['test-report', reportId] as const,
  reportList: (params?: { url?: string; limit?: number; offset?: number }) =>
    ['report-list', params] as const,
};

// Create a test request mutation
export function useCreateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
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
    }) => api.createTest(params),
    onSuccess: (data) => {
      // Invalidate report list to show new test
      queryClient.invalidateQueries({ queryKey: ['report-list'] });
      // Set initial cache for test status
      queryClient.setQueryData(queryKeys.testStatus(data.id), data);
    },
  });
}

// Poll test status until completed or failed
export function useTestStatus(testId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.testStatus(testId || ''),
    queryFn: () => api.getTestStatus(testId!),
    enabled: !!testId && (options?.enabled !== false),
    // 渐进式退避轮询策略: 减少长时间运行任务的请求频率
    // 前 10 秒: 2s 间隔 (快速反馈)
    // 10-30 秒: 3s 间隔
    // 30 秒后: 5s 间隔 (长时间任务)
    refetchInterval: (query) => {
      const data = query.state.data as TestRequest | undefined;
      if (!data) return false;

      const isRunning = data.status === 'pending' || data.status === 'running';
      if (!isRunning) return false;

      // 计算测试已运行时长
      const startTime = data.requestedAt ? new Date(data.requestedAt).getTime() : Date.now();
      const elapsedSeconds = (Date.now() - startTime) / 1000;

      // 渐进式退避
      if (elapsedSeconds < 10) return 2000;  // 前10秒: 2秒间隔
      if (elapsedSeconds < 30) return 3000;  // 10-30秒: 3秒间隔
      return 5000;                           // 30秒后: 5秒间隔
    },
    // Keep polling even when window is not focused
    refetchIntervalInBackground: true,
    // 404 错误不重试(测试ID不存在,后端可能重启导致内存数据丢失)
    // 其他错误重试 3 次(网络问题)
    retry: (failureCount, error: any) => {
      // 404 说明测试ID不存在(后端重启或数据已清理),不再重试
      if (error?.response?.status === 404) {
        console.warn('[useTestStatus] Test ID not found (404), stopping polling');
        return false;
      }
      // 其他错误重试 3 次
      return failureCount < 3;
    },
    retryDelay: 1000,
  });
}

// Get full test report
export function useTestReport(reportId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.testReport(reportId || ''),
    queryFn: () => api.getTestReport(reportId!),
    enabled: !!reportId && (options?.enabled !== false),
    // Cache report for 10 minutes (reports don't change)
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// List recent reports
export function useReportList(params?: { url?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.reportList(params),
    queryFn: () => api.listReports(params),
    // Cache for 1 minute
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// Create and configure QueryClient
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable automatic refetch on window focus (avoid unnecessary requests)
        refetchOnWindowFocus: false,
        // Retry failed requests once
        retry: 1,
        // 5 minute default stale time
        staleTime: 5 * 60 * 1000,
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
      },
    },
  });
}
