# 🎁 Function买赠折扣规则查询智能体

一个用于查询 Shopify Function 买赠折扣规则在 Metafield 中生效状态的智能体工具。

## 功能说明

该智能体能够：

1. 通过 `rule_id` 和 `shop_domain` 查询折扣规则详情
2. 从规则的 `main_product_list` 中提取所有 `variant_id`
3. 对每个 variant 查询其 Metafield 数据
4. 检查是否满足生效条件：
   - 存在 `key='fe_auto_gift_into_cart'` 的 Metafield 记录
   - 存在包含对应 `rule_id` 的 Metafield 记录
5. 生成美观的 HTML 报告展示查询结果

## 安装依赖

```bash
npm install
```

## 使用方法

### 方式一：Web界面（推荐）

启动Web服务器：
```bash
npm run server
```

然后在浏览器中打开 `http://localhost:3000` 即可使用Web界面查询。

**Web界面特点：**
- 友好的图形化界面
- 支持多个 rule_id 输入（用逗号分隔）
- 品牌选择（Anker、Eufy、Ankersolix、soundcore）
- 根据品牌自动显示对应的店铺列表
- 实时查询进度提示
- 查询结果统计和报告下载

### 方式二：命令行

#### 单个规则查询

```bash
npm start <rule_id> <shop_domain>
```

示例：
```bash
npm start 818 beta-anker-us.myshopify.com
```

#### 批量规则查询

使用逗号分隔多个 rule_id：
```bash
npm start <rule_id1,rule_id2,rule_id3> <shop_domain>
```

示例：
```bash
npm start 818,910,906,814 beta-anker-us.myshopify.com
```

**批量查询特点：**
- 将所有规则的查询结果整合到一个 HTML 报告中
- 自动分析未生效规则的可能原因并给出建议
- 提供整体统计和每个规则的详细状态
- **🚀 并行查询**: 多个规则同时查询，速度提升显著（规则越多提升越大）

## 项目结构

```
function买赠规则查询/
├── src/
│   ├── index.js                # 命令行程序入口
│   ├── server.js               # Web服务器
│   ├── mcpClient.js            # MCP工具调用客户端
│   ├── checker.js              # 单个规则检查逻辑
│   ├── batchChecker.js         # 批量规则检查逻辑
│   ├── htmlGenerator.js        # 单个规则HTML报告生成器
│   └── batchHtmlGenerator.js   # 批量规则HTML报告生成器
├── public/
│   └── index.html              # Web界面
├── output/
│   ├── report.html             # 单个规则查询报告
│   └── batch-report.html       # 批量规则查询报告
├── package.json
├── README.md
└── USAGE.md
```

## 核心逻辑

### 1. 获取规则详情
通过 MCP 工具 `get_function_discount_rule_detail` 获取折扣规则信息，提取 `main_product_list` 中的 `variant_id` 列表。

### 2. 检查 Metafield 状态
对每个 `variant_id`，调用 `dimp_metafield_list` 工具查询其 Metafield 数据：
- `owner_id`: 对应的 `variant_id`
- `owner_resource`: 固定为 `'variant'`

### 3. 判断生效状态
同时满足以下条件时，判定为已生效：
- 存在 `key='fe_auto_gift_into_cart'` 的记录
- 存在 value 中包含当前 `rule_id` 的记录

### 4. 生成报告
将查询结果以可视化的 HTML 格式输出，包含：
- 基本信息（Rule ID、Shop Domain、查询时间等）
- 统计摘要（总数、已生效、未生效、出错）
- 每个 Variant 的详细状态
- Metafield 详细数据

## 查询结果说明

### 整体状态
- **✅ 已生效**: 至少有一个 variant 满足生效条件
- **❌ 未生效**: 所有 variant 都未满足生效条件

### Variant 状态
- **active**: 该 variant 的折扣已生效
- **inactive**: 该 variant 的折扣未生效
- **error**: 查询该 variant 时出错

## HTML 报告特点

### 单个规则报告
- 🎨 现代化渐变配色设计
- 📊 清晰的统计卡片展示
- 🔍 可展开的 Metafield 详情
- 📱 响应式布局，支持各种屏幕
- 🎯 状态标识清晰（绿色=生效，红色=未生效，橙色=出错）

### 批量规则报告
- 📦 整合所有规则的查询结果
- 📊 整体统计概览（总数、已生效、未生效、出错）
- 💡 **智能原因分析**：自动分析未生效规则的可能原因
- 📋 每个规则的详细卡片展示
- 🔍 可展开查看每个 Variant 的详细状态
- 🎨 不同状态使用不同配色主题

## 未生效原因智能分析

批量查询报告会自动分析未生效规则的可能原因，包括：

1. **规则配置问题**
   - 规则中没有配置主商品（main_product_list）
   - 规则查询失败（rule_id 或 shop_domain 错误）

2. **Metafield 同步问题**
   - 所有 variant 都没有 metafield 数据（可能未同步）
   - 缺少 `fe_auto_gift_into_cart` 键（前端未调用同步接口）
   - 没有包含对应 rule_id 的记录（规则已变更但未更新）

3. **部分生效问题**
   - 部分 variant 已生效，部分未生效（同步过程异常）

4. **其他建议**
   - 检查规则是否已启用且在有效期内
   - 检查前端是否正确调用了 metafield 同步接口
   - 检查 Shopify API 权限配置

## MCP 工具依赖

本智能体需要以下 MCP 工具：

1. **get_function_discount_rule_detail**
   - 功能：查询 function 折扣规则详情
   - 参数：`rule_id`, `shop_domain`

2. **dimp_metafield_list**
   - 功能：获取 Shopify Metafields 列表
   - 参数：`shopify_domain`, `owner_id`, `owner_resource`

## 示例输出

```
╔═══════════════════════════════════════════════════════════╗
║     🎁 Function买赠折扣规则查询智能体                    ║
║     Discount Rule Status Checker Agent                   ║
╚═══════════════════════════════════════════════════════════╝

📝 查询参数:
   Rule ID: 818
   Shop Domain: beta-murphy-test.myshopify.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

开始检查买赠折扣规则: rule_id=818, shop_domain=beta-murphy-test.myshopify.com

正在查询规则详情: rule_id=818, shop_domain=beta-murphy-test.myshopify.com
找到 3 个variant，开始逐个检查...

检查variant 12345...
  结果: 买赠折扣已生效

检查variant 12346...
  结果: 买赠折扣未生效

✓ HTML报告已生成: /Users/admin/Desktop/function买赠规则查询/output/report.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 查询结果摘要:
   整体状态: ✅ 已生效
   总Variant数: 3
   已生效: 1
   未生效: 2
   查询出错: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ 完成！请在浏览器中打开报告查看详细信息。

🌐 报告路径: file:///Users/admin/Desktop/function买赠规则查询/output/report.html
```

## 性能优化

### 并行查询
批量查询采用**并行模式**，所有规则同时查询，显著提升速度：

- 2个规则: 速度提升约 **2倍**
- 4个规则: 速度提升约 **4倍**
- 8个规则: 速度提升约 **6-7倍**
- 10个规则: 速度提升约 **8倍+**

详细说明请查看 [PERFORMANCE.md](PERFORMANCE.md)

## 注意事项

1. 确保 MCP 服务器配置正确且可访问
2. 提供的 `shop_domain` 必须是有效的 Shopify 域名格式
3. 批量查询建议每批不超过10-20个规则
4. 生成的 HTML 报告保存在 `output/` 目录

## License

MIT
