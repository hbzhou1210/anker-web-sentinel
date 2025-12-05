import { query } from '../../database/connection.js';
import {
  ResponsiveTestResult,
  ResponsiveTestResultRow,
  DevicePreset,
  DevicePresetRow,
  DeviceType,
} from '../entities.js';

export class ResponsiveTestRepository {
  /**
   * 保存响应式测试结果
   */
  async saveResult(result: ResponsiveTestResult): Promise<string> {
    const sql = `
      INSERT INTO responsive_test_results (
        test_report_id, device_name, device_type, viewport_width, viewport_height,
        user_agent, has_horizontal_scroll, has_viewport_meta, font_size_readable,
        touch_targets_adequate, images_responsive, screenshot_portrait_url,
        screenshot_landscape_url, issues, test_duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    const values = [
      result.testReportId,
      result.deviceName,
      result.deviceType,
      result.viewportWidth,
      result.viewportHeight,
      result.userAgent,
      result.hasHorizontalScroll,
      result.hasViewportMeta,
      result.fontSizeReadable,
      result.touchTargetsAdequate,
      result.imagesResponsive,
      result.screenshotPortraitUrl || null,
      result.screenshotLandscapeUrl || null,
      JSON.stringify(result.issues),
      result.testDuration,
    ];

    const res = await query(sql, values);
    return res.rows[0].id;
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
    const sql = `
      SELECT * FROM responsive_test_results
      WHERE test_report_id = $1
      ORDER BY device_type, device_name
    `;

    const res = await query(sql, [reportId]);
    return res.rows.map((row: ResponsiveTestResultRow) => this.mapRowToEntity(row));
  }

  /**
   * 获取所有启用的设备预设
   */
  async getEnabledDevices(): Promise<DevicePreset[]> {
    const sql = `
      SELECT * FROM device_presets
      WHERE enabled = TRUE
      ORDER BY
        CASE device_type
          WHEN 'mobile' THEN 1
          WHEN 'tablet' THEN 2
          WHEN 'desktop' THEN 3
        END,
        name
    `;

    const res = await query(sql);
    return res.rows.map((row: DevicePresetRow) => this.mapDeviceRowToEntity(row));
  }

  /**
   * 获取指定类型的设备预设
   */
  async getDevicesByType(deviceType: DeviceType): Promise<DevicePreset[]> {
    const sql = `
      SELECT * FROM device_presets
      WHERE enabled = TRUE AND device_type = $1
      ORDER BY name
    `;

    const res = await query(sql, [deviceType]);
    return res.rows.map((row: DevicePresetRow) => this.mapDeviceRowToEntity(row));
  }

  /**
   * 添加自定义设备预设
   */
  async addDevicePreset(device: Omit<DevicePreset, 'id' | 'createdAt'>): Promise<number> {
    const sql = `
      INSERT INTO device_presets (
        name, device_type, viewport_width, viewport_height,
        user_agent, pixel_ratio, has_touch, is_mobile, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const values = [
      device.name,
      device.deviceType,
      device.viewportWidth,
      device.viewportHeight,
      device.userAgent,
      device.pixelRatio,
      device.hasTouch,
      device.isMobile,
      device.enabled,
    ];

    const res = await query(sql, values);
    return res.rows[0].id;
  }

  /**
   * 映射数据库行到实体
   */
  private mapRowToEntity(row: ResponsiveTestResultRow): ResponsiveTestResult {
    return {
      id: row.id,
      testReportId: row.test_report_id,
      deviceName: row.device_name,
      deviceType: row.device_type as DeviceType,
      viewportWidth: row.viewport_width,
      viewportHeight: row.viewport_height,
      userAgent: row.user_agent,
      hasHorizontalScroll: row.has_horizontal_scroll,
      hasViewportMeta: row.has_viewport_meta,
      fontSizeReadable: row.font_size_readable,
      touchTargetsAdequate: row.touch_targets_adequate,
      imagesResponsive: row.images_responsive,
      screenshotPortraitUrl: row.screenshot_portrait_url || undefined,
      screenshotLandscapeUrl: row.screenshot_landscape_url || undefined,
      issues: row.issues || [],
      testDuration: row.test_duration,
      createdAt: row.created_at,
    };
  }

  /**
   * 映射设备预设行到实体
   */
  private mapDeviceRowToEntity(row: DevicePresetRow): DevicePreset {
    return {
      id: row.id,
      name: row.name,
      deviceType: row.device_type as DeviceType,
      viewportWidth: row.viewport_width,
      viewportHeight: row.viewport_height,
      userAgent: row.user_agent,
      pixelRatio: parseFloat(row.pixel_ratio),
      hasTouch: row.has_touch,
      isMobile: row.is_mobile,
      enabled: row.enabled,
      createdAt: row.created_at,
    };
  }
}
