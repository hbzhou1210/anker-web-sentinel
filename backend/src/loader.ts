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

// Load .env file from backend directory (one level up from src/)
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

console.log('[Loader] Environment variables loaded from:', envPath);
console.log('[Loader] FEISHU_APP_ID:', process.env.FEISHU_APP_ID ? 'LOADED' : 'NOT FOUND');
console.log('[Loader] FEISHU_APP_SECRET:', process.env.FEISHU_APP_SECRET ? 'LOADED' : 'NOT FOUND');

// Now import and start the application
await import('./index.js');
