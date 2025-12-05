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
    // Poll every 2 seconds if test is still running
    refetchInterval: (query) => {
      const data = query.state.data as TestRequest | undefined;
      if (!data) return false;
      const isRunning = data.status === 'pending' || data.status === 'running';
      return isRunning ? 2000 : false;
    },
    // Keep polling even when window is not focused
    refetchIntervalInBackground: true,
    // Retry on error (network issues during long-running test)
    retry: 3,
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
