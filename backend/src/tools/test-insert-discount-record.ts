/**
 * 测试插入折扣规则查询报告记录
 */

import axios from 'axios';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  return response.data.tenant_access_token;
}

async function testInsertRecord() {
  const appId = 'cli_a875ff2f3859d00c';
  const appSecret = 'MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E';
  const appToken = 'X66Mb4mPRagcrSsBlRQcNrHQnKh';
  const tableId = 'tbluhAxEFP0f8CbJ';

  const accessToken = await getAccessToken(appId, appSecret);

  // 测试数据
  const testRecord = {
    fields: {
      record_id: 'test-001',
      report_id: '1234567890',
      type: 'single',
      shop_domain: 'test.myshopify.com',
      rule_ids: JSON.stringify([910]),
      created_at: Date.now(), // 毫秒时间戳
      summary: JSON.stringify({
        ruleId: 910,
        status: 'active',
        totalVariants: 10,
        activeVariants: 8,
        inactiveVariants: 2,
        errorVariants: 0,
      }),
      detail_results: JSON.stringify({ test: 'data' }),
      status: 'active',
      html_report_url: {
        link: 'http://example.com/report.html',
        text: 'View Report'
      },
    },
  };

  console.log('尝试插入记录:', JSON.stringify(testRecord, null, 2));

  try {
    const response = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      testRecord,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('\n✅ 成功:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('\n❌ 失败:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

testInsertRecord();
