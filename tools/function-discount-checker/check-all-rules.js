#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 全量检查店铺的买赠规则状态
 *
 * 注意: 使用 Node.js 内置 fetch (Node 18+)，不需要 node-fetch 依赖
 */

// 从环境变量读取MCP配置
const MCP_CONFIG = {
  url: process.env.MCP_SERVER_URL || 'http://beta-dtc-mcp.anker-in.com/mcp/tc_y7odih2ds',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${process.env.MCP_SERVER_TOKEN || 'mcpt_dc0f56690e00e98e7342e3ebf9c20f4a887a50c61eba20f0a888253495c47ec0'}`
  }
};

// 验证MCP配置
if (!process.env.MCP_SERVER_URL) {
  console.warn('⚠️  MCP_SERVER_URL 未配置，使用默认值');
}
if (!process.env.MCP_SERVER_TOKEN) {
  console.warn('⚠️  MCP_SERVER_TOKEN 未配置，使用默认值');
}

let requestId = 1;

async function callMcpTool(toolName, args) {
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
      })
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(`MCP错误: ${result.error.message}`);
    }

    if (result.result && result.result.content && result.result.content.length > 0) {
      const textContent = result.result.content[0].text;
      try {
        return JSON.parse(textContent);
      } catch (e) {
        return { raw: textContent, parseError: e.message };
      }
    }

    throw new Error('MCP返回数据格式错误');
  } catch (error) {
    console.error(`调用MCP工具 ${toolName} 失败:`, error.message);
    throw error;
  }
}

// 获取规则列表
async function getRulesList(shopDomain) {
  console.log(`\n🔍 查询店铺规则列表: ${shopDomain}`);

  const allRules = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const result = await callMcpTool('list_discount_rules', {
      page,
      pageSize,
      shop_domain: shopDomain,
      rule_type: 1  // 买赠规则
    });

    if (result.code !== 0 || !result.data) {
      throw new Error(`获取规则列表失败: ${result.msg}`);
    }

    const { list, total } = result.data;

    // 筛选状态为1(生效)或4(过期)的规则
    const filteredRules = list.filter(rule =>
      rule.rule_status === 1 || rule.rule_status === 4
    );

    allRules.push(...filteredRules);

    console.log(`   第 ${page} 页: 找到 ${filteredRules.length} 条符合条件的规则 (共 ${list.length} 条)`);

    if (page * pageSize >= total) {
      break;
    }
    page++;
  }

  console.log(`✅ 共找到 ${allRules.length} 条买赠规则 (状态为生效或过期)\n`);
  return allRules;
}

// 获取规则详情
async function getRuleDetail(ruleId, shopDomain) {
  const result = await callMcpTool('get_function_discount_rule_detail', {
    rule_id: ruleId,
    shop_domain: shopDomain
  });

  if (result.code !== 0 || !result.data) {
    throw new Error(`获取规则详情失败: ${result.msg}`);
  }

  return result.data;
}

// 检查variant的metafield
async function checkVariantMetafield(variantId, ruleId, shopDomain) {
  try {
    const result = await callMcpTool('dimp_metafield_list', {
      shopify_domain: shopDomain,
      owner_resource: 'variant',
      owner_id: variantId.toString(),
      page: 1,
      page_size: 50
    });

    if (result.code !== 0 || !result.data) {
      return {
        success: false,
        error: `查询metafield失败: ${result.msg}`,
        metafields: []
      };
    }

    const metafields = result.data.list || [];

    // 查找 fe_auto_gift_into_cart 的 metafield
    const giftMetafield = metafields.find(m =>
      m.key === 'fe_auto_gift_into_cart'
    );

    // 检查value中是否包含rule_id
    let valueContainsRuleId = false;
    if (giftMetafield && giftMetafield.value) {
      try {
        // 尝试解析JSON
        const valueObj = JSON.parse(giftMetafield.value);
        valueContainsRuleId = valueObj.rule_id === ruleId;
      } catch (e) {
        // 如果不是JSON,则直接字符串匹配
        valueContainsRuleId = giftMetafield.value.includes(ruleId.toString());
      }
    }

    return {
      success: true,
      metafields,
      giftMetafield,
      hasGiftMetafield: !!giftMetafield,
      valueContainsRuleId
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      metafields: []
    };
  }
}

// 检查单个规则的状态
async function checkRule(rule, shopDomain) {
  console.log(`\n📋 检查规则 ${rule.rule_id}: ${rule.rule_name}`);
  console.log(`   状态: ${rule.rule_status === 1 ? '生效' : '过期'}`);

  try {
    // 获取规则详情
    const detail = await getRuleDetail(rule.rule_id, shopDomain);

    // 提取所有 variant_id
    const variantIds = [];
    if (detail.rule_detail && detail.rule_detail.main_product_list) {
      detail.rule_detail.main_product_list.forEach(product => {
        if (product.variants) {
          product.variants.forEach(variant => {
            variantIds.push({
              variant_id: variant.variant_id,
              sku: variant.sku,
              title: variant.title,
              product_title: product.product_title
            });
          });
        }
      });
    }

    console.log(`   找到 ${variantIds.length} 个 variant`);

    // 并发检查所有 variants (限制并发数为10)
    const variantResults = [];
    const concurrencyLimit = 10;

    for (let i = 0; i < variantIds.length; i += concurrencyLimit) {
      const batch = variantIds.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.all(
        batch.map(async (variant) => {
          console.log(`   检查 variant ${variant.variant_id} (${variant.sku})...`);

          const metafieldCheck = await checkVariantMetafield(
            variant.variant_id,
            rule.rule_id,
            shopDomain
          );

          // 调试信息
          if (rule.rule_id === 925 && variant.variant_id === 51758704459960) {
            console.log(`      [DEBUG] metafieldCheck:`, JSON.stringify(metafieldCheck, null, 2).substring(0, 300));
          }

          // 判断状态是否正常
          let isNormal = false;
          let message = '';

          if (rule.rule_status === 1) {
            // 生效状态: 应该有 fe_auto_gift_into_cart 且 value 包含 rule_id
            isNormal = metafieldCheck.hasGiftMetafield && metafieldCheck.valueContainsRuleId;
            message = isNormal ?
              '✅ 买赠折扣正常生效' :
              '❌ 买赠折扣未正常生效';
          } else if (rule.rule_status === 4) {
            // 过期状态: 不应该有 fe_auto_gift_into_cart
            isNormal = !metafieldCheck.hasGiftMetafield;
            message = isNormal ?
              '✅ 买赠折扣正常失效' :
              '❌ 买赠折扣未正常失效';
          }

          console.log(`      ${message}`);

          return {
            variant,
            metafieldCheck,
            isNormal,
            message
          };
        })
      );

      variantResults.push(...batchResults);
    }

    return {
      rule,
      detail,
      variantResults,
      success: true
    };

  } catch (error) {
    console.error(`   ❌ 检查失败: ${error.message}`);
    return {
      rule,
      error: error.message,
      success: false
    };
  }
}

// 生成 HTML 报告
function generateHtmlReport(shopDomain, results, timestamp) {
  const totalRules = results.length;
  const successRules = results.filter(r => r.success).length;
  const failedRules = totalRules - successRules;

  let totalVariants = 0;
  let normalVariants = 0;
  let abnormalVariants = 0;

  results.forEach(r => {
    if (r.success && r.variantResults) {
      totalVariants += r.variantResults.length;
      normalVariants += r.variantResults.filter(v => v.isNormal).length;
      abnormalVariants += r.variantResults.filter(v => !v.isNormal).length;
    }
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>买赠规则全量检查报告 - ${shopDomain}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #f5f7fa;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header .meta {
      opacity: 0.9;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .summary-card.success { border-left-color: #10b981; }
    .summary-card.warning { border-left-color: #f59e0b; }
    .summary-card.error { border-left-color: #ef4444; }
    .summary-card .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #1f2937;
    }
    .content {
      padding: 30px;
    }
    .rule-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .rule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e9ecef;
    }
    .rule-title {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
    }
    .rule-id {
      font-size: 14px;
      color: #6b7280;
      margin-left: 10px;
    }
    .status-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-active {
      background: #d1fae5;
      color: #065f46;
    }
    .status-expired {
      background: #fee2e2;
      color: #991b1b;
    }
    .variant-list {
      display: grid;
      gap: 15px;
    }
    .variant-item {
      background: white;
      border-radius: 6px;
      padding: 15px;
      border-left: 3px solid #e5e7eb;
    }
    .variant-item.normal {
      border-left-color: #10b981;
    }
    .variant-item.abnormal {
      border-left-color: #ef4444;
    }
    .variant-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .variant-title {
      font-weight: 600;
      color: #374151;
    }
    .variant-sku {
      font-size: 13px;
      color: #6b7280;
      margin-left: 8px;
    }
    .variant-status {
      font-size: 13px;
      font-weight: 600;
    }
    .variant-status.success {
      color: #10b981;
    }
    .variant-status.error {
      color: #ef4444;
    }
    .metafield-info {
      margin-top: 10px;
      padding: 10px;
      background: #f9fafb;
      border-radius: 4px;
      font-size: 13px;
      color: #6b7280;
    }
    .error-card {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 15px;
      color: #991b1b;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 13px;
      border-top: 1px solid #e9ecef;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎁 买赠规则全量检查报告</h1>
      <div class="meta">
        <div>店铺: ${shopDomain}</div>
        <div>生成时间: ${new Date(timestamp).toLocaleString('zh-CN')}</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="label">检查规则数</div>
        <div class="value">${totalRules}</div>
      </div>
      <div class="summary-card success">
        <div class="label">检查成功</div>
        <div class="value">${successRules}</div>
      </div>
      <div class="summary-card error">
        <div class="label">检查失败</div>
        <div class="value">${failedRules}</div>
      </div>
      <div class="summary-card">
        <div class="label">总 Variant 数</div>
        <div class="value">${totalVariants}</div>
      </div>
      <div class="summary-card success">
        <div class="label">状态正常</div>
        <div class="value">${normalVariants}</div>
      </div>
      <div class="summary-card warning">
        <div class="label">状态异常</div>
        <div class="value">${abnormalVariants}</div>
      </div>
    </div>

    <div class="content">
      ${results.map(result => {
        if (!result.success) {
          return `
            <div class="rule-card">
              <div class="rule-header">
                <div>
                  <span class="rule-title">${result.rule.rule_name}</span>
                  <span class="rule-id">ID: ${result.rule.rule_id}</span>
                </div>
                <span class="status-badge ${result.rule.rule_status === 1 ? 'status-active' : 'status-expired'}">
                  ${result.rule.rule_status === 1 ? '生效' : '过期'}
                </span>
              </div>
              <div class="error-card">
                ❌ 检查失败: ${result.error}
              </div>
            </div>
          `;
        }

        return `
          <div class="rule-card">
            <div class="rule-header">
              <div>
                <span class="rule-title">${result.rule.rule_name}</span>
                <span class="rule-id">ID: ${result.rule.rule_id}</span>
              </div>
              <span class="status-badge ${result.rule.rule_status === 1 ? 'status-active' : 'status-expired'}">
                ${result.rule.rule_status === 1 ? '生效' : '过期'}
              </span>
            </div>
            <div class="variant-list">
              ${result.variantResults.map(vr => `
                <div class="variant-item ${vr.isNormal ? 'normal' : 'abnormal'}">
                  <div class="variant-header">
                    <div>
                      <span class="variant-title">${vr.variant.product_title}</span>
                      <span class="variant-sku">SKU: ${vr.variant.sku}</span>
                    </div>
                    <span class="variant-status ${vr.isNormal ? 'success' : 'error'}">
                      ${vr.message}
                    </span>
                  </div>
                  <div class="metafield-info">
                    Variant ID: ${vr.variant.variant_id} |
                    Title: ${vr.variant.title || 'N/A'} |
                    Metafield: ${vr.metafieldCheck.hasGiftMetafield ? '存在' : '不存在'} fe_auto_gift_into_cart
                    ${vr.metafieldCheck.giftMetafield ? ` | Value包含规则ID: ${vr.metafieldCheck.valueContainsRuleId ? '是' : '否'}` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="footer">
      🤖 Generated with Function买赠规则检查工具
    </div>
  </div>
</body>
</html>`;

  return html;
}

// 主函数
async function main() {
  const shopDomain = process.argv[2] || 'beta-anker-us.myshopify.com';

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     🎁 买赠规则全量检查                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // 1. 获取规则列表
    const rules = await getRulesList(shopDomain);

    if (rules.length === 0) {
      console.log('\n⚠️  未找到符合条件的规则');
      return;
    }

    // 2. 并发检查所有规则 (限制并发数为5)
    const results = [];
    const ruleConcurrencyLimit = 5;

    for (let i = 0; i < rules.length; i += ruleConcurrencyLimit) {
      const batch = rules.slice(i, i + ruleConcurrencyLimit);
      const batchStart = i + 1;
      const batchEnd = Math.min(i + ruleConcurrencyLimit, rules.length);

      console.log(`\n进度: ${batchStart}-${batchEnd}/${rules.length} (并发检查中...)`);

      const batchResults = await Promise.all(
        batch.map(async (rule, index) => {
          const ruleNum = i + index + 1;
          console.log(`\n[${ruleNum}/${rules.length}] 检查规则 ${rule.rule_id}: ${rule.rule_name}`);
          return await checkRule(rule, shopDomain);
        })
      );

      results.push(...batchResults);

      // 批次之间稍微延迟,避免请求过快
      if (i + ruleConcurrencyLimit < rules.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 3. 生成报告
    console.log('\n\n📊 生成检查报告...');
    const timestamp = Date.now();
    const html = generateHtmlReport(shopDomain, results, timestamp);

    const outputPath = path.join(__dirname, 'output', `batch-check-${timestamp}.html`);
    await fs.writeFile(outputPath, html);

    console.log(`\n✅ 检查完成！`);
    console.log(`📄 报告已保存: ${outputPath}`);

    // 统计
    const totalVariants = results.reduce((sum, r) =>
      sum + (r.variantResults?.length || 0), 0
    );
    const normalVariants = results.reduce((sum, r) =>
      sum + (r.variantResults?.filter(v => v.isNormal).length || 0), 0
    );
    const abnormalVariants = totalVariants - normalVariants;

    console.log(`\n📈 统计:`);
    console.log(`   检查规则: ${results.length} 条`);
    console.log(`   总 Variant: ${totalVariants} 个`);
    console.log(`   状态正常: ${normalVariants} 个 ✅`);
    console.log(`   状态异常: ${abnormalVariants} 个 ❌`);

  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.error(error.stack);
  }
}

// 运行
main();
