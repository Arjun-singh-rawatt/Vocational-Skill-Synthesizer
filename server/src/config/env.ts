import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value.trim().toLowerCase() === 'true') return true;
  if (value.trim().toLowerCase() === 'false') return false;
  throw new Error(`${name} must be either "true" or "false".`);
}

function parsePositiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

export const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  CLIENT_URLS: (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean),
  DEMO_MODE: parseBoolean('DEMO_MODE', process.env.DEMO_MODE, false),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parsePositiveInteger('PORT', process.env.PORT, 8080),
  MAX_UPLOAD_MB: Math.min(parsePositiveInteger('MAX_UPLOAD_MB', process.env.MAX_UPLOAD_MB, 50), 50),
  MAX_CLIP_SECONDS: Math.min(parsePositiveInteger('MAX_CLIP_SECONDS', process.env.MAX_CLIP_SECONDS, 180), 180),
};

export function validateEnvironment(): void {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required.');
  if (!env.DEMO_MODE && !env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required when DEMO_MODE is false.');
}
