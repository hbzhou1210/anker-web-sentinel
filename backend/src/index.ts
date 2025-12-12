import dotenv from 'dotenv';
import app from './api/app.js';
import browserPool from './automation/BrowserPool.js';
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
import { patrolSchedulerService } from './services/PatrolSchedulerService.js';
import { imageCompareService } from './automation/ImageCompareService.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Setup static file serving
setupStaticFiles(app);

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

// Start server
async function startServer() {
  try {
    // Using Bitable storage - no PostgreSQL connection needed
    console.log('✓ Using Bitable storage for data persistence');

    // Initialize browser pool
    console.log('Initializing browser pool...');
    await browserPool.initialize();
    console.log('✓ Browser pool ready');

    // Initialize image compare service
    console.log('Initializing image compare service...');
    await imageCompareService.initialize();
    console.log('✓ Image compare service ready');

    // Initialize patrol scheduler
    console.log('Initializing patrol scheduler...');
    await patrolSchedulerService.initialize();
    console.log('✓ Patrol scheduler ready');

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
