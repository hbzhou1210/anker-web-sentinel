/**
 * Environment loader - must be executed before any other module imports
 * This ensures environment variables are available when singleton services are initialized
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file based on NODE_ENV
// Priority: .env.production (if NODE_ENV=production) > .env (fallback)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
const envPath = resolve(__dirname, '..', envFile);

// Try to load environment-specific file first
const result = dotenv.config({ path: envPath });

// If production env file not found, fallback to .env
if (result.error && nodeEnv === 'production') {
  const fallbackPath = resolve(__dirname, '../.env');
  console.log(`[Loader] ${envFile} not found, falling back to .env`);
  dotenv.config({ path: fallbackPath });
  console.log('[Loader] Environment variables loaded from:', fallbackPath);
} else {
  console.log('[Loader] Environment variables loaded from:', envPath);
}

console.log('[Loader] NODE_ENV:', nodeEnv);
console.log('[Loader] APP_URL:', process.env.APP_URL || 'NOT SET');
console.log('[Loader] FEISHU_APP_ID:', process.env.FEISHU_APP_ID ? 'LOADED' : 'NOT FOUND');
console.log('[Loader] FEISHU_APP_SECRET:', process.env.FEISHU_APP_SECRET ? 'LOADED' : 'NOT FOUND');

// Now import and start the application
await import('./index.js');
