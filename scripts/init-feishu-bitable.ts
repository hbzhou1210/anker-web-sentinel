/**
 * 飞书多维表格初始化脚本
 *
 * 这个脚本会创建完整的多维表格结构,用于替代 PostgreSQL 数据库
 *
 * 使用方法:
 * 1. 确保已配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET
 * 2. 运行: npx tsx scripts/init-feishu-bitable.ts
 * 3. 记录输出的 app_token 和各个 table_id
 * 4. 更新 .env 文件
 */

import 'dotenv/config';

// 注意: 这个脚本需要在 Claude Code 环境中运行,因为它依赖 MCP 工具
// 实际执行时,应该通过 Claude Code 调用 MCP 工具

console.log('='.repeat(60));
console.log('飞书多维表格初始化脚本');
console.log('='.repeat(60));

console.log('\n📋 此脚本将创建以下数据表:');
console.log('  1. 测试报告 (test_reports)');
console.log('  2. 响应式测试结果 (responsive_test_results)');
console.log('  3. 设备预设 (device_presets)');
console.log('  4. 巡检任务 (patrol_tasks)');
console.log('  5. 巡检调度 (patrol_schedules)');
console.log('  6. 巡检执行记录 (patrol_executions)');

console.log('\n⚠️  注意事项:');
console.log('  - 此脚本需要在 Claude Code 中运行');
console.log('  - 需要配置飞书应用凭证: FEISHU_APP_ID 和 FEISHU_APP_SECRET');
console.log('  - 请准备好记录输出的 app_token 和 table_id');

console.log('\n🚀 准备就绪后,请让 Claude Code 执行 MCP 工具完成初始化');

