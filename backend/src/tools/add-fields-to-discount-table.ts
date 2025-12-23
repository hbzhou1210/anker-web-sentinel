/**
 * 给已存在的折扣规则查询报告表添加字段
 *
 * 用法: npx tsx src/tools/add-fields-to-discount-table.ts
 */

import axios from 'axios';

// 获取飞书 Access Token
async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });

  if (response.data.code !== 0) {
    throw new Error(`获取 Access Token 失败: ${response.data.msg}`);
  }

  return response.data.tenant_access_token;
}

async function addFieldsToTable() {
  console.log('🚀 开始给折扣规则查询报告表添加字段...\n');

  const appId = process.env.FEISHU_APP_ID || 'cli_a875ff2f3859d00c';
  const appSecret = process.env.FEISHU_APP_SECRET || 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN || 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = process.env.FEISHU_TABLE_DISCOUNT_REPORTS || 'tbluhAxEFP0f8CbJ';

  try {
    // 获取 Access Token
    console.log('🔑 获取 Access Token...');
    const accessToken = await getAccessToken(appId, appSecret);
    console.log('✅ Access Token 获取成功\n');

    console.log(`📋 给表 ${tableId} 添加字段...\n`);

    const fields = [
      {
        field_name: 'record_id',
        type: 1, // 单行文本
      },
      {
        field_name: 'report_id',
        type: 1, // 单行文本
        // description: '报告 ID (timestamp)',
      },
      {
        field_name: 'type',
        type: 3, // 单选
        // description: '查询类型',
        property: {
          options: [
            { name: 'single', color: 0 },
            { name: 'batch', color: 1 },
          ],
        },
      },
      {
        field_name: 'shop_domain',
        type: 1, // 单行文本
        // description: '店铺域名',
      },
      {
        field_name: 'rule_ids',
        type: 2, // 多行文本
        // description: 'JSON 数组格式 "[1,2,3]"',
      },
      {
        field_name: 'created_at',
        type: 5, // 日期
        // description: '创建时间',
        property: {
          date_format: 'yyyy/MM/dd HH:mm',
          time_format: 'HH:mm',
          auto_fill: false,
        },
      },
      {
        field_name: 'summary',
        type: 2, // 多行文本
        // description: 'JSON 格式摘要',
      },
      {
        field_name: 'detail_results',
        type: 2, // 多行文本
        // description: 'JSON 或压缩数据',
      },
      {
        field_name: 'status',
        type: 3, // 单选
        // description: '报告状态',
        property: {
          options: [
            { name: 'active', color: 0 },
            { name: 'inactive', color: 1 },
            { name: 'error', color: 2 },
          ],
        },
      },
      {
        field_name: 'html_report_url',
        type: 15, // 网址
        // description: 'HTML 报告链接',
      },
    ];

    let successCount = 0;
    let failCount = 0;

    for (const field of fields) {
      try {
        const createFieldResponse = await axios.post(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
          field, // 直接传字段对象,不用包裹
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (createFieldResponse.data.code !== 0) {
          console.error(`  ✗ 创建字段 ${field.field_name} 失败:`, createFieldResponse.data.msg);
          failCount++;
        } else {
          console.log(`  ✓ 创建字段: ${field.field_name} (${getFieldTypeName(field.type)})`);
          successCount++;
        }

        // 添加延迟,避免触发限流
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`  ✗ 创建字段 ${field.field_name} 失败:`, error.response?.data?.msg || error.message);
        failCount++;
      }
    }

    console.log(`\n✅ 字段添加完成！成功: ${successCount}, 失败: ${failCount}\n`);
    console.log('📋 配置信息:');
    console.log('─'.repeat(60));
    console.log(`App Token: ${appToken}`);
    console.log(`Table ID:  ${tableId}`);
    console.log(`Table URL: https://anker-in.feishu.cn/base/${appToken}?table=${tableId}`);
    console.log('─'.repeat(60));
    console.log('\n🎉 完成！现在可以使用买赠规则查询功能并保存到 Bitable 了。\n');

  } catch (error: any) {
    console.error('❌ 添加字段失败:', error);
    console.error('错误详情:', error.response?.data || error.message);
    process.exit(1);
  }
}

function getFieldTypeName(type: number): string {
  const typeNames: Record<number, string> = {
    1: '单行文本',
    2: '多行文本',
    3: '单选',
    4: '多选',
    5: '日期',
    7: '复选框',
    11: '人员',
    13: '电话号码',
    15: '网址',
    17: '附件',
    18: '单向关联',
    19: '查找',
    20: '公式',
    21: '双向关联',
    22: '地理位置',
    23: '条形码',
  };
  return typeNames[type] || `类型${type}`;
}

// 运行脚本
addFieldsToTable().catch((error) => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
