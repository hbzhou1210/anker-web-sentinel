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
// testPointsRouter temporarily disabled - requires PostgreSQL repositories
// import testPointsRouter from './api/routes/testPoints.js';
// feishuDocumentsRouter temporarily disabled - requires PostgreSQL repositories
// import feishuDocumentsRouter from './api/routes/feishuDocuments.js';
import feishuRouter from './api/routes/feishu.js';
import responsiveRouter from './api/routes/responsive.js';
import patrolRouter from './api/routes/patrol.js';
import imagesRouter from './api/routes/images.js';
import linkCrawlerRouter from './api/routes/linkCrawler.js';
import discountRuleRouter from './api/routes/discountRule.js';
import systemRouter from './api/routes/system.js';
import monitorRouter from './routes/monitor.js';
import multilingualRouter from './api/routes/multilingual.js';
import { patrolSchedulerService } from './services/PatrolSchedulerService.js';
import { imageCompareService } from './automation/ImageCompareService.js';
import { initializeEventSystem, cleanupEventSystem } from './events/index.js';
import { getMetrics } from './monitoring/metrics.js';
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
  console.log('⚠️  Output directory not found, creating:', discountRuleOutputDir);
  fs.mkdirSync(discountRuleOutputDir, { recursive: true });
  console.log('✓ Output directory created successfully');
}

app.use('/discount-rule-output', express.static(discountRuleOutputDir));

// Mount API routes
app.use('/api/v1/tests', testsRouter);
app.use('/api/v1/reports', reportsRouter);
// app.use('/api/v1/test-points', testPointsRouter); // Temporarily disabled
// app.use('/api/v1/feishu-documents', feishuDocumentsRouter); // Temporarily disabled
app.use('/api/v1/feishu', feishuRouter);
app.use('/api/v1/responsive', responsiveRouter);
app.use('/api/v1/patrol', patrolRouter);
app.use('/api/v1/images', imagesRouter);
app.use('/api/v1/link-crawler', linkCrawlerRouter);
app.use('/api/v1/discount-rule', discountRuleRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/monitor', monitorRouter);
app.use('/api/v1/multilingual', multilingualRouter);

// Compatibility route for tool interface - maps /api/check-discount to discount rule router
app.use('/api', discountRuleRouter);

// Version info endpoint
app.get('/api/version', (req, res) => {
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
    console.log(`✓ Using ${storageType} storage for data persistence`);

    // Initialize event system
    console.log('Initializing event system...');
    initializeEventSystem();
    console.log('✓ Event system ready');

    // Initialize Redis cache service
    console.log('Initializing Redis cache service...');
    await cacheService.connect();
    if (cacheService.isAvailable()) {
      console.log('✓ Redis cache service ready');
    } else {
      console.warn('⚠️  Redis cache service unavailable - running without cache');
    }

    // Initialize browser pool
    console.log('Initializing browser pool...');
    await browserPool.initialize();
    console.log('✓ Browser pool ready');

    // Initialize image compare service
    console.log('Initializing image compare service...');
    await imageCompareService.initialize();
    console.log('✓ Image compare service ready');

    // Initialize patrol scheduler (optional - won't block server startup if fails)
    console.log('Initializing patrol scheduler...');
    try {
      await patrolSchedulerService.initialize();
      console.log('✓ Patrol scheduler ready');
    } catch (error) {
      console.warn('⚠️  Patrol scheduler initialization failed (non-critical):', error instanceof Error ? error.message : error);
      console.warn('   Server will continue without patrol scheduler functionality');
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   API endpoints will be available at: http://localhost:${PORT}/api/v1`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n⏳ Shutting down gracefully...');

      // Close HTTP server
      server.close(() => {
        console.log('✓ HTTP server closed');
      });

      // Cleanup event system
      cleanupEventSystem();

      // Shutdown patrol scheduler
      patrolSchedulerService.shutdown();

      // Close browser pool
      await browserPool.shutdown();

      console.log('✓ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
