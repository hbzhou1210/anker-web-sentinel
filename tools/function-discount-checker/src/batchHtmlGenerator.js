import fs from 'fs';
import path from 'path';
import { analyzePossibleReasons } from './batchChecker.js';

/**
 * 生成批量查询的HTML报告
 * @param {object} batchResult - 批量检查结果
 * @param {string} outputPath - 输出路径
 */
export function generateBatchHtmlReport(batchResult, outputPath = 'output/batch-report.html') {
  const { shopDomain, timestamp, ruleResults, summary } = batchResult;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>批量买赠折扣规则查询报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
            font-size: 14px;
        }

        .content {
            padding: 30px;
        }

        .info-section {
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
            padding-left: 20px;
        }

        .info-section h2 {
            color: #667eea;
            font-size: 20px;
            margin-bottom: 15px;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .info-item {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }

        .info-item label {
            display: block;
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .info-item .value {
            font-size: 16px;
            color: #111827;
            font-weight: 500;
        }

        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .summary-card {
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 2px solid #d1d5db;
        }

        .summary-card.active {
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
            border-color: #10b981;
        }

        .summary-card.inactive {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border-color: #ef4444;
        }

        .summary-card.error {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-color: #f59e0b;
        }

        .summary-card .number {
            font-size: 36px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 5px;
        }

        .summary-card .label {
            font-size: 14px;
            color: #6b7280;
        }

        .rule-card {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .rule-card.active {
            border-color: #10b981;
            background: linear-gradient(to right, #f0fdf4 0%, #ffffff 100%);
        }

        .rule-card.inactive {
            border-color: #ef4444;
            background: linear-gradient(to right, #fef2f2 0%, #ffffff 100%);
        }

        .rule-card.error {
            border-color: #f59e0b;
            background: linear-gradient(to right, #fffbeb 0%, #ffffff 100%);
        }

        .rule-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
        }

        .rule-title {
            font-size: 20px;
            font-weight: bold;
            color: #111827;
        }

        .rule-status-badge {
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }

        .rule-status-badge.active {
            background: #10b981;
            color: white;
        }

        .rule-status-badge.inactive {
            background: #ef4444;
            color: white;
        }

        .rule-status-badge.error {
            background: #f59e0b;
            color: white;
        }

        .rule-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-item {
            background: #f9fafb;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e5e7eb;
        }

        .stat-item .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #111827;
        }

        .stat-item .stat-label {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
        }

        .suggestions-box {
            background: #fffbeb;
            border: 2px solid #fbbf24;
            border-radius: 8px;
            padding: 20px;
            margin-top: 15px;
        }

        .suggestions-box h4 {
            color: #92400e;
            font-size: 16px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .suggestions-box ul {
            margin-left: 20px;
            color: #78350f;
        }

        .suggestions-box li {
            margin-bottom: 8px;
            line-height: 1.6;
        }

        .variant-summary {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }

        .variant-summary h4 {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 10px;
        }

        .variant-list-compact {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .variant-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .variant-badge.active {
            background: #d1fae5;
            color: #065f46;
        }

        .variant-badge.inactive {
            background: #fee2e2;
            color: #991b1b;
        }

        .toggle-details {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            margin-top: 15px;
            transition: background 0.3s;
        }

        .toggle-details:hover {
            background: #5568d3;
        }

        .variant-details {
            display: none;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }

        .variant-details.show {
            display: block;
        }

        .variant-item {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
        }

        .variant-item.active {
            border-color: #10b981;
            background: #f0fdf4;
        }

        .variant-item.inactive {
            border-color: #ef4444;
            background: #fef2f2;
        }

        .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
        }

        .error-message {
            background: #fef2f2;
            border: 2px solid #ef4444;
            border-radius: 8px;
            padding: 15px;
            color: #991b1b;
            margin-top: 15px;
        }

        .action-bar {
            background: white;
            padding: 15px 30px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .btn {
            padding: 10px 20px;
            border-radius: 6px;
            border: none;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            display: inline-block;
        }

        .btn-back {
            background: #6b7280;
            color: white;
        }

        .btn-back:hover {
            background: #4b5563;
        }

        .btn-download {
            background: #10b981;
            color: white;
        }

        .btn-download:hover {
            background: #059669;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="action-bar">
            <button class="btn btn-back" onclick="goBack()">← 返回查询页</button>
            <button class="btn btn-download" onclick="downloadReport()">⬇ 下载报告</button>
        </div>

        <div class="header">
            <h1>📦 批量买赠折扣规则查询报告</h1>
            <p>Batch Function Discount Rules Status Report</p>
        </div>

        <div class="content">
            <div class="info-section">
                <h2>📋 基本信息</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <label>店铺域名</label>
                        <div class="value">${shopDomain}</div>
                    </div>
                    <div class="info-item">
                        <label>查询时间</label>
                        <div class="value">${new Date(timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="info-item">
                        <label>查询规则数</label>
                        <div class="value">${summary.totalRules}</div>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h2>📊 整体统计</h2>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="number">${summary.totalRules}</div>
                        <div class="label">总规则数</div>
                    </div>
                    <div class="summary-card active">
                        <div class="number">${summary.activeRules}</div>
                        <div class="label">已生效</div>
                    </div>
                    <div class="summary-card inactive">
                        <div class="number">${summary.inactiveRules}</div>
                        <div class="label">未生效</div>
                    </div>
                    <div class="summary-card error">
                        <div class="number">${summary.errorRules}</div>
                        <div class="label">查询出错</div>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h2>🔍 规则详细状态</h2>
                ${ruleResults.map((result, index) => {
                  const status = result.error ? 'error' : (result.overallStatus === 'active' ? 'active' : 'inactive');
                  const statusText = result.error ? '查询出错' : (result.overallStatus === 'active' ? '已生效' : '未生效');
                  const statusIcon = result.error ? '⚠' : (result.overallStatus === 'active' ? '✓' : '✗');

                  // 分析可能的原因
                  const reasons = status !== 'active' ? analyzePossibleReasons(result) : [];

                  return `
                    <div class="rule-card ${status}">
                        <div class="rule-header">
                            <div class="rule-title">
                                Rule ID: ${result.ruleId}
                                ${result.ruleInfo?.rule_name ? `<br><span style="font-size: 14px; font-weight: normal; color: #6b7280;">${result.ruleInfo.rule_name}</span>` : ''}
                            </div>
                            <div class="rule-status-badge ${status}">
                                ${statusIcon} ${statusText}
                            </div>
                        </div>

                        ${result.error ? `
                            <div class="error-message">
                                <strong>错误信息:</strong> ${result.error}
                            </div>
                        ` : `
                            <div class="rule-stats">
                                <div class="stat-item">
                                    <div class="stat-value">${result.summary.totalVariants}</div>
                                    <div class="stat-label">总Variant数</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #10b981;">${result.summary.activeVariants}</div>
                                    <div class="stat-label">已生效</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #ef4444;">${result.summary.inactiveVariants}</div>
                                    <div class="stat-label">未生效</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #f59e0b;">${result.summary.errorVariants}</div>
                                    <div class="stat-label">查询出错</div>
                                </div>
                            </div>

                            ${result.variantResults && result.variantResults.length > 0 ? `
                                <div class="variant-summary">
                                    <h4>Variant 状态概览:</h4>
                                    <div class="variant-list-compact">
                                        ${result.variantResults.map(v => `
                                            <span class="variant-badge ${v.status}">
                                                ${v.variantId}: ${v.status === 'active' ? '✓' : v.status === 'error' ? '⚠' : '✗'}
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${reasons.length > 0 ? `
                                <div class="suggestions-box">
                                    <h4>💡 可能原因及建议</h4>
                                    <ul>
                                        ${reasons.map(reason => `<li>${reason}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}

                            ${result.variantResults && result.variantResults.length > 0 ? `
                                <button class="toggle-details" onclick="toggleDetails(${index})">
                                    查看 Variant 详情
                                </button>
                                <div id="details-${index}" class="variant-details">
                                    ${result.variantResults.map(v => `
                                        <div class="variant-item ${v.status}">
                                            <strong>Variant ID:</strong> ${v.variantId}<br>
                                            <strong>状态:</strong> ${v.message}<br>
                                            ${v.details ? `
                                                <strong>详情:</strong><br>
                                                • fe_auto_gift_into_cart: ${v.details.hasAutoGiftKey ? '✓ 存在' : '✗ 不存在'}<br>
                                                • rule_id 匹配: ${v.details.hasMatchingRuleId ? '✓ 匹配' : '✗ 不匹配'}<br>
                                                • Metafield 数量: ${v.details.metafieldCount}
                                            ` : ''}
                                            ${v.error ? `<br><strong>错误:</strong> ${v.error}` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        `}
                    </div>
                  `;
                }).join('')}
            </div>
        </div>

        <div class="footer">
            <p>Function买赠折扣规则批量查询智能体 | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>

    <script>
        function toggleDetails(index) {
            const element = document.getElementById('details-' + index);
            element.classList.toggle('show');
        }

        function goBack() {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/';
            }
        }

        function downloadReport() {
            const htmlContent = document.documentElement.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'batch-discount-report-${new Date().getTime()}.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;

  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`\n✓ 批量查询HTML报告已生成: ${path.resolve(outputPath)}`);

  return path.resolve(outputPath);
}
