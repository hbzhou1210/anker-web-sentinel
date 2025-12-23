/**
 * 修复折扣规则查询报告表的字段类型
 * 删除错误的数字类型字段，重新创建为多行文本字段
 */

import axios from 'axios';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  return response.data.tenant_access_token;
}

async function fixFields() {
  const appId = 'cli_a875ff2f3859d00c';
  const appSecret = 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = 'tbluhAxEFP0f8CbJ';

  const accessToken = await getAccessToken(appId, appSecret);

  // 需要删除的字段 ID (数字类型的错误字段)
  const fieldsToDelete = [
    { name: 'rule_ids', id: 'fldqdQp31A' },
    { name: 'summary', id: 'fldWQKe9Ec' },
    { name: 'detail_results', id: 'fldftJjTVv' },
  ];

  // 需要重新创建的字段 (使用正确的类型)
  // 根据飞书 API 文档，多行文本应该是类型 1 with multiline property
  // 但实际上，让我们尝试不同的类型代码
  const fieldsToCreate = [
    {
      field_name: 'rule_ids',
      type: 1, // 单行文本 (JSON 字符串足够)
    },
    {
      field_name: 'summary',
      type: 1, // 单行文本 (JSON 字符串)
    },
    {
      field_name: 'detail_results',
      type: 1, // 单行文本 (我们会压缩数据)
    },
  ];

  console.log('🔧 开始修复字段类型...\n');

  // 删除错误的字段
  for (const field of fieldsToDelete) {
    try {
      console.log(`删除字段: ${field.name} (${field.id})`);
      await axios.delete(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${field.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      console.log(`  ✓ 已删除\n`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.log(`  ✗ 删除失败:`, error.response?.data?.msg || error.message, '\n');
    }
  }

  // 重新创建字段
  console.log('\n📝 重新创建字段...\n');
  for (const field of fieldsToCreate) {
    try {
      console.log(`创建字段: ${field.field_name}`);
      const response = await axios.post(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
        field,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`  ✓ 已创建 (ID: ${response.data.data.field.field_id})\n`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.log(`  ✗ 创建失败:`, error.response?.data?.msg || error.message, '\n');
    }
  }

  console.log('✅ 字段修复完成！\n');
}

fixFields();
