import React, { useState } from 'react';
import './RedirectTester.css';
import redirectTesterService, {
  RedirectRule,
  RedirectTestResult,
  TestReport
} from '../services/redirect-tester.service';

const RedirectTester: React.FC = () => {
  const [rules, setRules] = useState<RedirectRule[]>([]);
  const [fromUrl, setFromUrl] = useState('');
  const [toUrl, setToUrl] = useState('');
  const [matchType, setMatchType] = useState<'exact' | 'partial' | 'prefix' | 'regex'>('exact');
  const [startChar, setStartChar] = useState('');
  const [endChar, setEndChar] = useState('');
  const [regexPattern, setRegexPattern] = useState('');
  const [testing, setTesting] = useState(false);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [progress, setProgress] = useState(0);

  // 添加规则
  const handleAddRule = () => {
    if (!fromUrl || !toUrl) {
      alert('请填写源URL和目标URL');
      return;
    }

    const rule: RedirectRule = {
      from: fromUrl,
      to: toUrl,
      matchType
    };

    if (matchType === 'partial' && (startChar || endChar)) {
      rule.partialMatch = { startChar, endChar };
    } else if (matchType === 'regex' && regexPattern) {
      rule.partialMatch = { pattern: regexPattern };
    }

    setRules([...rules, rule]);
    clearForm();
  };

  // 清空表单
  const clearForm = () => {
    setFromUrl('');
    setToUrl('');
    setStartChar('');
    setEndChar('');
    setRegexPattern('');
  };

  // 删除规则
  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  // 清空所有规则
  const handleClearRules = () => {
    if (rules.length === 0) return;
    if (window.confirm('确定要清空所有规则吗？')) {
      setRules([]);
    }
  };

  // 运行测试
  const handleRunTests = async () => {
    if (rules.length === 0) {
      alert('请先添加测试规则');
      return;
    }

    setTesting(true);
    setProgress(0);
    setTestReport(null);

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const report = await redirectTesterService.testBatch(rules, 5);

      clearInterval(progressInterval);
      setProgress(100);
      setTestReport(report);
    } catch (error: any) {
      alert(`测试失败: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  // 导入JSON规则
  const handleImportRules = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const importedRules = JSON.parse(event.target.result);
          setRules(importedRules);
          alert(`导入成功！共导入 ${importedRules.length} 条规则`);
        } catch (error) {
          alert('导入失败，请检查JSON格式');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 导入CSV规则
  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const csvContent = event.target.result as string;
          const lines = csvContent.split('\n').filter(line => line.trim());

          // 检测分隔符（逗号或制表符）
          const firstLine = lines[0];
          const separator = firstLine.includes('\t') ? '\t' : ',';

          // 解析CSV
          const importedRules: RedirectRule[] = [];
          let startIndex = 0;

          // 跳过标题行（如果存在）
          if (lines[0].toLowerCase().includes('url') || lines[0].toLowerCase().includes('from')) {
            startIndex = 1;
          }

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(separator).map(p => p.trim().replace(/^["']|["']$/g, ''));

            if (parts.length >= 2) {
              const from = parts[0];
              const to = parts[1];

              // 验证URL格式
              if (!from || !to) continue;

              // 默认使用完全匹配，用户可以后续修改
              const rule: RedirectRule = {
                from,
                to,
                matchType: 'exact'
              };

              importedRules.push(rule);
            }
          }

          if (importedRules.length === 0) {
            alert('未能解析到有效的重定向规则\n\n请确保CSV格式为：\n源URL,目标URL\n或使用制表符分隔');
            return;
          }

          // 询问是否替换或追加
          const action = window.confirm(
            `成功解析 ${importedRules.length} 条规则\n\n` +
            `点击"确定"追加到现有规则\n` +
            `点击"取消"替换所有规则`
          );

          if (action) {
            // 追加
            setRules([...rules, ...importedRules]);
            alert(`成功追加 ${importedRules.length} 条规则！`);
          } else {
            // 替换
            setRules(importedRules);
            alert(`成功导入 ${importedRules.length} 条规则！`);
          }

        } catch (error: any) {
          alert(`导入失败: ${error.message}\n\n请检查CSV格式是否正确`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 导出JSON规则
  const handleExportRules = () => {
    if (rules.length === 0) {
      alert('没有规则可以导出');
      return;
    }

    const dataStr = JSON.stringify(rules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redirect-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导出CSV规则
  const handleExportCSV = () => {
    if (rules.length === 0) {
      alert('没有规则可以导出');
      return;
    }

    // 生成CSV内容
    const headers = ['源URL', '目标URL', '匹配类型'];
    const rows = rules.map(rule => [
      rule.from,
      rule.to,
      getMatchTypeLabel(rule.matchType)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redirect-rules.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 加载示例
  const handleLoadExample = (type: string) => {
    if (type === 'https') {
      setFromUrl('http://example.com');
      setToUrl('https://example.com');
      setMatchType('exact');
    } else if (type === 'path') {
      setFromUrl('http://example.com/old-page');
      setToUrl('https://example.com/new-page');
      setMatchType('exact');
    } else if (type === 'query') {
      setFromUrl('http://example.com/page?id=123');
      setToUrl('https://example.com/page?id=123');
      setMatchType('partial');
      setStartChar('/');
      setEndChar('?');
    }
  };

  // 获取匹配类型标签
  const getMatchTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      exact: '完全匹配',
      partial: '部分匹配',
      prefix: '前缀匹配',
      regex: '正则匹配'
    };
    return labels[type] || type;
  };

  return (
    <div className="redirect-tester">
      <div className="redirect-header">
        <h1>🔄 重定向测试工具</h1>
        <p>批量测试URL重定向，支持多种匹配模式</p>
      </div>

      <div className="redirect-content">
        {/* 左侧：添加规则 */}
        <div className="panel add-rule-panel">
          <h2>📝 添加重定向规则</h2>

          <div className="form-group">
            <label>源URL (From)</label>
            <input
              type="text"
              value={fromUrl}
              onChange={(e) => setFromUrl(e.target.value)}
              placeholder="http://example.com/old-page"
            />
          </div>

          <div className="form-group">
            <label>目标URL (To)</label>
            <input
              type="text"
              value={toUrl}
              onChange={(e) => setToUrl(e.target.value)}
              placeholder="https://example.com/new-page"
            />
          </div>

          <div className="form-group">
            <label>匹配类型</label>
            <select value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
              <option value="exact">完全匹配 (Exact)</option>
              <option value="partial">部分匹配 (Partial)</option>
              <option value="prefix">前缀匹配 (Prefix)</option>
              <option value="regex">正则匹配 (Regex)</option>
            </select>
          </div>

          {matchType === 'partial' && (
            <div className="match-config">
              <div className="form-group">
                <label>起始字符 (留空表示从头开始)</label>
                <input
                  type="text"
                  value={startChar}
                  onChange={(e) => setStartChar(e.target.value)}
                  placeholder="例如: /products/"
                />
              </div>
              <div className="form-group">
                <label>结束字符 (留空表示到末尾)</label>
                <input
                  type="text"
                  value={endChar}
                  onChange={(e) => setEndChar(e.target.value)}
                  placeholder="例如: ?"
                />
              </div>
            </div>
          )}

          {matchType === 'regex' && (
            <div className="match-config">
              <div className="form-group">
                <label>正则表达式</label>
                <input
                  type="text"
                  value={regexPattern}
                  onChange={(e) => setRegexPattern(e.target.value)}
                  placeholder="例如: ^https://example\.com/\d+$"
                />
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleAddRule}>
            ➕ 添加规则
          </button>

          <div className="examples">
            <h3>💡 快速示例</h3>
            <div className="example-buttons">
              <button className="example-btn" onClick={() => handleLoadExample('https')}>
                HTTPS跳转
              </button>
              <button className="example-btn" onClick={() => handleLoadExample('path')}>
                路径变更
              </button>
              <button className="example-btn" onClick={() => handleLoadExample('query')}>
                保留参数
              </button>
            </div>
          </div>

          <div className="import-export">
            <button className="btn btn-secondary" onClick={handleImportCSV}>
              📥 导入CSV
            </button>
            <button className="btn btn-secondary" onClick={handleImportRules}>
              📥 导入JSON
            </button>
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              📤 导出CSV
            </button>
            <button className="btn btn-secondary" onClick={handleExportRules}>
              📤 导出JSON
            </button>
          </div>

          <div className="csv-hint">
            <small>💡 CSV格式示例：</small>
            <pre>源URL,目标URL
http://old.com,https://new.com
http://old.com/page1,https://new.com/page1</pre>
          </div>
        </div>

        {/* 右侧：规则列表 */}
        <div className="panel rules-list-panel">
          <h2>📋 规则列表 ({rules.length})</h2>

          <div className="action-buttons">
            <button
              className="btn btn-success"
              onClick={handleRunTests}
              disabled={testing || rules.length === 0}
            >
              {testing ? '⏳ 测试中...' : '🚀 开始测试'}
            </button>
            <button className="btn btn-danger" onClick={handleClearRules}>
              🗑️ 清空规则
            </button>
          </div>

          <div className="rules-list">
            {rules.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>暂无规则，请先添加重定向规则</p>
              </div>
            ) : (
              rules.map((rule, index) => (
                <div key={index} className="rule-item">
                  <div className="rule-from">🔗 {rule.from}</div>
                  <div className="rule-to">➡️ {rule.to}</div>
                  <span className="rule-type">{getMatchTypeLabel(rule.matchType)}</span>
                  <button className="remove-btn" onClick={() => handleRemoveRule(index)}>
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 底部：测试结果 */}
        {(testing || testReport) && (
          <div className="panel results-panel">
            <h2>📊 测试结果</h2>

            {testing && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            )}

            {testReport && (
              <>
                <div className="stats">
                  <div className="stat-card">
                    <div className="stat-value">{testReport.summary.total}</div>
                    <div className="stat-label">总测试数</div>
                  </div>
                  <div className="stat-card passed">
                    <div className="stat-value">{testReport.summary.passed}</div>
                    <div className="stat-label">通过</div>
                  </div>
                  <div className="stat-card failed">
                    <div className="stat-value">{testReport.summary.failed}</div>
                    <div className="stat-label">失败</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{testReport.summary.passRate}</div>
                    <div className="stat-label">通过率</div>
                  </div>
                </div>

                <div className="action-buttons">
                  <button
                    className="btn btn-primary"
                    onClick={() => redirectTesterService.exportHtml(testReport)}
                  >
                    📄 导出HTML报告
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => redirectTesterService.exportJson(testReport)}
                  >
                    📊 导出JSON报告
                  </button>
                </div>

                <div className="results-list">
                  {testReport.results.map((result, index) => (
                    <div key={index} className={`result-item ${result.passed ? 'pass' : 'fail'}`}>
                      <div className="result-header">
                        <div className="result-url">{index + 1}. {result.from}</div>
                        <span className={`result-badge ${result.passed ? 'pass' : 'fail'}`}>
                          {result.passed ? '✓ 通过' : '✗ 失败'}
                        </span>
                      </div>
                      <div className="result-details">
                        <div><strong>期望:</strong> {result.expectedTo}</div>
                        <div><strong>实际:</strong> {result.actualTo || 'N/A'}</div>
                        <div>
                          <strong>状态码:</strong> {result.statusCode || 'N/A'} |
                          <strong> 响应时间:</strong> {result.responseTime}ms
                        </div>
                        {!result.passed && (
                          <div className="failure-reason">
                            <strong>失败原因:</strong> {result.reason}
                          </div>
                        )}
                        {result.redirectChain.length > 1 && (
                          <div className="redirect-chain">
                            <strong>重定向链 ({result.redirectChain.length}次):</strong>
                            <ol>
                              {result.redirectChain.map((step, i) => (
                                <li key={i}>
                                  {step.statusCode} → {step.location || '(final)'}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RedirectTester;
