/**
 * 列出表的所有字段
 */

import axios from 'axios';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  return response.data.tenant_access_token;
}

async function listTableFields() {
  const appId = 'cli_a875ff2f3859d00c';
  const appSecret = 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = 'tbluhAxEFP0f8CbJ';

  const accessToken = await getAccessToken(appId, appSecret);

  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('表字段列表:');
    console.log('─'.repeat(80));

    if (response.data.data && response.data.data.items) {
      response.data.data.items.forEach((field: any, index: number) => {
        console.log(`${index + 1}. ${field.field_name}`);
        console.log(`   - ID: ${field.field_id}`);
        console.log(`   - 类型: ${field.type} (${field.ui_type})`);
        console.log(`   - 主键: ${field.is_primary ? '是' : '否'}`);
        if (field.property) {
          console.log(`   - 属性: ${JSON.stringify(field.property)}`);
        }
        console.log('');
      });
    }

    console.log('─'.repeat(80));
    console.log(`总共 ${response.data.data.items.length} 个字段`);
  } catch (error: any) {
    console.log('❌ 失败:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

listTableFields();
