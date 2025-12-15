import fs from 'fs';
import path from 'path';

/**
 * 生成HTML报告
 * @param {object} checkResult - 检查结果
 * @param {string} outputPath - 输出路径（默认为output/report.html）
 */
export function generateHtmlReport(checkResult, outputPath = 'output/report.html') {
  const {
    ruleId,
    shopDomain,
    timestamp,
    ruleInfo,
    variantResults,
    summary,
    overallStatus,
    error
  } = checkResult;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>买赠折扣规则查询报告 - Rule ${ruleId}</title>
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
            max-width: 1200px;
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

        .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
            margin-top: 15px;
        }

        .status-active {
            background: #10b981;
            color: white;
        }

        .status-inactive {
            background: #ef4444;
            color: white;
        }

        .status-error {
            background: #f59e0b;
            color: white;
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

        .variant-list {
            margin-top: 20px;
        }

        .variant-card {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            transition: all 0.3s ease;
        }

        .variant-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }

        .variant-card.active {
            border-color: #10b981;
            background: #f0fdf4;
        }

        .variant-card.inactive {
            border-color: #ef4444;
            background: #fef2f2;
        }

        .variant-card.error {
            border-color: #f59e0b;
            background: #fffbeb;
        }

        .variant-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .variant-id {
            font-size: 18px;
            font-weight: bold;
            color: #111827;
        }

        .variant-status {
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }

        .variant-details {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
        }

        .metafield-table {
            width: 100%;
            margin-top: 10px;
            border-collapse: collapse;
            font-size: 13px;
        }

        .metafield-table th {
            background: #f9fafb;
            padding: 10px;
            text-align: left;
            border: 1px solid #e5e7eb;
            font-weight: 600;
            color: #374151;
        }

        .metafield-table td {
            padding: 10px;
            border: 1px solid #e5e7eb;
            word-break: break-all;
        }

        .metafield-table tr:hover {
            background: #f9fafb;
        }

        .error-message {
            background: #fef2f2;
            border: 2px solid #ef4444;
            border-radius: 8px;
            padding: 20px;
            color: #991b1b;
            text-align: center;
        }

        .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
        }

        .toggle-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 5px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
        }

        .toggle-btn:hover {
            background: #5568d3;
        }

        .metafield-details {
            display: none;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }

        .metafield-details.show {
            display: block;
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
            <h1>🎁 买赠折扣规则查询报告</h1>
            <p>Function Discount Rule Status Report</p>
            ${error ? `<span class="status-badge status-error">查询失败</span>` :
              overallStatus === 'active' ?
              `<span class="status-badge status-active">✓ 折扣已生效</span>` :
              `<span class="status-badge status-inactive">✗ 折扣未生效</span>`
            }
        </div>

        <div class="content">
            ${error ? `
                <div class="error-message">
                    <h3>查询出错</h3>
                    <p>${error}</p>
                </div>
            ` : ''}

            <div class="info-section">
                <h2>📋 基本信息</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <label>规则 ID</label>
                        <div class="value">${ruleId}</div>
                    </div>
                    <div class="info-item">
                        <label>店铺域名</label>
                        <div class="value">${shopDomain}</div>
                    </div>
                    <div class="info-item">
                        <label>查询时间</label>
                        <div class="value">${new Date(timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                    ${ruleInfo && ruleInfo.rule_name ? `
                    <div class="info-item">
                        <label>规则名称</label>
                        <div class="value">${ruleInfo.rule_name}</div>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${!error && summary ? `
            <div class="info-section">
                <h2>📊 统计摘要</h2>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="number">${summary.totalVariants}</div>
                        <div class="label">总Variant数</div>
                    </div>
                    <div class="summary-card active">
                        <div class="number">${summary.activeVariants}</div>
                        <div class="label">已生效</div>
                    </div>
                    <div class="summary-card inactive">
                        <div class="number">${summary.inactiveVariants}</div>
                        <div class="label">未生效</div>
                    </div>
                    <div class="summary-card error">
                        <div class="number">${summary.errorVariants}</div>
                        <div class="label">查询出错</div>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h2>🔍 Variant详细状态</h2>
                <div class="variant-list">
                    ${variantResults.map((variant, index) => `
                        <div class="variant-card ${variant.status}">
                            <div class="variant-header">
                                <span class="variant-id">Variant ID: ${variant.variantId}</span>
                                <span class="variant-status status-${variant.status}">
                                    ${variant.status === 'active' ? '✓ 已生效' :
                                      variant.status === 'inactive' ? '✗ 未生效' :
                                      '⚠ 出错'}
                                </span>
                            </div>
                            <div class="variant-details">
                                <strong>状态说明:</strong> ${variant.message}
                                ${variant.error ? `<br><strong>错误信息:</strong> ${variant.error}` : ''}
                                ${variant.details ? `
                                    <br><strong>检查详情:</strong>
                                    <br>• 包含 fe_auto_gift_into_cart 键: ${variant.details.hasAutoGiftKey ? '是' : '否'}
                                    <br>• 包含匹配的 rule_id: ${variant.details.hasMatchingRuleId ? '是' : '否'}
                                    <br>• Metafield 记录数: ${variant.details.metafieldCount}
                                ` : ''}

                                ${variant.metafields && variant.metafields.length > 0 ? `
                                    <button class="toggle-btn" onclick="toggleMetafields(${index})">
                                        查看 Metafield 详情
                                    </button>
                                    <div id="metafields-${index}" class="metafield-details">
                                        <table class="metafield-table">
                                            <thead>
                                                <tr>
                                                    <th>Namespace</th>
                                                    <th>Key</th>
                                                    <th>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${variant.metafields.map(mf => `
                                                    <tr>
                                                        <td>${mf.namespace || '-'}</td>
                                                        <td>${mf.key || '-'}</td>
                                                        <td><pre style="margin:0; white-space: pre-wrap;">${typeof mf.value === 'string' ? mf.value : JSON.stringify(mf.value, null, 2)}</pre></td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Function买赠折扣规则查询智能体 | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>

    <script>
        function toggleMetafields(index) {
            const element = document.getElementById('metafields-' + index);
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
            a.download = 'discount-rule-report-${ruleId}-${new Date().getTime()}.html';
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
  console.log(`\n✓ HTML报告已生成: ${path.resolve(outputPath)}`);

  return path.resolve(outputPath);
}
