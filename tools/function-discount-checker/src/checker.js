import { getFunctionDiscountRuleDetail, getMetafieldList } from './mcpClient.js';

/**
 * 检查单个variant的买赠折扣状态
 * @param {string} shopDomain - 店铺域名
 * @param {number} ruleId - 规则ID
 * @param {number} variantId - 变体ID
 * @returns {Promise<object>} 检查结果
 */
async function checkVariantDiscountStatus(shopDomain, ruleId, variantId) {
  try {
    // 查询metafield列表
    const metafieldResult = await getMetafieldList(shopDomain, variantId, 'variant');

    if (metafieldResult.code !== 0 || !metafieldResult.data || !metafieldResult.data.list) {
      return {
        variantId,
        status: 'error',
        message: '查询Metafield失败',
        error: metafieldResult.msg || '未知错误'
      };
    }

    const metafields = metafieldResult.data.list;

    // 检查是否存在key='fe_auto_gift_into_cart'的记录
    const hasAutoGiftKey = metafields.some(mf => mf.key === 'fe_auto_gift_into_cart');

    // 检查是否存在value中包含当前rule_id的记录
    const hasMatchingRuleId = metafields.some(mf => {
      try {
        const value = typeof mf.value === 'string' ? JSON.parse(mf.value) : mf.value;
        // value可能是对象或数组，需要递归查找rule_id
        const valueStr = JSON.stringify(value);
        return valueStr.includes(`"rule_id":${ruleId}`) || valueStr.includes(`"rule_id":"${ruleId}"`);
      } catch (e) {
        return false;
      }
    });

    const isActive = hasAutoGiftKey && hasMatchingRuleId;

    return {
      variantId,
      status: isActive ? 'active' : 'inactive',
      message: isActive ? '买赠折扣已生效' : '买赠折扣未生效',
      details: {
        hasAutoGiftKey,
        hasMatchingRuleId,
        metafieldCount: metafields.length
      },
      metafields: metafields.map(mf => ({
        key: mf.key,
        namespace: mf.namespace,
        value: mf.value
      }))
    };
  } catch (error) {
    return {
      variantId,
      status: 'error',
      message: '检查过程出错',
      error: error.message
    };
  }
}

/**
 * 检查买赠折扣规则的生效状态
 * @param {number} ruleId - 规则ID
 * @param {string} shopDomain - 店铺域名
 * @returns {Promise<object>} 完整的检查结果
 */
export async function checkDiscountStatus(ruleId, shopDomain) {
  console.log(`\n开始检查买赠折扣规则: rule_id=${ruleId}, shop_domain=${shopDomain}\n`);

  const result = {
    ruleId,
    shopDomain,
    timestamp: new Date().toISOString(),
    ruleInfo: null,
    variantResults: [],
    summary: {
      totalVariants: 0,
      activeVariants: 0,
      inactiveVariants: 0,
      errorVariants: 0
    }
  };

  try {
    // 1. 获取规则详情
    const ruleDetail = await getFunctionDiscountRuleDetail(ruleId, shopDomain);

    if (ruleDetail.code !== 0) {
      result.error = ruleDetail.msg || '获取规则详情失败';
      return result;
    }

    if (!ruleDetail.data) {
      result.error = '规则数据为空';
      return result;
    }

    result.ruleInfo = ruleDetail.data;

    // 2. 提取main_product_list中的variant_id
    const mainProductList = ruleDetail.data.rule_detail?.main_product_list || [];

    if (mainProductList.length === 0) {
      result.error = '规则中没有找到main_product_list';
      return result;
    }

    // 从每个产品的variants数组中提取variant_id
    const variantIds = [];
    for (const product of mainProductList) {
      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (variant.variant_id) {
            variantIds.push(variant.variant_id);
          }
        }
      }
    }

    result.summary.totalVariants = variantIds.length;

    if (variantIds.length === 0) {
      result.error = 'main_product_list中没有找到variant_id';
      return result;
    }

    console.log(`找到 ${variantIds.length} 个variant，开始逐个检查...\n`);

    // 3. 逐个检查每个variant的metafield状态
    for (const variantId of variantIds) {
      console.log(`检查variant ${variantId}...`);
      const variantResult = await checkVariantDiscountStatus(shopDomain, ruleId, variantId);
      result.variantResults.push(variantResult);

      // 更新统计
      if (variantResult.status === 'active') {
        result.summary.activeVariants++;
      } else if (variantResult.status === 'inactive') {
        result.summary.inactiveVariants++;
      } else if (variantResult.status === 'error') {
        result.summary.errorVariants++;
      }

      console.log(`  结果: ${variantResult.message}\n`);
    }

    // 4. 判断整体状态
    result.overallStatus = result.summary.activeVariants > 0 ? 'active' : 'inactive';

  } catch (error) {
    result.error = error.message;
    console.error('检查过程发生错误:', error);
  }

  return result;
}
