import React, { useState } from 'react';
import './TestPointExtraction.css';

interface TestPoint {
  id: string;
  category?: string;
  feature: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  testType?: string;
  preconditions?: string;
  expectedResult?: string;
  testData?: Record<string, any>;
  status: string;
}

interface ExtractResponse {
  success: boolean;
  message: string;
  data: {
    documentId: string;
    testPoints: TestPoint[];
    feishuDocUrl: string;
    testDocTitle: string;
    markdown: string;
  };
}

export const TestPointExtraction: React.FC = () => {
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedPoints, setExtractedPoints] = useState<TestPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feishuDocUrl, setFeishuDocUrl] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>('');
  const [testDocTitle, setTestDocTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'cards' | 'markdown'>('cards');

  const handleExtract = async () => {
    // 验证输入: 飞书文档链接是必填的
    if (!documentUrl.trim()) {
      setError('请提供飞书文档链接');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setFeishuDocUrl(null);
    setMarkdown('');
    setTestDocTitle('');

    try {
      // 步骤1: 如果没有文档内容,先调用后端获取文档ID
      let content = documentContent;
      let title = '';

      if (!content.trim()) {
        // 发送请求到后端,获取文档ID
        const checkResponse = await fetch('http://localhost:3000/api/v1/test-points/extract-and-save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentUrl: documentUrl,
          }),
        });

        if (!checkResponse.ok) {
          const errorData = await checkResponse.json();
          throw new Error(errorData.message || '验证文档链接失败');
        }

        const checkResult = await checkResponse.json();

        if (checkResult.needsFetch) {
          // 尝试通过后端API自动获取文档内容
          const documentId = checkResult.data.documentId;

          try {
            const fetchResponse = await fetch('http://localhost:3000/api/v1/feishu/fetch-document', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                documentId: documentId,
              }),
            });

            if (fetchResponse.ok) {
              const fetchResult = await fetchResponse.json();
              content = fetchResult.data.content;
              title = ''; // 可以从文档内容中提取标题
            } else {
              const errorData = await fetchResponse.json();

              // 如果是配置问题,提示用户手动粘贴
              if (errorData.error === 'Feishu API not configured') {
                setError(
                  `⚠️ 飞书API未配置\n\n` +
                  `请选择以下方式之一:\n\n` +
                  `方式1: 手动复制粘贴飞书文档内容到下方输入框\n\n` +
                  `方式2: 配置飞书API凭据(需要管理员权限):\n` +
                  `1. 访问 https://open.feishu.cn/app 创建应用\n` +
                  `2. 在后端 .env 文件中设置:\n` +
                  `   FEISHU_APP_ID=你的应用ID\n` +
                  `   FEISHU_APP_SECRET=你的应用密钥\n` +
                  `3. 重启后端服务\n\n` +
                  `文档ID: ${documentId}`
                );
                setIsExtracting(false);
                return;
              }

              throw new Error(errorData.message || '获取文档内容失败');
            }
          } catch (fetchError) {
            throw new Error(`无法自动获取文档内容: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`);
          }
        }
      }

      // 步骤2: 使用文档内容提取测试点
      const response = await fetch('http://localhost:3000/api/v1/test-points/extract-and-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentUrl: documentUrl,
          documentContent: content,
          documentTitle: title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '提取失败');
      }

      const result: ExtractResponse = await response.json();
      setExtractedPoints(result.data.testPoints || []);
      setFeishuDocUrl(result.data.feishuDocUrl || null);
      setMarkdown(result.data.markdown || '');
      setTestDocTitle(result.data.testDocTitle || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提取测试点时发生错误');
    } finally {
      setIsExtracting(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'priority-badge priority-high';
      case 'medium':
        return 'priority-badge priority-medium';
      case 'low':
        return 'priority-badge priority-low';
      default:
        return 'priority-badge';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return priority;
    }
  };

  return (
    <div className="test-point-extraction-page">
      <div className="page-header">
        <h2 className="page-title">测试点提取</h2>
        <p className="page-description">从飞书需求文档中自动提取测试点</p>
      </div>

      <div className="extraction-container">
        {/* 输入区域 */}
        <div className="input-section">
          <div className="card">
            <h3 className="section-title">文档信息</h3>

            <div className="form-group">
              <label htmlFor="documentUrl">飞书文档链接 <span className="required">*</span></label>
              <input
                id="documentUrl"
                type="text"
                className="form-input"
                placeholder="https://example.feishu.cn/docx/xxxxx"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
              />
              <p className="form-hint">
                📝 请提供飞书文档链接。系统将自动获取文档内容(需配置飞书API),或提示您手动粘贴。
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="content">文档内容 (可选 - 自动获取)</label>
              <textarea
                id="content"
                className="form-textarea"
                placeholder="留空将自动从飞书获取,或手动粘贴文档内容..."
                rows={12}
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
              />
              <p className="form-hint">
                💡 自动模式: 留空,系统会尝试自动获取飞书文档内容<br />
                💡 手动模式: 直接粘贴文档内容到此处
              </p>
            </div>

            <button
              className="extract-button"
              onClick={handleExtract}
              disabled={isExtracting || !documentUrl.trim()}
            >
              {isExtracting ? (
                <>
                  <span className="spinner"></span>
                  正在提取并生成测试点文档...
                </>
              ) : (
                '提取测试点并保存到飞书'
              )}
            </button>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {feishuDocUrl && (
              <div className="success-message" style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                color: '#1e40af',
                fontSize: '14px',
              }}>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>✓</span>
                测试点文档已保存到飞书！
                <a
                  href={feishuDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: '8px',
                    color: '#2563eb',
                    textDecoration: 'underline',
                    fontWeight: 600,
                  }}
                >
                  点击查看
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 结果区域 */}
        {extractedPoints.length > 0 && (
          <div className="results-section">
            <div className="card">
              <div className="results-header">
                <h3 className="section-title">
                  提取结果 <span className="count-badge">{extractedPoints.length}</span>
                </h3>
                <div className="view-tabs">
                  <button
                    className={`tab-button ${activeTab === 'cards' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cards')}
                  >
                    📊 卡片视图
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'markdown' ? 'active' : ''}`}
                    onClick={() => setActiveTab('markdown')}
                  >
                    📝 表格预览
                  </button>
                </div>
              </div>

              {activeTab === 'cards' ? (
                <div className="test-points-list">
                  {extractedPoints.map((point, index) => (
                    <div key={point.id} className="test-point-card">
                      <div className="test-point-header">
                        <span className="test-point-number">#{index + 1}</span>
                        <span className={getPriorityBadgeClass(point.priority)}>
                          {getPriorityText(point.priority)}
                        </span>
                        {point.category && (
                          <span className="category-badge">{point.category}</span>
                        )}
                      </div>

                      <div className="test-point-content">
                        <h4 className="test-point-feature">{point.feature}</h4>
                        <p className="test-point-description">{point.description}</p>

                        {point.testType && (
                          <div className="test-point-detail">
                            <strong>测试类型:</strong> {point.testType}
                          </div>
                        )}

                        {point.preconditions && (
                          <div className="test-point-detail">
                            <strong>前置条件:</strong> {point.preconditions}
                          </div>
                        )}

                        {point.expectedResult && (
                          <div className="test-point-detail">
                            <strong>预期结果:</strong> {point.expectedResult}
                          </div>
                        )}

                        {point.testData && (
                          <div className="test-point-detail">
                            <strong>测试数据:</strong>
                            <pre className="test-data-json">
                              {JSON.stringify(point.testData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="markdown-preview">
                  <div className="markdown-header">
                    <h4 className="markdown-title">{testDocTitle}</h4>
                    <button
                      className="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText(markdown);
                        alert('Markdown 已复制到剪贴板！');
                      }}
                    >
                      📋 复制 Markdown
                    </button>
                  </div>
                  <pre className="markdown-content">{markdown}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
