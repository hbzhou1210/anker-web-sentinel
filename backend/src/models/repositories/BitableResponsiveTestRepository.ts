/**
 * 飞书多维表格响应式测试 Repository
 *
 * 实现与 ResponsiveTestRepository 相同的接口,但使用飞书多维表格作为存储
 */

import feishuApiService from '../../services/FeishuApiService.js';
import { FEISHU_BITABLE_CONFIG } from '../../config/feishu-bitable.config.js';
import {
  ResponsiveTestResult,
  DevicePreset,
  DeviceType,
} from '../entities.js';
import { v4 as uuidv4 } from 'uuid';

export class BitableResponsiveTestRepository {
  private readonly responsiveResultsTableId = FEISHU_BITABLE_CONFIG.tables.responsiveTestResults;
  private readonly devicePresetsTableId = FEISHU_BITABLE_CONFIG.tables.devicePresets;

  /**
   * 从飞书富文本格式提取纯文本
   */
  private extractText(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field) && field.length > 0 && field[0].text) {
      return field[0].text;
    }
    return '';
  }

  /**
   * 将飞书记录转换为响应式测试结果实体
   */
  private recordToResponsiveResult(record: any): ResponsiveTestResult {
    const fields = record.fields;

    const idText = this.extractText(fields.id);
    const reportIdText = this.extractText(fields.test_report_id);
    const deviceNameText = this.extractText(fields.device_name);
    const deviceTypeText = this.extractText(fields.device_type);
    const userAgentText = this.extractText(fields.user_agent);
    const portraitUrlText = this.extractText(fields.screenshot_portrait_url);
    const landscapeUrlText = this.extractText(fields.screenshot_landscape_url);
    const issuesText = this.extractText(fields.issues);

    return {
      id: idText || record.record_id,
      testReportId: reportIdText,
      deviceName: deviceNameText,
      deviceType: deviceTypeText as DeviceType,
      viewportWidth: fields.viewport_width,
      viewportHeight: fields.viewport_height,
      userAgent: userAgentText,
      hasHorizontalScroll: fields.has_horizontal_scroll === true,
      hasViewportMeta: fields.has_viewport_meta === true,
      fontSizeReadable: fields.font_size_readable === true,
      touchTargetsAdequate: fields.touch_targets_adequate === true,
      imagesResponsive: fields.images_responsive === true,
      screenshotPortraitUrl: portraitUrlText || undefined,
      screenshotLandscapeUrl: landscapeUrlText || undefined,
      issues: issuesText ? JSON.parse(issuesText) : [],
      testDuration: fields.test_duration || 0,
      createdAt: new Date(fields.created_at || Date.now()),
    };
  }

  /**
   * 将飞书记录转换为设备预设实体
   */
  private recordToDevicePreset(record: any): DevicePreset {
    const fields = record.fields;

    const idText = this.extractText(fields.id);
    const nameText = this.extractText(fields.name);
    const deviceTypeText = this.extractText(fields.device_type);
    const userAgentText = this.extractText(fields.user_agent);

    return {
      id: idText || record.record_id,
      name: nameText,
      deviceType: deviceTypeText as DeviceType,
      viewportWidth: fields.viewport_width,
      viewportHeight: fields.viewport_height,
      userAgent: userAgentText,
      pixelRatio: fields.pixel_ratio || 1,
      hasTouch: fields.has_touch === true,
      isMobile: fields.is_mobile === true,
      enabled: fields.enabled === true,
      createdAt: new Date(fields.created_at || Date.now()),
    };
  }

  /**
   * 保存响应式测试结果
   */
  async saveResult(result: ResponsiveTestResult): Promise<string> {
    const id = result.id || uuidv4();

    const fields = {
      id,
      test_report_id: result.testReportId,
      device_name: result.deviceName,
      device_type: result.deviceType,
      viewport_width: result.viewportWidth,
      viewport_height: result.viewportHeight,
      user_agent: result.userAgent,
      has_horizontal_scroll: result.hasHorizontalScroll,
      has_viewport_meta: result.hasViewportMeta,
      font_size_readable: result.fontSizeReadable,
      touch_targets_adequate: result.touchTargetsAdequate,
      images_responsive: result.imagesResponsive,
      screenshot_portrait_url: result.screenshotPortraitUrl || '',
      screenshot_landscape_url: result.screenshotLandscapeUrl || '',
      issues: JSON.stringify(result.issues || []),
      test_duration: result.testDuration,
      created_at: result.createdAt ? result.createdAt.getTime() : Date.now(),
    };

    await feishuApiService.createRecord(this.responsiveResultsTableId, fields);

    return id;
  }

  /**
   * 批量保存响应式测试结果
   */
  async saveResults(results: ResponsiveTestResult[]): Promise<void> {
    for (const result of results) {
      await this.saveResult(result);
    }
  }

  /**
   * 获取测试报告的响应式测试结果
   */
  async getByReportId(reportId: string): Promise<ResponsiveTestResult[]> {
    const result = await feishuApiService.searchRecords(this.responsiveResultsTableId, {
      filter: {
        conditions: [
          {
            field_name: 'test_report_id',
            operator: 'is',
            value: [reportId],
          },
        ],
        conjunction: 'and',
      },
      page_size: 500,
    });

    return result.items
      .map((record: any) => this.recordToResponsiveResult(record))
      .sort((a: ResponsiveTestResult, b: ResponsiveTestResult) => {
        // 排序: mobile < tablet < desktop, 然后按名称
        const typeOrder = { mobile: 1, tablet: 2, desktop: 3 };
        const typeCompare = typeOrder[a.deviceType] - typeOrder[b.deviceType];
        if (typeCompare !== 0) return typeCompare;
        return a.deviceName.localeCompare(b.deviceName);
      });
  }


  /**
   * 获取所有启用的设备预设
   */
  async getEnabledDevices(): Promise<DevicePreset[]> {
    const result = await feishuApiService.searchRecords(this.devicePresetsTableId, {
      filter: {
        conditions: [
          {
            field_name: 'enabled',
            operator: 'is',
            value: [true],
          },
        ],
        conjunction: 'and',
      },
      page_size: 500,
    });

    const devices = result.items.map((record: any) => this.recordToDevicePreset(record));

    return devices.sort((a: DevicePreset, b: DevicePreset) => {
      // 排序: mobile < tablet < desktop, 然后按名称
      const typeOrder = { mobile: 1, tablet: 2, desktop: 3 };
      const typeCompare = typeOrder[a.deviceType] - typeOrder[b.deviceType];
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 获取指定类型的设备预设
   */
  async getDevicesByType(deviceType: DeviceType): Promise<DevicePreset[]> {
    const result = await feishuApiService.searchRecords(this.devicePresetsTableId, {
      filter: {
        conditions: [
          {
            field_name: 'enabled',
            operator: 'is',
            value: [true],
          },
          {
            field_name: 'device_type',
            operator: 'is',
            value: [deviceType],
          },
        ],
        conjunction: 'and',
      },
      page_size: 500,
    });

    const devices = result.items.map((record: any) => this.recordToDevicePreset(record));

    return devices.sort((a: DevicePreset, b: DevicePreset) => a.name.localeCompare(b.name));
  }

  /**
   * 添加自定义设备预设
   */
  async addDevicePreset(device: Omit<DevicePreset, 'id' | 'createdAt'>): Promise<number> {
    // 注意: 设备预设表没有 id 字段,使用 record_id 作为唯一标识
    const fields = {
      name: device.name,
      device_type: device.deviceType,
      viewport_width: device.viewportWidth,
      viewport_height: device.viewportHeight,
      user_agent: device.userAgent,
      pixel_ratio: device.pixelRatio,
      has_touch: device.hasTouch,
      is_mobile: device.isMobile,
      enabled: device.enabled,
      created_at: Date.now(),
    };

    await feishuApiService.createRecord(this.devicePresetsTableId, fields);

    // 返回一个数字ID (为了兼容旧接口, 使用时间戳的后6位)
    return parseInt(Date.now().toString().slice(-6));
  }
}
