import { checkDiscountStatus } from './checker.js';

/**
 * 批量检查多个规则的折扣状态（并行查询）
 * @param {number[]} ruleIds - 规则ID数组
 * @param {string} shopDomain - 店铺域名
 * @returns {Promise<object>} 批量检查结果
 */
export async function batchCheckDiscountStatus(ruleIds, shopDomain) {
  console.log(`\n开始批量检查 ${ruleIds.length} 个买赠折扣规则...(并行查询)\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const batchResult = {
    shopDomain,
    timestamp: new Date().toISOString(),
    ruleResults: [],
    summary: {
      totalRules: ruleIds.length,
      activeRules: 0,
      inactiveRules: 0,
      errorRules: 0
    }
  };

  // 并行查询所有规则
  const promises = ruleIds.map(async (ruleId) => {
    console.log(`📋 正在检查 Rule ID: ${ruleId}...`);

    try {
      const result = await checkDiscountStatus(ruleId, shopDomain);

      // 输出简要结果
      if (result.error) {
        console.log(`  ❌ Rule ${ruleId}: 查询出错 - ${result.error}`);
      } else {
        console.log(`  ${result.overallStatus === 'active' ? '✅' : '❌'} Rule ${ruleId}: ${result.overallStatus === 'active' ? '已生效' : '未生效'} (${result.summary.activeVariants}/${result.summary.totalVariants} variants)`);
      }

      return result;
    } catch (error) {
      console.error(`  ❌ Rule ${ruleId}: 检查失败 - ${error.message}`);
      return {
        ruleId,
        shopDomain,
        timestamp: new Date().toISOString(),
        error: error.message,
        summary: {
          totalVariants: 0,
          activeVariants: 0,
          inactiveVariants: 0,
          errorVariants: 0
        }
      };
    }
  });

  // 等待所有查询完成
  const results = await Promise.all(promises);

  // 按照原始顺序添加结果并统计
  results.forEach(result => {
    batchResult.ruleResults.push(result);

    // 更新统计
    if (result.error) {
      batchResult.summary.errorRules++;
    } else if (result.overallStatus === 'active') {
      batchResult.summary.activeRules++;
    } else {
      batchResult.summary.inactiveRules++;
    }
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`✓ 批量检查完成！`);
  console.log(`  总规则数: ${batchResult.summary.totalRules}`);
  console.log(`  已生效: ${batchResult.summary.activeRules}`);
  console.log(`  未生效: ${batchResult.summary.inactiveRules}`);
  console.log(`  查询出错: ${batchResult.summary.errorRules}\n`);

  return batchResult;
}

/**
 * 分析未生效的原因并给出建议
 * @param {object} ruleResult - 单个规则的检查结果
 * @returns {string[]} 可能的原因列表
 */
export function analyzePossibleReasons(ruleResult) {
  const reasons = [];

  if (ruleResult.error) {
    reasons.push('规则数据查询失败，请检查 rule_id 和 shop_domain 是否正确');
    return reasons;
  }

  if (!ruleResult.variantResults || ruleResult.variantResults.length === 0) {
    reasons.push('规则中没有配置主商品（main_product_list）');
    return reasons;
  }

  // 分析每个 variant 的情况
  const allInactive = ruleResult.variantResults.every(v => v.status === 'inactive');
  const hasErrors = ruleResult.variantResults.some(v => v.status === 'error');

  if (allInactive) {
    // 检查是否有 metafield 但没有匹配的 key
    const hasMetafields = ruleResult.variantResults.some(v =>
      v.metafields && v.metafields.length > 0
    );

    const missingAutoGiftKey = ruleResult.variantResults.some(v =>
      v.details && !v.details.hasAutoGiftKey
    );

    const missingRuleId = ruleResult.variantResults.some(v =>
      v.details && !v.details.hasMatchingRuleId
    );

    if (!hasMetafields) {
      reasons.push('所有 variant 都没有 metafield 数据，可能是折扣规则尚未同步到 metafield');
    } else if (missingAutoGiftKey) {
      reasons.push('Metafield 中缺少 key="fe_auto_gift_into_cart" 的记录');
      reasons.push('可能原因：前端未调用同步接口，或同步失败');
    } else if (missingRuleId) {
      reasons.push(`Metafield 中没有包含 rule_id=${ruleResult.ruleId} 的记录`);
      reasons.push('可能原因：规则配置已变更，或 metafield 数据未更新');
    }
  }

  if (hasErrors) {
    reasons.push('部分 variant 查询 metafield 时出错，请检查网络连接或 API 权限');
  }

  // 部分生效的情况
  const partiallyActive = ruleResult.summary.activeVariants > 0 &&
                          ruleResult.summary.inactiveVariants > 0;

  if (partiallyActive) {
    reasons.push('部分 variant 已生效，部分未生效');
    reasons.push('可能原因：metafield 同步过程中出现异常，或某些 variant 未被正确处理');
  }

  if (reasons.length === 0) {
    reasons.push('未找到明确的失败原因，建议检查以下方面：');
    reasons.push('1. 规则是否已启用且在有效期内');
    reasons.push('2. 前端是否正确调用了 metafield 同步接口');
    reasons.push('3. Shopify API 权限是否正确配置');
  }

  return reasons;
}
