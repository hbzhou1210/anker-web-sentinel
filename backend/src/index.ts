// IMPORTANT: This MUST be the first import to ensure environment variables are loaded
// before any other modules that depend on them
import './config/env.js';

import { configService } from './config/index.js';
import app, { notFoundHandler, errorLoggingMiddleware, errorHandler } from './api/app.js';
import browserPool from './automation/BrowserPool.js';
import cacheService from './services/CacheService.js';
import { setupStaticFiles } from './api/middleware/staticFiles.js';
import testsRouter from './api/routes/tests.js';
import reportsRouter from './api/routes/reports.js';
import feishuRouter from './api/routes/feishu.js';
import responsiveRouter from './api/routes/responsive.js';
import patrolRouter from './api/routes/patrol.js';
import imagesRouter from './api/routes/images.js';
import linkCrawlerRouter from './api/routes/linkCrawler.js';
import discountRuleRouter from './api/routes/discountRule.js';
import seoCheckerRouter from './api/routes/seoChecker.js';
import systemRouter from './api/routes/system.js';
import monitorRouter from './routes/monitor.js';
import multilingualRouter from './api/routes/multilingual.js';
import enhancedMultilingualRouter from './api/routes/enhanced-multilingual.js';
import redirectTesterRouter from './api/routes/redirect-tester.routes.js';
import { patrolSchedulerService } from './services/PatrolSchedulerService.js';
import { imageCompareService } from './automation/ImageCompareService.js';
import { initializeEventSystem, cleanupEventSystem } from './events/index.js';
import { logger } from './utils/logger.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用配置服务获取端口
const PORT = configService.getAppConfig().port;

// Setup static file serving
setupStaticFiles(app);

// Serve discount rule tool output files
// __dirname is backend/dist, need to go up 2 levels to project root
const discountRuleOutputDir = path.join(__dirname, '../../tools/function-discount-checker/output');

// Ensure output directory exists (auto-create if missing)
if (!fs.existsSync(discountRuleOutputDir)) {
  logger.warn('Output directory not found, creating', { path: discountRuleOutputDir });
  fs.mkdirSync(discountRuleOutputDir, { recursive: true });
  logger.info('Output directory created successfully', { path: discountRuleOutputDir });
}

app.use('/discount-rule-output', express.static(discountRuleOutputDir));

// Mount API routes
app.use('/api/v1/tests', testsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/feishu', feishuRouter);
app.use('/api/v1/responsive', responsiveRouter);
app.use('/api/v1/patrol', patrolRouter);
app.use('/api/v1/images', imagesRouter);
app.use('/api/v1/link-crawler', linkCrawlerRouter);
app.use('/api/v1/discount-rule', discountRuleRouter);
app.use('/api/v1/seo-checker', seoCheckerRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/monitor', monitorRouter);
app.use('/api/v1/multilingual', multilingualRouter);
app.use('/api/v1/enhanced-multilingual', enhancedMultilingualRouter);
app.use('/api/redirect-tester', redirectTesterRouter);

// Compatibility route for tool interface - maps /api/check-discount to discount rule router
app.use('/api', discountRuleRouter);

// Version info endpoint
app.get('/api/version', (_req, res) => {
  try {
    const versionInfo = {
      git_commit: process.env.GIT_COMMIT || 'unknown',
      build_date: process.env.BUILD_DATE || 'unknown',
      version: process.env.VERSION || '1.0.0',
      node_version: process.version,
      uptime: process.uptime(),
    };

    // Try to read version.json if it exists
    try {
      const versionFile = fs.readFileSync(path.join(__dirname, '../version.json'), 'utf-8');
      const fileVersion = JSON.parse(versionFile);
      Object.assign(versionInfo, fileVersion);
    } catch {
      // version.json not found, use env vars only
    }

    res.json(versionInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get version info' });
  }
});

// 404 未找到处理 (应该在所有路由之后注册)
app.use(notFoundHandler);

// 错误日志中间件 (在错误处理器之前记录错误)
app.use(errorLoggingMiddleware);

// 全局错误处理中间件 (应该最后注册)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // 打印配置摘要
    configService.printConfigSummary();

    // Using Bitable storage - no PostgreSQL connection needed
    const storageType = configService.getDatabaseConfig().storage;
    logger.info('Using storage for data persistence', { storageType });

    // Initialize event system
    logger.info('Initializing event system...');
    initializeEventSystem();
    logger.info('Event system ready');

    // Initialize Redis cache service
    logger.info('Initializing Redis cache service...');
    await cacheService.connect();
    if (cacheService.isAvailable()) {
      logger.info('Redis cache service ready');
    } else {
      logger.warn('Redis cache service unavailable - running without cache');
    }

    // Initialize browser pool
    logger.info('Initializing browser pool...');
    await browserPool.initialize();
    logger.info('Browser pool ready');

    // Initialize image compare service
    logger.info('Initializing image compare service...');
    await imageCompareService.initialize();
    logger.info('Image compare service ready');

    // Initialize patrol scheduler (optional - won't block server startup if fails)
    logger.info('Initializing patrol scheduler...');
    try {
      await patrolSchedulerService.initialize();
      logger.info('Patrol scheduler ready');
    } catch (error) {
      logger.warn('Patrol scheduler initialization failed (non-critical)', {
        error: error instanceof Error ? error.message : String(error)
      });
      logger.warn('Server will continue without patrol scheduler functionality');
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info('Server running', {
        port: PORT,
        healthCheck: `http://localhost:${PORT}/health`,
        apiEndpoints: `http://localhost:${PORT}/api/v1`
      });
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Cleanup event system
      cleanupEventSystem();

      // Shutdown patrol scheduler
      patrolSchedulerService.shutdown();

      // Close browser pool
      await browserPool.shutdown();

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

startServer();
