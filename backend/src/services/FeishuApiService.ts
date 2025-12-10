/**
 * 飞书 API 服务
 *
 * 直接调用飞书开放平台 HTTP API,不依赖 MCP 工具
 * 支持在生产环境中运行
 */

import axios, { AxiosInstance } from 'axios';
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

  constructor() {
    this.appId = process.env.FEISHU_APP_ID || FEISHU_BITABLE_CONFIG.appId;
    this.appSecret = process.env.FEISHU_APP_SECRET || FEISHU_BITABLE_CONFIG.appSecret;
    this.appToken = FEISHU_BITABLE_CONFIG.appToken;

    if (!this.appId || !this.appSecret) {
      console.warn('[FeishuApi] Warning: FEISHU_APP_ID or FEISHU_APP_SECRET not configured');
    }

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

    try {
      const response = await this.axiosInstance.post<AccessTokenResponse>(
        '/auth/v3/tenant_access_token/internal',
        {
          app_id: this.appId,
          app_secret: this.appSecret,
        }
      );

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
      throw error;
    }
  }

  /**
   * 创建单条记录
   */
  async createRecord(tableId: string, fields: Record<string, any>): Promise<string> {
    const token = await this.getAccessToken();

    console.log('[FeishuApi] Creating record in table:', tableId);
    console.log('[FeishuApi] Fields:', JSON.stringify(fields, null, 2));

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
    console.log('[FeishuApi] Search params:', JSON.stringify(params, null, 2));

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
}

// 导出单例
export default new FeishuApiService();
