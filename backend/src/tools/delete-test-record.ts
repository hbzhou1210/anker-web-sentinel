/**
 * 删除测试记录
 */

import axios from 'axios';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  return response.data.tenant_access_token;
}

async function deleteTestRecord() {
  const appId = 'cli_a875ff2f3859d00c';
  const appSecret = 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = 'tbluhAxEFP0f8CbJ';
  const recordId = 'recv6bdcIF6V01'; // 测试记录的 ID

  const accessToken = await getAccessToken(appId, appSecret);

  try {
    await axios.delete(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    console.log('✅ 测试记录已删除');
  } catch (error: any) {
    console.log('❌ 删除失败:', error.response?.data?.msg || error.message);
  }
}

deleteTestRecord();
