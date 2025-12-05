import express, { Express } from 'express';
import { join } from 'path';
import screenshotService from '../../automation/ScreenshotService.js';

const screenshotDir = process.env.SCREENSHOT_DIR || '/tmp/screenshots';

// Configure static file serving for screenshots
export function setupStaticFiles(app: Express): void {
  // Serve screenshots from /screenshots route
  app.use('/screenshots', express.static(screenshotDir, {
    maxAge: '7d', // Cache screenshots for 7 days
    etag: true,
    lastModified: true,
  }));

  console.log(`✓ Static file serving configured: /screenshots -> ${screenshotDir}`);

  // Schedule cleanup job to run daily
  scheduleScreenshotCleanup();
}

// Schedule daily cleanup of old screenshots
function scheduleScreenshotCleanup(): void {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const DAYS_TO_KEEP = 7;

  // Run cleanup immediately on startup
  screenshotService.cleanupOldScreenshots(DAYS_TO_KEEP)
    .then(() => console.log('✓ Initial screenshot cleanup completed'))
    .catch(err => console.error('Screenshot cleanup error:', err));

  // Schedule recurring cleanup
  setInterval(() => {
    screenshotService.cleanupOldScreenshots(DAYS_TO_KEEP)
      .then(() => console.log('✓ Scheduled screenshot cleanup completed'))
      .catch(err => console.error('Screenshot cleanup error:', err));
  }, CLEANUP_INTERVAL);

  console.log(`✓ Screenshot cleanup scheduled (every 24h, keeping ${DAYS_TO_KEEP} days)`);
}
