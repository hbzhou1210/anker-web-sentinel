/**
 * 飞书 API 服务
 *
 * 直接调用飞书开放平台 HTTP API,不依赖 MCP 工具
 * 支持在生产环境中运行
 *
 * 优化:
 * - Bottleneck 限流器:控制飞书 API QPS(5 QPS)
 * - opossum 熔断器:自动故障恢复
 */

import axios, { AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import CircuitBreaker from 'opossum';
import { FEISHU_BITABLE_CONFIG } from '../config/feishu-bitable.config.js';

interface AccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

interface CreateRecordResponse {
  code: number;
  msg: string;
  data: {
    record: {
      fields: Record<string, any>;
      record_id: string;
    };
  };
}

interface SearchRecordsResponse {
  code: number;
  msg: string;
  data: {
    has_more: boolean;
    items: Array<{
      fields: Record<string, any>;
      record_id: string;
    }>;
    page_token?: string;
    total: number;
  };
}

export class FeishuApiService {
  private appId: string;
  private appSecret: string;
  private appToken: string;
  private baseUrl = 'https://open.feishu.cn/open-apis';
  private axiosInstance: AxiosInstance;

  // Access token 缓存
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  // Bottleneck 限流器:控制飞书 API QPS
  // 飞书开放平台限制:每个应用每个接口 100 QPS,这里设置为 5 QPS 更保守
  private limiter: Bottleneck;

  // opossum 熔断器:自动故障恢复
  private breaker: CircuitBreaker;

  constructor() {
    this.appId = process.env.FEISHU_APP_ID || FEISHU_BITABLE_CONFIG.appId;
    this.appSecret = process.env.FEISHU_APP_SECRET || FEISHU_BITABLE_CONFIG.appSecret;
    this.appToken = FEISHU_BITABLE_CONFIG.appToken;

    console.log('[FeishuApi] Initializing with:', {
      hasEnvAppId: !!process.env.FEISHU_APP_ID,
      hasEnvAppSecret: !!process.env.FEISHU_APP_SECRET,
      finalAppId: this.appId,
      finalAppSecretLength: this.appSecret?.length || 0,
      appToken: this.appToken,
    });

    if (!this.appId || !this.appSecret) {
      console.warn('[FeishuApi] Warning: FEISHU_APP_ID or FEISHU_APP_SECRET not configured');
      console.warn('[FeishuApi] This will cause authentication failures when accessing Feishu APIs');
    }

    // 初始化 Bottleneck 限流器
    // 飞书 API 限制:5 QPS(每秒最多 5 个请求)
    this.limiter = new Bottleneck({
      maxConcurrent: 5, // 最多 5 个并发请求
      minTime: 200, // 每个请求之间至少间隔 200ms(即 5 QPS)
      reservoir: 50, // 令牌桶初始容量
      reservoirRefreshAmount: 5, // 每次刷新增加 5 个令牌
      reservoirRefreshInterval: 1000, // 每 1 秒刷新一次
    });

    // 监听限流器事件
    this.limiter.on('failed', (error, jobInfo) => {
      console.warn('[FeishuApi] Limiter job failed:', {
        error: error.message,
        retryCount: jobInfo.retryCount,
      });
      // 如果是网络错误或 429 错误,自动重试
      if (jobInfo.retryCount < 3 && (axios.isAxiosError(error) && (error.code === 'ECONNRESET' || error.response?.status === 429))) {
        console.log('[FeishuApi] Auto-retrying after', 1000 * (jobInfo.retryCount + 1), 'ms');
        return 1000 * (jobInfo.retryCount + 1); // 返回重试延迟(指数退避)
      }
      return undefined; // 不重试
    });

    this.limiter.on('error', (error) => {
      console.error('[FeishuApi] Limiter error:', error);
    });

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 添加响应拦截器用于错误处理
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[FeishuApi] Request failed:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    );

    // 初始化熔断器
    // 包装 axios 请求以提供熔断保护
    const breakerOptions = {
      timeout: 30000, // 30秒超时
      errorThresholdPercentage: 50, // 错误率超过 50% 时触发熔断
      resetTimeout: 30000, // 30秒后尝试恢复
      rollingCountTimeout: 60000, // 滚动窗口时间:60秒
      rollingCountBuckets: 10, // 滚动窗口分桶数
      name: 'FeishuApiBreaker', // 熔断器名称
    };

    // 创建熔断器,包装通用的 API 请求函数
    this.breaker = new CircuitBreaker(
      async (fn: () => Promise<any>) => {
        return await fn();
      },
      breakerOptions
    );

    // 监听熔断器事件
    this.breaker.on('open', () => {
      console.error('[FeishuApi] ⚠️  Circuit breaker opened - Too many failures, stopping requests temporarily');
    });

    this.breaker.on('halfOpen', () => {
      console.log('[FeishuApi] 🔄 Circuit breaker half-open - Testing recovery');
    });

    this.breaker.on('close', () => {
      console.log('[FeishuApi] ✅ Circuit breaker closed - Service recovered');
    });

    this.breaker.on('fallback', (result) => {
      console.warn('[FeishuApi] 🔀 Fallback triggered, returning:', result);
    });

    console.log('[FeishuApi] ✅ Initialized with rate limiter (5 QPS) and circuit breaker');
  }

  /**
   * 包装 API 请求,应用限流器和熔断器
   * @param fn API 请求函数
   * @returns API 响应
   */
  private async executeWithProtection<T>(fn: () => Promise<T>): Promise<T> {
    // 先通过限流器,再通过熔断器
    return this.limiter.schedule(() => this.breaker.fire(fn));
  }

  /**
   * 获取 tenant_access_token
   * 自动缓存并在过期前刷新
   */
  async getAccessToken(): Promise<string> {
    // 如果 token 存在且未过期,直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    console.log('[FeishuApi] Getting new access token...');
    console.log('[FeishuApi] Using credentials:', {
      appId: this.appId,
      appSecretLength: this.appSecret?.length || 0,
      baseUrl: this.baseUrl,
    });

    try {
      const response = await this.axiosInstance.post<AccessTokenResponse>(
        '/auth/v3/tenant_access_token/internal',
        {
          app_id: this.appId,
          app_secret: this.appSecret,
        }
      );

      console.log('[FeishuApi] Token response:', {
        code: response.data.code,
        msg: response.data.msg,
        hasToken: !!response.data.tenant_access_token,
        expire: response.data.expire,
      });

      if (response.data.code !== 0) {
        throw new Error(`Failed to get access token: ${response.data.msg}`);
      }

      this.accessToken = response.data.tenant_access_token;
      // 提前 5 分钟刷新 token
      this.tokenExpireTime = Date.now() + (response.data.expire - 300) * 1000;

      console.log('[FeishuApi] Access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      console.error('[FeishuApi] Failed to get access token:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('[FeishuApi] Response data:', error.response.data);
        console.error('[FeishuApi] Response status:', error.response.status);
      }
      throw error;
    }
  }

  /**
   * 创建单条记录
   */
  async createRecord(tableId: string, fields: Record<string, any>): Promise<string> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Creating record in table:', tableId);

    return this.executeWithProtection(async () => {
      try {
        const response = await this.axiosInstance.post<CreateRecordResponse>(
          `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records`,
          { fields },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.code !== 0) {
          throw new Error(`Failed to create record: ${response.data.msg}`);
        }

        const recordId = response.data.data.record.record_id;
        console.log('[FeishuApi] Record created with ID:', recordId);

        return recordId;
      } catch (error) {
        console.error('[FeishuApi] Failed to create record:', error);
        throw error;
      }
    });
  }

  /**
   * 批量创建记录
   */
  async batchCreateRecords(
    tableId: string,
    records: Array<{ fields: Record<string, any> }>
  ): Promise<string[]> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Batch creating', records.length, 'records in table:', tableId);

    try {
      const response = await this.axiosInstance.post(
        `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/batch_create`,
        { records },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to batch create records: ${response.data.msg}`);
      }

      const recordIds = response.data.data.records.map((r: any) => r.record_id);
      console.log('[FeishuApi] Created', recordIds.length, 'records');

      return recordIds;
    } catch (error) {
      console.error('[FeishuApi] Failed to batch create records:', error);
      throw error;
    }
  }

  /**
   * 搜索记录
   */
  async searchRecords(
    tableId: string,
    params: {
      filter?: any;
      sort?: any[];
      field_names?: string[];
      page_size?: number;
      page_token?: string;
    }
  ): Promise<SearchRecordsResponse['data']> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Searching records in table:', tableId);

    return this.executeWithProtection(async () => {
      try {
        const response = await this.axiosInstance.post<SearchRecordsResponse>(
          `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/search`,
          params,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.code !== 0) {
          throw new Error(`Failed to search records: ${response.data.msg}`);
        }

        console.log('[FeishuApi] Found', response.data.data.items.length, 'records');

        return response.data.data;
      } catch (error) {
        console.error('[FeishuApi] Failed to search records:', error);
        throw error;
      }
    });
  }

  /**
   * 更新记录
   */
  async updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, any>
  ): Promise<void> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Updating record:', recordId, 'in table:', tableId);

    return this.executeWithProtection(async () => {
      try {
        const response = await this.axiosInstance.put(
          `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`,
          { fields },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.code !== 0) {
          throw new Error(`Failed to update record: ${response.data.msg}`);
        }

        console.log('[FeishuApi] Record updated successfully');
      } catch (error) {
        console.error('[FeishuApi] Failed to update record:', error);
        throw error;
      }
    });
  }

  /**
   * 批量更新记录
   */
  async batchUpdateRecords(
    tableId: string,
    records: Array<{ record_id: string; fields: Record<string, any> }>
  ): Promise<void> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Batch updating', records.length, 'records in table:', tableId);

    return this.executeWithProtection(async () => {
      try {
        const response = await this.axiosInstance.post(
          `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/batch_update`,
          { records },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.code !== 0) {
          throw new Error(`Failed to batch update records: ${response.data.msg}`);
        }

        console.log('[FeishuApi] Records updated successfully');
      } catch (error) {
        console.error('[FeishuApi] Failed to batch update records:', error);
        throw error;
      }
    });
  }

  /**
   * 删除记录
   */
  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Deleting record:', recordId, 'from table:', tableId);

    try {
      const response = await this.axiosInstance.delete(
        `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to delete record: ${response.data.msg}`);
      }

      console.log('[FeishuApi] Record deleted successfully');
    } catch (error) {
      console.error('[FeishuApi] Failed to delete record:', error);
      throw error;
    }
  }

  /**
   * 上传图片到飞书云文档
   * @param imageBuffer 图片 Buffer
   * @param fileName 文件名
   * @returns 图片 Key(需要通过后端代理访问)
   *
   * 注意: 返回的是 image_key,前端需要通过后端代理路由来访问
   * 因为飞书 IM 图片需要 access_token 认证,不能直接在浏览器中访问
   */
  async uploadImage(imageBuffer: Buffer, fileName: string): Promise<string> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Uploading image:', fileName, `(${(imageBuffer.length / 1024).toFixed(2)}KB)`);

    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();

      formData.append('image_type', 'message');
      formData.append('image', imageBuffer, {
        filename: fileName,
        contentType: 'image/webp',
      });

      const response = await this.axiosInstance.post(
        '/im/v1/images',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...formData.getHeaders(),
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to upload image: ${response.data.msg}`);
      }

      const imageKey = response.data.data.image_key;
      console.log('[FeishuApi] Image uploaded successfully, key:', imageKey);

      // 返回 image_key,前端通过后端代理访问
      return imageKey;
    } catch (error) {
      console.error('[FeishuApi] Failed to upload image:', error);
      throw error;
    }
  }

  /**
   * 获取飞书图片内容(用于代理访问)
   * @param imageKey 图片key
   * @returns 图片 Buffer
   */
  async getImage(imageKey: string): Promise<Buffer> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get(
        `/im/v1/images/${imageKey}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('[FeishuApi] Failed to get image:', error);
      throw error;
    }
  }
}

// 导出单例
export default new FeishuApiService();
