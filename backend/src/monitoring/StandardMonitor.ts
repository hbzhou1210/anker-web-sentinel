import axios from 'axios';
import { LightweightMonitor } from './LightweightMonitor.js';
import * as tls from 'tls';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsResolve4 = promisify(dns.resolve4);

/**
 * 增强型监控结果
 */
export interface EnhancedCheckResult {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  statusCode?: number;
  contentLength?: number;
  error?: string;
  errorCategory?: string;
  warning?: string;

  // SSL 信息
  sslInfo?: {
    valid: boolean;
    daysLeft: number;
    issuer: string;
    validFrom: Date;
    validTo: Date;
  };

  // DNS 信息
  dnsInfo?: {
    resolveTime: number;
    addresses: string[];
  };
}

/**
 * 标准监控（增强版）
 *
 * 特点：
 * - 包含轻量级监控的所有功能
 * - 额外检查 SSL 证书有效期
 * - 额外检查 DNS 解析时间
 * - 支持关键字匹配验证
 *
 * 适用场景：
 * - 需要验证特定内容的页面
 * - 需要检查 SSL 证书的 HTTPS 站点
 * - 需要监控 DNS 解析性能
 *
 * 覆盖率：适用于 30% 的网站
 */
export class StandardMonitor extends LightweightMonitor {
  /**
   * 增强型检查
   */
  async check(
    url: string,
    options?: {
      keywords?: string[];      // 关键字检查
      checkSSL?: boolean;       // SSL 证书检查
      checkDNS?: boolean;       // DNS 检查
    }
  ): Promise<EnhancedCheckResult> {
    // 1. 基础 HTTP 检查
    const basicResult = await super.check(url);
    const enhancedResult: EnhancedCheckResult = { ...basicResult };

    // 如果基础检查失败，直接返回
    if (basicResult.status === 'down') {
      return enhancedResult;
    }

    try {
      // 2. 关键字验证
      if (options?.keywords && options.keywords.length > 0 && basicResult.status === 'up') {
        const keywordCheck = await this.checkKeywords(url, options.keywords);
        if (!keywordCheck.success) {
          enhancedResult.status = 'degraded';
          enhancedResult.warning = keywordCheck.warning;
        }
      }

      // 3. SSL 证书检查
      if (options?.checkSSL && url.startsWith('https://')) {
        const sslInfo = await this.checkSSLCertificate(url);
        enhancedResult.sslInfo = sslInfo;

        // SSL 证书即将过期（30天内）
        if (sslInfo.daysLeft < 30) {
          enhancedResult.warning = `SSL certificate expires in ${sslInfo.daysLeft} days`;
        }

        // SSL 证书已过期
        if (sslInfo.daysLeft < 0) {
          enhancedResult.status = 'down';
          enhancedResult.error = 'SSL certificate has expired';
        }
      }

      // 4. DNS 检查
      if (options?.checkDNS) {
        const dnsInfo = await this.checkDNSResolution(url);
        enhancedResult.dnsInfo = dnsInfo;

        // DNS 解析时间过长（> 2秒）
        if (dnsInfo.resolveTime > 2000) {
          enhancedResult.warning = `Slow DNS resolution: ${dnsInfo.resolveTime}ms`;
        }
      }
    } catch (error: any) {
      console.error('[StandardMonitor] Enhanced check error:', error.message);
      // 增强检查失败不影响基本可用性判断
      enhancedResult.warning = `Enhanced check failed: ${error.message}`;
    }

    return enhancedResult;
  }

  /**
   * 关键字检查
   */
  private async checkKeywords(
    url: string,
    keywords: string[]
  ): Promise<{ success: boolean; warning?: string }> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'AnkerWebSentinel/1.0 (Standard Monitor)'
        }
      });

      const content = String(response.data);
      const missingKeywords = keywords.filter(keyword => !content.includes(keyword));

      if (missingKeywords.length > 0) {
        return {
          success: false,
          warning: `Missing keywords: ${missingKeywords.join(', ')}`
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        warning: `Failed to check keywords: ${error.message}`
      };
    }
  }

  /**
   * SSL 证书检查
   */
  private async checkSSLCertificate(url: string): Promise<{
    valid: boolean;
    daysLeft: number;
    issuer: string;
    validFrom: Date;
    validTo: Date;
  }> {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port ? parseInt(urlObj.port) : 443;

    return new Promise((resolve, reject) => {
      const socket = tls.connect(port, hostname, { servername: hostname }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('No certificate found'));
          return;
        }

        const validTo = new Date(cert.valid_to);
        const validFrom = new Date(cert.valid_from);
        const daysLeft = Math.floor(
          (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        resolve({
          valid: socket.authorized,
          daysLeft,
          issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
          validFrom,
          validTo
        });
      });

      socket.on('error', (error) => {
        reject(new Error(`SSL check failed: ${error.message}`));
      });

      // 超时保护
      socket.setTimeout(5000, () => {
        socket.destroy();
        reject(new Error('SSL check timeout'));
      });
    });
  }

  /**
   * DNS 解析检查
   */
  private async checkDNSResolution(url: string): Promise<{
    resolveTime: number;
    addresses: string[];
  }> {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    const startTime = Date.now();
    try {
      const addresses = await dnsResolve4(hostname);
      const resolveTime = Date.now() - startTime;

      return {
        resolveTime,
        addresses
      };
    } catch (error: any) {
      throw new Error(`DNS resolution failed: ${error.message}`);
    }
  }
}

export default new StandardMonitor();
