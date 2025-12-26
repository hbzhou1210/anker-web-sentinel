import { useState, useEffect } from 'react';
import { Globe, CheckCircle, XCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { getFullApiUrl } from '../services/api';
import './MultilingualCheck.css';

interface LanguageError {
  rule: {
    id: string;
    description: string;
    category: {
      id: string;
      name: string;
    };
  };
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  replacements: Array<{ value: string }>;
  severity: 'error' | 'warning' | 'info';
}

interface LanguageResult {
  language: string;
  languageName: string;
  errors: LanguageError[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  textLength: number;
}

interface MultilingualTestReport {
  url: string;
  timestamp: string;
  languages: LanguageResult[];
  totalErrors: number;
  totalWarnings: number;
  summary: {
    languagesChecked: number;
    totalIssues: number;
    criticalIssues: number;
  };
}

const AVAILABLE_LANGUAGES = [
  { code: 'en-US', name: '英语 (English)', flag: '🇺🇸' },
  { code: 'de-DE', name: '德语 (Deutsch)', flag: '🇩🇪' },
  { code: 'fr-FR', name: '法语 (Français)', flag: '🇫🇷' },
  { code: 'es-ES', name: '西班牙语 (Español)', flag: '🇪🇸' },
  { code: 'it-IT', name: '意大利语 (Italiano)', flag: '🇮🇹' },
  { code: 'pt-PT', name: '葡萄牙语 (Português)', flag: '🇵🇹' },
  { code: 'nl-NL', name: '荷兰语 (Nederlands)', flag: '🇳🇱' },
  { code: 'ja-JP', name: '日语 (日本語)', flag: '🇯🇵' },
  { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
];

export default function MultilingualCheck() {
  const [url, setUrl] = useState(() => {
    return localStorage.getItem('multilingualCheck_url') || '';
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() => {
    const saved = localStorage.getItem('multilingualCheck_languages');
    return saved ? JSON.parse(saved) : ['en-US', 'de-DE', 'fr-FR'];
  });
  const [loading, setLoading] = useState(false);
  const [languageToolHealthy, setLanguageToolHealthy] = useState<boolean | null>(null);
  const [results, setResults] = useState<MultilingualTestReport | null>(() => {
    const saved = localStorage.getItem('multilingualCheck_results');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState('');
  const [expandedLanguages, setExpandedLanguages] = useState<string[]>([]);

  // 检查 LanguageTool 服务健康状态
  const checkHealth = async () => {
    try {
      const response = await fetch(getFullApiUrl('/api/v1/multilingual/health'));
      const data = await response.json();
      setLanguageToolHealthy(data.data?.healthy || false);
    } catch (err) {
      setLanguageToolHealthy(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // 保存状态到 localStorage
  useEffect(() => {
    localStorage.setItem('multilingualCheck_url', url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem('multilingualCheck_languages', JSON.stringify(selectedLanguages));
  }, [selectedLanguages]);

  useEffect(() => {
    if (results) {
      localStorage.setItem('multilingualCheck_results', JSON.stringify(results));
    }
  }, [results]);

  const handleLanguageToggle = (langCode: string) => {
    setSelectedLanguages(prev =>
      prev.includes(langCode)
        ? prev.filter(l => l !== langCode)
        : [...prev, langCode]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      setError('请输入网页URL');
      return;
    }

    if (selectedLanguages.length === 0) {
      setError('请至少选择一种语言');
      return;
    }

    if (!languageToolHealthy) {
      setError('LanguageTool 服务未启动,请先启动服务');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch(getFullApiUrl('/api/v1/multilingual/check'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          languages: selectedLanguages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '检查失败');
      }

      setResults(data.data);
      setExpandedLanguages(data.data.languages.map((l: LanguageResult) => l.language));
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查失败,请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguageExpanded = (language: string) => {
    setExpandedLanguages(prev =>
      prev.includes(language)
        ? prev.filter(l => l !== language)
        : [...prev, language]
    );
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="severity-icon error" />;
      case 'warning':
        return <AlertTriangle className="severity-icon warning" />;
      case 'info':
        return <Info className="severity-icon info" />;
      default:
        return null;
    }
  };

  const getLanguageFlag = (langCode: string) => {
    const lang = AVAILABLE_LANGUAGES.find(l => l.code === langCode);
    return lang?.flag || '🌐';
  };

  const getLanguageName = (langCode: string) => {
    const lang = AVAILABLE_LANGUAGES.find(l => l.code === langCode);
    return lang?.name || langCode;
  };

  return (
    <div className="multilingual-check-page">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title-section">
            <Globe className="page-icon" />
            <div>
              <h1>多语言文案检查</h1>
              <p className="page-description">
                检查网页多语言内容的语法、拼写和常见错误
              </p>
            </div>
          </div>
          <div className="service-status">
            {languageToolHealthy === null ? (
              <span className="status-badge checking">
                <Loader2 className="spinning" size={14} />
                检查中...
              </span>
            ) : languageToolHealthy ? (
              <span className="status-badge healthy">
                <CheckCircle size={14} />
                服务正常
              </span>
            ) : (
              <span className="status-badge unhealthy">
                <XCircle size={14} />
                服务未启动
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="content-container">
        {!languageToolHealthy && languageToolHealthy !== null && (
          <div className="alert alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>LanguageTool 服务未启动</strong>
              <p>请先启动 LanguageTool 服务:</p>
              <code>docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest</code>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="test-form">
          <div className="form-group">
            <label htmlFor="url">网页 URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>选择检查语言</label>
            <div className="language-selector">
              {AVAILABLE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`language-option ${
                    selectedLanguages.includes(lang.code) ? 'selected' : ''
                  }`}
                  onClick={() => handleLanguageToggle(lang.code)}
                  disabled={loading}
                >
                  <span className="language-flag">{lang.flag}</span>
                  <span className="language-name">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <XCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !languageToolHealthy}
          >
            {loading ? (
              <>
                <Loader2 className="spinning" size={20} />
                检查中...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                开始检查
              </>
            )}
          </button>
        </form>

        {results && (
          <div className="results-section">
            <div className="results-header">
              <h2>检查结果</h2>
              <div className="results-meta">
                <span>URL: {results.url}</span>
                <span>时间: {new Date(results.timestamp).toLocaleString('zh-CN')}</span>
              </div>
            </div>

            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-label">检查语言</div>
                <div className="summary-value">{results.summary.languagesChecked}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">总问题数</div>
                <div className="summary-value error">{results.summary.totalIssues}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">严重问题</div>
                <div className="summary-value error">{results.summary.criticalIssues}</div>
              </div>
            </div>

            <div className="language-results">
              {results.languages?.map((langResult) => (
                <div key={langResult.language} className="language-result-card">
                  <div
                    className="language-header"
                    onClick={() => toggleLanguageExpanded(langResult.language)}
                  >
                    <div className="language-info">
                      <span className="language-flag-large">
                        {getLanguageFlag(langResult.language)}
                      </span>
                      <div>
                        <h3>{getLanguageName(langResult.language)}</h3>
                        <p className="language-stats">
                          文本长度: {langResult.textLength} 字符 |
                          共 {langResult.errors.length} 个问题
                        </p>
                      </div>
                    </div>
                    <div className="issue-counts">
                      {langResult.errorCount > 0 && (
                        <span className="issue-count error">
                          <XCircle size={16} />
                          {langResult.errorCount}
                        </span>
                      )}
                      {langResult.warningCount > 0 && (
                        <span className="issue-count warning">
                          <AlertTriangle size={16} />
                          {langResult.warningCount}
                        </span>
                      )}
                      {langResult.infoCount > 0 && (
                        <span className="issue-count info">
                          <Info size={16} />
                          {langResult.infoCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {expandedLanguages.includes(langResult.language) && (
                    <div className="errors-list">
                      {langResult.errors.length === 0 ? (
                        <div className="no-errors">
                          <CheckCircle size={24} />
                          <p>未发现问题</p>
                        </div>
                      ) : (
                        langResult.errors.map((error, index) => (
                          <div key={index} className={`error-item ${error.severity}`}>
                            <div className="error-header">
                              {getSeverityIcon(error.severity)}
                              <span className="error-message">{error.message}</span>
                            </div>
                            <div className="error-context">
                              <code>{error.context.text}</code>
                            </div>
                            {error.replacements.length > 0 && (
                              <div className="error-suggestions">
                                <strong>建议:</strong>
                                {error.replacements.slice(0, 3).map((rep, i) => (
                                  <span key={i} className="suggestion">
                                    {rep.value}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="error-details">
                              <span>规则: {error.rule.id}</span>
                              <span>类别: {error.rule.category.name}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
