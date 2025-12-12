import fetch from 'node-fetch';

/**
 * MCP客户端配置
 */
const MCP_CONFIG = {
  url: 'http://beta-dtc-mcp.anker-in.com/mcp/tc_y7odih2ds',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': 'Bearer mcpt_dc0f56690e00e98e7342e3ebf9c20f4a887a50c61eba20f0a888253495c47ec0'
  }
};

let requestId = 1;

/**
 * 调用MCP工具
 * @param {string} toolName - 工具名称
 * @param {object} args - 工具参数
 * @returns {Promise<object>} 返回结果
 */
async function callMcpTool(toolName, args) {
  // 创建超时控制器
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000); // 60秒超时

  try {
    const response = await fetch(MCP_CONFIG.url, {
      method: 'POST',
      headers: MCP_CONFIG.headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: requestId++
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const result = await response.json();

    if (result.error) {
      throw new Error(`MCP错误: ${result.error.message}`);
    }

    // 解析返回的内容
    if (result.result && result.result.content && result.result.content.length > 0) {
      const textContent = result.result.content[0].text;

      // 尝试解析JSON，如果失败则返回原始文本
      try {
        return JSON.parse(textContent);
      } catch (e) {
        console.error('JSON解析失败，返回原始内容:', textContent);
        return { raw: textContent, parseError: e.message };
      }
    }

    throw new Error('MCP返回数据格式错误');
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      console.error(`调用MCP工具 ${toolName} 超时(60秒)`);
      throw new Error(`MCP请求超时(60秒): ${toolName}`);
    }

    console.error(`调用MCP工具 ${toolName} 失败:`, error.message);
    throw error;
  }
}

/**
 * 获取Function折扣规则详情
 * @param {number} ruleId - 规则ID
 * @param {string} shopDomain - 店铺域名
 * @returns {Promise<object>} 规则详情
 */
export async function getFunctionDiscountRuleDetail(ruleId, shopDomain) {
  console.log(`正在查询规则详情: rule_id=${ruleId}, shop_domain=${shopDomain}`);
  return await callMcpTool('get_function_discount_rule_detail', {
    rule_id: ruleId,
    shop_domain: shopDomain
  });
}

/**
 * 查询Metafield列表
 * @param {string} shopDomain - 店铺域名
 * @param {number} ownerId - 资源ID（variant_id）
 * @param {string} ownerResource - 资源类型（可选）
 * @returns {Promise<object>} Metafield列表
 */
export async function getMetafieldList(shopDomain, ownerId, ownerResource) {
  console.log(`正在查询Metafield: owner_id=${ownerId}${ownerResource ? `, owner_resource=${ownerResource}` : ''}`);
  const params = {
    shopify_domain: shopDomain,
    owner_id: String(ownerId),  // 转换为字符串
    page_size: 100,
    page: 1
  };

  // 只有提供了 ownerResource 才添加到参数中
  if (ownerResource) {
    params.owner_resource = ownerResource;
  }

  return await callMcpTool('dimp_metafield_list', params);
}
