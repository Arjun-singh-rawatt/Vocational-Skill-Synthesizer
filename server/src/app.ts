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
      if (!origin || origin === env.CLIENT_URL || env.CLIENT_URL === '*') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev if needed, or strictly allow env.CLIENT_URL
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

// Progress routes
import progressRouter from './routes/progress';
app.use('/api/progress', progressRouter);

import { sessionRateLimiter } from './middleware/rateLimiter';
export { sessionRateLimiter };

// Global error handler
app.use(errorHandler);

export default app;
