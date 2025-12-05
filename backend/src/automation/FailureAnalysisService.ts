import { TestResultStatus, UITestType } from '../models/entities.js';

export interface FailureAnalysis {
  cause: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
  fixComplexity: 'easy' | 'medium' | 'hard';
}

export class FailureAnalysisService {
  // Analyze UI test failure and provide recommendations
  analyzeUITestFailure(
    testType: UITestType,
    status: TestResultStatus,
    errorMessage?: string,
    diagnostics?: Record<string, any>
  ): FailureAnalysis | null {
    // Only analyze failures and warnings
    if (status === TestResultStatus.Pass) {
      return null;
    }

    switch (testType) {
      case UITestType.Link:
        return this.analyzeLinkFailure(errorMessage, diagnostics);
      case UITestType.Form:
        return this.analyzeFormFailure(errorMessage, diagnostics);
      case UITestType.Button:
        return this.analyzeButtonFailure(errorMessage, diagnostics);
      case UITestType.Image:
        return this.analyzeImageFailure(errorMessage, diagnostics);
      default:
        return null;
    }
  }

  // Analyze performance test failure
  analyzePerformanceFailure(
    metricType: string,
    actualValue: number,
    threshold: number,
    status: TestResultStatus
  ): FailureAnalysis | null {
    if (status === TestResultStatus.Pass) {
      return null;
    }

    const severity = status === TestResultStatus.Fail ? 'high' : 'medium';
    const overagePercent = ((actualValue - threshold) / threshold) * 100;

    switch (metricType) {
      case 'loadTime':
        return {
          cause: `页面加载时间为 ${actualValue}ms,超过阈值 ${threshold}ms ${overagePercent.toFixed(0)}%`,
          recommendation: this.getLoadTimeRecommendation(overagePercent),
          severity,
          fixComplexity: overagePercent > 100 ? 'hard' : overagePercent > 50 ? 'medium' : 'easy',
        };

      case 'resourceSize':
        const actualMB = (actualValue / (1024 * 1024)).toFixed(2);
        const thresholdMB = (threshold / (1024 * 1024)).toFixed(2);
        return {
          cause: `资源总大小为 ${actualMB}MB,超过阈值 ${thresholdMB}MB ${overagePercent.toFixed(0)}%`,
          recommendation: this.getResourceSizeRecommendation(overagePercent),
          severity,
          fixComplexity: overagePercent > 100 ? 'hard' : 'medium',
        };

      case 'responseTime':
        return {
          cause: `服务器响应时间(TTFB)为 ${actualValue}ms,超过阈值 ${threshold}ms ${overagePercent.toFixed(0)}%`,
          recommendation: this.getResponseTimeRecommendation(overagePercent),
          severity,
          fixComplexity: 'medium',
        };

      case 'renderTime':
        return {
          cause: `首次渲染时间为 ${actualValue}ms,超过阈值 ${threshold}ms ${overagePercent.toFixed(0)}%`,
          recommendation: this.getRenderTimeRecommendation(overagePercent),
          severity,
          fixComplexity: overagePercent > 100 ? 'hard' : 'medium',
        };

      default:
        return null;
    }
  }

  // --- Private Helper Methods ---

