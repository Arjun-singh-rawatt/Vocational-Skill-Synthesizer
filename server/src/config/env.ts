import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fluentlens',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_jwt_secret_key_12345',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  PORT: parseInt(process.env.PORT || '8080', 10),
  DEMO_MODE: process.env.DEMO_MODE?.trim().toLowerCase() === 'true',
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB || '100', 10),
  MAX_CLIP_SECONDS: parseInt(process.env.MAX_CLIP_SECONDS || '200', 10),
};
