/**
 * 测试创建单个字段
 */

import axios from 'axios';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  return response.data.tenant_access_token;
}

async function testCreateField() {
  const appId = 'cli_a875ff2f3859d00c';
  const appSecret = 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = 'tbluhAxEFP0f8CbJ';

  const accessToken = await getAccessToken(appId, appSecret);

  // 测试1: 不用 field 包裹
  console.log('测试1: 创建字段 (不用 field 包裹)...');
  try {
    const response = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      {
        field_name: 'test_field',
        type: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('成功:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('失败:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }

  // 测试2: 带 description 的字段
  console.log('\n测试2: 创建带 description 的字段...');
  try {
    const response = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      {
        field: {
          field_name: 'test_field_2',
          type: 1,
          description: '测试字段描述',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('成功:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('失败:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

testCreateField();
