import dotenv from 'dotenv';
import app from './api/app.js';
import { healthCheck, closePool, query } from './database/connection.js';
import browserPool from './automation/BrowserPool.js';
import { setupStaticFiles } from './api/middleware/staticFiles.js';
import testsRouter from './api/routes/tests.js';
import reportsRouter from './api/routes/reports.js';
import testPointsRouter from './api/routes/testPoints.js';
import feishuDocumentsRouter from './api/routes/feishuDocuments.js';
import feishuRouter from './api/routes/feishu.js';
import responsiveRouter from './api/routes/responsive.js';
import patrolRouter from './api/routes/patrol.js';
import { patrolSchedulerService } from './services/PatrolSchedulerService.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Setup static file serving
setupStaticFiles(app);

// Mount API routes
app.use('/api/v1/tests', testsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/test-points', testPointsRouter);
app.use('/api/v1/feishu-documents', feishuDocumentsRouter);
app.use('/api/v1/feishu', feishuRouter);
app.use('/api/v1/responsive', responsiveRouter);
app.use('/api/v1/patrol', patrolRouter);

// Start server
async function startServer() {
  try {
    // Check database connection
    console.log('Checking database connection...');
    const dbHealthy = await healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✓ Database connection healthy');

    // Initialize browser pool
    console.log('Initializing browser pool...');
    await browserPool.initialize();
    console.log('✓ Browser pool ready');

    // Initialize patrol scheduler
    console.log('Initializing patrol scheduler...');
    await patrolSchedulerService.initialize();
    console.log('✓ Patrol scheduler ready');

    // Setup automatic cleanup of stuck test requests
    const cleanupStuckTests = async () => {
      try {
        const result = await query(
          "UPDATE test_requests SET status = 'failed' WHERE status = 'running' AND requested_at < NOW() - INTERVAL '1 hour'"
        );
        if (result.rowCount && result.rowCount > 0) {
          console.log(`✓ Cleaned up ${result.rowCount} stuck test request(s)`);
        }
      } catch (error) {
        console.error('Failed to cleanup stuck tests:', error);
      }
    };

    // Run cleanup immediately on startup
    await cleanupStuckTests();

    // Schedule cleanup every 10 minutes
    setInterval(cleanupStuckTests, 10 * 60 * 1000);
    console.log('✓ Automatic cleanup of stuck tests scheduled (every 10 minutes)');

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

      // Close database pool
      await closePool();

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
