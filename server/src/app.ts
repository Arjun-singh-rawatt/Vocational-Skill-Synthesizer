import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import healthRouter from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

const app = express();

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching CLIENT_URL
      const allowedOrigins = env.CLIENT_URL.split(',').map((value) => value.trim()).filter(Boolean);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin is not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
import fs from 'fs';
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Health check route
app.use('/api', healthRouter);

// Auth routes
import authRouter from './routes/auth';
app.use('/api/auth', authRouter);

// Session routes
import sessionsRouter from './routes/sessions';
app.use('/api/sessions', sessionsRouter);

// Vocab routes
import vocabRouter from './routes/vocab';
app.use('/api/vocab', vocabRouter);

import phrasesRouter from './routes/phrases';
app.use('/api/phrases', phrasesRouter);

// Progress routes
import progressRouter from './routes/progress';
app.use('/api/progress', progressRouter);

import { sessionRateLimiter } from './middleware/rateLimiter';
export { sessionRateLimiter };

// Global error handler
app.use(errorHandler);

export default app;
