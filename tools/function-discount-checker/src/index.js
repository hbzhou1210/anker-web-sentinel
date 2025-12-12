#!/usr/bin/env node

import { checkDiscountStatus } from './checker.js';
import { generateHtmlReport } from './htmlGenerator.js';
import { batchCheckDiscountStatus } from './batchChecker.js';
import { generateBatchHtmlReport } from './batchHtmlGenerator.js';

/**
 * 主程序入口
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     🎁 Function买赠折扣规则查询智能体                    ║');
  console.log('║     Discount Rule Status Checker Agent                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // 从命令行参数获取 rule_id(s) 和 shop_domain
  const args = process.argv.slice(2);

  if (args.length < 2) {
    // 默认测试参数
    console.log('⚠️  未提供参数，使用默认测试参数\n');
    console.log('使用方法:');
    console.log('  单个规则: npm start <rule_id> <shop_domain>');
    console.log('  多个规则: npm start <rule_id1,rule_id2,rule_id3> <shop_domain>');
    console.log('\n示例:');
    console.log('  npm start 818 beta-anker-us.myshopify.com');
    console.log('  npm start 818,910,906 beta-anker-us.myshopify.com\n');
    process.exit(1);
  }

  const ruleIdsStr = args[0];
  const shopDomain = args[1];

  // 验证 shop_domain
  if (!shopDomain || !shopDomain.includes('.myshopify.com')) {
    console.error('❌ 错误: shop_domain 必须是有效的 Shopify 域名（如: xxx.myshopify.com）');
    process.exit(1);
  }

  // 解析 rule_id，支持逗号分隔的多个ID
  const ruleIds = ruleIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

  if (ruleIds.length === 0) {
    console.error('❌ 错误: rule_id 必须是有效的数字或逗号分隔的数字列表');
    process.exit(1);
  }

  try {
    if (ruleIds.length === 1) {
      // 单个规则查询
      const ruleId = ruleIds[0];
      console.log('📝 查询参数:');
      console.log(`   Rule ID: ${ruleId}`);
      console.log(`   Shop Domain: ${shopDomain}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const result = await checkDiscountStatus(ruleId, shopDomain);
      const reportPath = generateHtmlReport(result);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('📊 查询结果摘要:');
      console.log(`   整体状态: ${result.overallStatus === 'active' ? '✅ 已生效' : '❌ 未生效'}`);

      if (result.summary) {
        console.log(`   总Variant数: ${result.summary.totalVariants}`);
        console.log(`   已生效: ${result.summary.activeVariants}`);
        console.log(`   未生效: ${result.summary.inactiveVariants}`);
        console.log(`   查询出错: ${result.summary.errorVariants}`);
      }

      if (result.error) {
        console.log(`   错误信息: ${result.error}`);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('✓ 完成！请在浏览器中打开报告查看详细信息。');
      console.log(`\n🌐 报告路径: file://${reportPath}\n`);

    } else {
      // 批量查询
      console.log('📝 批量查询参数:');
      console.log(`   Rule IDs: ${ruleIds.join(', ')}`);
      console.log(`   Shop Domain: ${shopDomain}`);
      console.log(`   总规则数: ${ruleIds.length}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const batchResult = await batchCheckDiscountStatus(ruleIds, shopDomain);
      const reportPath = generateBatchHtmlReport(batchResult);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('✓ 批量查询完成！请在浏览器中打开报告查看详细信息。');
      console.log(`\n🌐 报告路径: file://${reportPath}\n`);
    }

  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主程序
main();
