/**
 * Environment Configuration Loader
 *
 * This file MUST be imported first in index.ts to ensure environment variables
 * are loaded before any other modules that depend on them.
 */
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Export a confirmation that env vars are loaded
export const ENV_LOADED = true;

// Log critical environment variables for debugging
console.log('[ENV] Environment variables loaded');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV);
console.log('[ENV] DATABASE_STORAGE:', process.env.DATABASE_STORAGE);
console.log('[ENV] WEBPAGETEST_API_KEY:', process.env.WEBPAGETEST_API_KEY ? 'SET' : 'NOT SET');