  private analyzeLinkFailure(errorMessage?: string, diagnostics?: Record<string, any>): FailureAnalysis {
    if (errorMessage?.includes('empty or anchor-only href')) {
      return {
        cause: '链接的 href 属性为空或仅为锚点(#)',
        recommendation: '修改链接添加有效的 URL 或将其改为 <button> 元素。如果是单页应用的路由链接,使用框架的路由组件(如 React Router 的 <Link>)',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('hidden')) {
      return {
        cause: '链接通过 CSS 隐藏(display:none 或 visibility:hidden),用户无法看到和点击',
        recommendation: '检查 CSS 样式,移除隐藏属性。如果链接应该隐藏,考虑使用 aria-hidden="true" 并从 DOM 中移除',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('HTTP error')) {
      const status = diagnostics?.status || 'unknown';
      if (status === 404) {
        return {
          cause: '链接指向的页面不存在(404 错误)',
          recommendation: '检查 URL 拼写是否正确,或确认目标页面是否已删除。更新链接指向正确的页面',
          severity: 'high',
          fixComplexity: 'easy',
        };
      } else if (status >= 500) {
        return {
          cause: `链接指向的页面返回服务器错误(${status})`,
          recommendation: '检查服务器日志,修复服务器端错误。这可能是后端 bug 或配置问题',
          severity: 'high',
          fixComplexity: 'hard',
        };
      }
    }

    return {
      cause: errorMessage || '链接测试失败',
      recommendation: '检查链接的 href 属性和目标页面是否正常',
      severity: 'medium',
      fixComplexity: 'medium',
    };
  }

  private analyzeFormFailure(errorMessage?: string, diagnostics?: Record<string, any>): FailureAnalysis {
    if (errorMessage?.includes('No submit button')) {
      return {
        cause: '表单缺少提交按钮,用户无法提交表单',
        recommendation: '添加 <button type="submit"> 或 <input type="submit"> 元素。确保按钮在 <form> 标签内部',
        severity: 'high',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('hidden')) {
      return {
        cause: '表单通过 CSS 隐藏,用户无法看到和使用',
        recommendation: '检查 CSS 样式,移除隐藏属性。如果表单用于 AJAX 提交,考虑使用 JavaScript 拦截默认提交行为',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('No accessible label')) {
      return {
        cause: '表单输入字段缺少可访问的标签,影响无障碍访问',
        recommendation: '为每个输入字段添加 <label> 元素,使用 for 属性关联,或使用 aria-label 属性',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    return {
      cause: errorMessage || '表单测试失败',
      recommendation: '检查表单结构和提交功能是否正常',
      severity: 'medium',
      fixComplexity: 'medium',
    };
  }

  private analyzeButtonFailure(errorMessage?: string, diagnostics?: Record<string, any>): FailureAnalysis {
    if (errorMessage?.includes('hidden')) {
      return {
        cause: '按钮通过 CSS 隐藏,用户无法看到和点击',
        recommendation: '检查 CSS 样式,移除隐藏属性。如果按钮应该隐藏,使用条件渲染从 DOM 中移除',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('disabled')) {
      return {
        cause: '按钮被禁用,用户无法点击',
        recommendation: '检查禁用逻辑。如果按钮应该可用,移除 disabled 属性。确保表单验证逻辑正确',
        severity: 'low',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('No accessible text')) {
      return {
        cause: '按钮缺少可访问的文本,屏幕阅读器无法识别',
        recommendation: '添加按钮文本内容,或使用 aria-label 属性。图标按钮应该包含辅助文本',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    return {
      cause: errorMessage || '按钮测试失败',
      recommendation: '检查按钮的状态和可访问性',
      severity: 'medium',
      fixComplexity: 'medium',
    };
  }

  private analyzeImageFailure(errorMessage?: string, diagnostics?: Record<string, any>): FailureAnalysis {
    if (errorMessage?.includes('No src attribute')) {
      return {
        cause: '图片缺少 src 属性,无法加载',
        recommendation: '添加 src 属性指向图片 URL。如果使用延迟加载,确保 data-src 属性存在',
        severity: 'high',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('Failed to load')) {
      const src = diagnostics?.src || '';
      if (src.includes('404')) {
        return {
          cause: '图片文件不存在(404 错误)',
          recommendation: '检查图片路径是否正确,确认图片文件已上传到服务器。更新 src 指向正确的图片',
          severity: 'high',
          fixComplexity: 'easy',
        };
      }
      return {
        cause: '图片加载失败,可能是网络错误或权限问题',
        recommendation: '检查图片 URL 是否可访问,确认 CORS 配置。考虑添加错误处理和占位图',
        severity: 'high',
        fixComplexity: 'medium',
      };
    }

    if (errorMessage?.includes('No alt attribute')) {
      return {
        cause: '图片缺少 alt 属性,影响无障碍访问和 SEO',
        recommendation: '为所有图片添加描述性的 alt 属性。装饰性图片使用空 alt="" 即可',
        severity: 'medium',
        fixComplexity: 'easy',
      };
    }

    if (errorMessage?.includes('Large file size')) {
      const size = diagnostics?.size || 0;
      const sizeMB = (size / (1024 * 1024)).toFixed(2);
      return {
        cause: `图片文件过大(${sizeMB}MB),影响加载速度`,
        recommendation: '使用图片压缩工具减小文件大小,或使用现代格式(WebP, AVIF)。考虑响应式图片(<picture>元素)',
        severity: 'medium',
        fixComplexity: 'medium',
      };
    }

    return {
      cause: errorMessage || '图片测试失败',
      recommendation: '检查图片的 src 和 alt 属性',
      severity: 'medium',
      fixComplexity: 'medium',
    };
  }

  private getLoadTimeRecommendation(overagePercent: number): string {
    if (overagePercent > 200) {
      return '页面加载严重超时。建议:\n1. 使用 CDN 加速静态资源\n2. 启用 HTTP/2 或 HTTP/3\n3. 压缩 HTML/CSS/JS 文件\n4. 优化图片(使用 WebP 格式)\n5. 减少第三方脚本\n6. 实现代码分割和懒加载';
    } else if (overagePercent > 100) {
      return '页面加载明显超时。建议:\n1. 压缩和合并 CSS/JS 文件\n2. 优化图片大小和格式\n3. 启用浏览器缓存\n4. 移除未使用的代码\n5. 延迟加载非关键资源';
    } else {
      return '页面加载略微超时。建议:\n1. 优化关键渲染路径\n2. 内联关键 CSS\n3. 异步加载非关键 JS\n4. 使用资源预加载(preload/prefetch)';
    }
  }

  private getResourceSizeRecommendation(overagePercent: number): string {
    if (overagePercent > 100) {
      return '资源大小严重超标。建议:\n1. 使用 Webpack/Vite 的 tree-shaking 移除未使用代码\n2. 压缩所有图片(使用 WebP/AVIF)\n3. 启用 Gzip/Brotli 压缩\n4. 分析最大资源,考虑按需加载\n5. 移除未使用的第三方库';
    } else if (overagePercent > 50) {
      return '资源大小超标。建议:\n1. 代码分割,按路由懒加载\n2. 压缩图片和字体文件\n3. 使用 SVG 替代图标字体\n4. 审查第三方依赖,移除冗余库';
    } else {
      return '资源大小略微超标。建议:\n1. 启用文本压缩(Gzip/Brotli)\n2. 优化最大的几个资源文件\n3. 使用现代图片格式';
    }
  }

  private getResponseTimeRecommendation(overagePercent: number): string {
    if (overagePercent > 100) {
      return '服务器响应严重缓慢。建议:\n1. 升级服务器配置或使用更快的主机\n2. 优化数据库查询,添加索引\n3. 实现应用层缓存(Redis/Memcached)\n4. 使用 CDN 进行边缘缓存\n5. 检查是否有慢查询或 N+1 问题';
    } else if (overagePercent > 50) {
      return '服务器响应较慢。建议:\n1. 实现页面缓存\n2. 优化数据库查询\n3. 使用 CDN\n4. 检查服务器资源使用情况';
    } else {
      return '服务器响应略慢。建议:\n1. 启用 HTTP 缓存头\n2. 使用 CDN\n3. 检查数据库查询性能';
    }
  }

  private getRenderTimeRecommendation(overagePercent: number): string {
    if (overagePercent > 100) {
      return '首次渲染严重延迟。建议:\n1. 内联关键 CSS\n2. 移除阻塞渲染的 JS\n3. 优化字体加载(font-display: swap)\n4. 使用服务端渲染(SSR)或静态生成(SSG)\n5. 减少 DOM 复杂度';
    } else if (overagePercent > 50) {
      return '首次渲染延迟。建议:\n1. 优化关键渲染路径\n2. 内联关键 CSS\n3. 异步加载字体\n4. 减少首屏 DOM 节点数';
    } else {
      return '首次渲染略微延迟。建议:\n1. 优化 CSS 加载顺序\n2. 使用资源提示(preconnect)\n3. 优化 Web 字体加载';
    }
  }
}

export default new FailureAnalysisService();
