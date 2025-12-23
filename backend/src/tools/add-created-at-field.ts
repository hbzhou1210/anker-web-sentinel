/**
 * 添加 created_at 日期字段
 */

import axios from 'axios';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  return response.data.tenant_access_token;
}

async function addCreatedAtField() {
  const appId = 'cli_a875ff2f3859d00c';
  const appSecret = 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = 'tbluhAxEFP0f8CbJ';

  const accessToken = await getAccessToken(appId, appSecret);

  // 尝试不同的日期字段配置
  const dateFieldConfigs = [
    // 配置1: 不带 property
    {
      field_name: 'created_at',
      type: 5,
    },
    // 配置2: 最简单的 property
    {
      field_name: 'created_at',
      type: 5,
      property: {},
    },
    // 配置3: 只有日期格式
    {
      field_name: 'created_at',
      type: 5,
      property: {
        date_format: 'yyyy/MM/dd',
      },
    },
  ];

  for (let i = 0; i < dateFieldConfigs.length; i++) {
    console.log(`\n尝试配置 ${i + 1}:`, JSON.stringify(dateFieldConfigs[i], null, 2));
    try {
      const response = await axios.post(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
        dateFieldConfigs[i],
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ 成功:', JSON.stringify(response.data, null, 2));
      break; // 成功后退出
    } catch (error: any) {
      console.log('❌ 失败:', JSON.stringify(error.response?.data, null, 2) || error.message);
    }
  }
}

addCreatedAtField();