// 数据表结构定义
export const tableDefinitions = {
  appName: 'Web自动化巡检系统',

  tables: [
    {
      name: '测试报告',
      description: '存储网页质量检测的测试报告',
      fields: [
        {
          field_name: 'id',
          type: 1005, // 自动编号
          ui_type: 'AutoNumber',
          description: { text: '记录唯一标识' },
        },
        {
          field_name: 'url',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: '测试的网页URL' },
        },
        {
          field_name: 'overall_score',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '综合健康评分(0-100)' },
        },
        {
          field_name: 'total_checks',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '总检查项数量' },
        },
        {
          field_name: 'passed_checks',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '通过的检查项' },
        },
        {
          field_name: 'failed_checks',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '失败的检查项' },
        },
        {
          field_name: 'warning_checks',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '警告的检查项' },
        },
        {
          field_name: 'test_duration',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '测试耗时(毫秒)' },
        },
        {
          field_name: 'completed_at',
          type: 5, // 日期
          ui_type: 'DateTime',
          property: {
            date_formatter: 'yyyy/MM/dd HH:mm',
          },
          description: { text: '完成时间' },
        },
        {
          field_name: 'status',
          type: 3, // 单选
          ui_type: 'SingleSelect',
          property: {
            options: [
              { name: 'completed', color: 0 },
              { name: 'failed', color: 1 },
            ],
          },
          description: { text: '测试状态' },
        },
      ],
    },
    {
      name: '响应式测试结果',
      description: '存储多设备响应式测试的详细结果',
      fields: [
        {
          field_name: 'id',
          type: 1005, // 自动编号
          ui_type: 'AutoNumber',
        },
        {
          field_name: 'test_report_id',
          type: 1, // 文本(临时使用,后续可改为关联字段)
          ui_type: 'Text',
          description: { text: '关联的测试报告ID' },
        },
        {
          field_name: 'device_name',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: '设备名称' },
        },
        {
          field_name: 'device_type',
          type: 3, // 单选
          ui_type: 'SingleSelect',
          property: {
            options: [
              { name: 'mobile', color: 0 },
              { name: 'tablet', color: 1 },
              { name: 'desktop', color: 2 },
            ],
          },
          description: { text: '设备类型' },
        },
        {
          field_name: 'viewport_width',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '视口宽度' },
        },
        {
          field_name: 'viewport_height',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '视口高度' },
        },
        {
          field_name: 'has_horizontal_scroll',
          type: 7, // 复选框
          ui_type: 'Checkbox',
          description: { text: '是否有横向滚动' },
        },
        {
          field_name: 'has_viewport_meta',
          type: 7, // 复选框
          ui_type: 'Checkbox',
          description: { text: '是否有viewport标签' },
        },
        {
          field_name: 'font_size_readable',
          type: 7, // 复选框
          ui_type: 'Checkbox',
          description: { text: '字体是否可读' },
        },
        {
          field_name: 'touch_targets_adequate',
          type: 7, // 复选框
          ui_type: 'Checkbox',
          description: { text: '触摸目标是否足够大' },
        },
        {
          field_name: 'images_responsive',
          type: 7, // 复选框
          ui_type: 'Checkbox',
          description: { text: '图片是否响应式' },
        },
        {
          field_name: 'screenshot_portrait_url',
          type: 15, // 超链接
          ui_type: 'Url',
          description: { text: '竖屏截图URL' },
        },
        {
          field_name: 'screenshot_landscape_url',
          type: 15, // 超链接
          ui_type: 'Url',
          description: { text: '横屏截图URL' },
        },
        {
          field_name: 'issues',
          type: 1, // 文本(存储JSON)
          ui_type: 'Text',
          description: { text: '问题详情(JSON格式)' },
        },
        {
          field_name: 'test_duration',
          type: 2, // 数字
          ui_type: 'Number',
          description: { text: '测试耗时(毫秒)' },
        },
        {
          field_name: 'created_at',
          type: 1001, // 创建时间
          ui_type: 'CreatedTime',
          property: {
            date_formatter: 'yyyy/MM/dd HH:mm',
            auto_fill: true,
          },
        },
      ],
    },
    {
      name: '设备预设',
      description: '常用测试设备的配置预设',
      fields: [
        {
          field_name: 'id',
          type: 1005, // 自动编号
          ui_type: 'AutoNumber',
        },
        {
          field_name: 'name',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: '设备名称' },
        },
        {
          field_name: 'device_type',
          type: 3, // 单选
          ui_type: 'SingleSelect',
          property: {
            options: [
              { name: 'mobile', color: 0 },
              { name: 'tablet', color: 1 },
              { name: 'desktop', color: 2 },
            ],
          },
        },
        {
          field_name: 'viewport_width',
          type: 2, // 数字
          ui_type: 'Number',
        },
        {
          field_name: 'viewport_height',
          type: 2, // 数字
          ui_type: 'Number',
        },
        {
          field_name: 'user_agent',
          type: 1, // 文本
          ui_type: 'Text',
        },
        {
          field_name: 'pixel_ratio',
          type: 2, // 数字
          ui_type: 'Number',
        },
        {
          field_name: 'has_touch',
          type: 7, // 复选框
          ui_type: 'Checkbox',
        },
        {
          field_name: 'is_mobile',
          type: 7, // 复选框
          ui_type: 'Checkbox',
        },
        {
          field_name: 'enabled',
          type: 7, // 复选框
          ui_type: 'Checkbox',
        },
      ],
    },
    {
      name: '巡检任务',
      description: '定时巡检任务配置',
      fields: [
        {
          field_name: 'id',
          type: 1005, // 自动编号
          ui_type: 'AutoNumber',
        },
        {
          field_name: 'name',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: '任务名称' },
        },
        {
          field_name: 'description',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: '任务描述' },
        },
        {
          field_name: 'urls',
          type: 1, // 文本(存储JSON)
          ui_type: 'Text',
          description: { text: 'URL列表(JSON格式)' },
        },
        {
          field_name: 'config',
          type: 1, // 文本(存储JSON)
          ui_type: 'Text',
          description: { text: '配置(JSON格式)' },
        },
        {
          field_name: 'notification_emails',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: '通知邮箱(逗号分隔)' },
        },
        {
          field_name: 'enabled',
          type: 7, // 复选框
          ui_type: 'Checkbox',
        },
        {
          field_name: 'created_at',
          type: 1001, // 创建时间
          ui_type: 'CreatedTime',
          property: {
            auto_fill: true,
          },
        },
        {
          field_name: 'updated_at',
          type: 1002, // 最后更新时间
          ui_type: 'ModifiedTime',
        },
      ],
    },
    {
      name: '巡检调度',
      description: '巡检任务的调度配置',
      fields: [
        {
          field_name: 'id',
          type: 1005, // 自动编号
          ui_type: 'AutoNumber',
        },
        {
          field_name: 'patrol_task_id',
          type: 1, // 文本(关联ID)
          ui_type: 'Text',
          description: { text: '关联的巡检任务ID' },
        },
        {
          field_name: 'cron_expression',
          type: 1, // 文本
          ui_type: 'Text',
          description: { text: 'Cron表达式' },
        },
        {
          field_name: 'schedule_type',
          type: 3, // 单选
          ui_type: 'SingleSelect',
          property: {
            options: [
              { name: 'daily_morning', color: 0 },
              { name: 'daily_afternoon', color: 1 },
              { name: 'custom', color: 2 },
            ],
          },
        },
        {
          field_name: 'time_zone',
          type: 1, // 文本
          ui_type: 'Text',
        },
        {
          field_name: 'enabled',
          type: 7, // 复选框
          ui_type: 'Checkbox',
        },
        {
          field_name: 'last_execution_at',
          type: 5, // 日期
          ui_type: 'DateTime',
        },
        {
          field_name: 'next_execution_at',
          type: 5, // 日期
          ui_type: 'DateTime',
        },
      ],
    },
    {
      name: '巡检执行记录',
      description: '巡检任务的执行历史记录',
      fields: [
        {
          field_name: 'id',
          type: 1005, // 自动编号
          ui_type: 'AutoNumber',
        },
        {
          field_name: 'patrol_task_id',
          type: 1, // 文本(关联ID)
          ui_type: 'Text',
        },
        {
          field_name: 'status',
          type: 3, // 单选
          ui_type: 'SingleSelect',
          property: {
            options: [
              { name: 'pending', color: 0 },
              { name: 'running', color: 1 },
              { name: 'completed', color: 2 },
              { name: 'failed', color: 3 },
            ],
          },
        },
        {
          field_name: 'started_at',
          type: 5, // 日期
          ui_type: 'DateTime',
        },
        {
          field_name: 'completed_at',
          type: 5, // 日期
          ui_type: 'DateTime',
        },
        {
          field_name: 'total_urls',
          type: 2, // 数字
          ui_type: 'Number',
        },
        {
          field_name: 'passed_urls',
          type: 2, // 数字
          ui_type: 'Number',
        },
        {
          field_name: 'failed_urls',
          type: 2, // 数字
          ui_type: 'Number',
        },
        {
          field_name: 'test_results',
          type: 1, // 文本(JSON)
          ui_type: 'Text',
          description: { text: '测试结果(JSON格式)' },
        },
        {
          field_name: 'email_sent',
          type: 7, // 复选框
          ui_type: 'Checkbox',
        },
        {
          field_name: 'email_sent_at',
          type: 5, // 日期
          ui_type: 'DateTime',
        },
        {
          field_name: 'error_message',
          type: 1, // 文本
          ui_type: 'Text',
        },
        {
          field_name: 'duration_ms',
          type: 2, // 数字
          ui_type: 'Number',
        },
      ],
    },
  ],
};

console.log('\n✅ 数据结构定义已加载');
console.log('📝 共定义', tableDefinitions.tables.length, '个数据表');
