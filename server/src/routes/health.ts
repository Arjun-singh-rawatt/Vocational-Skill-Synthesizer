import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';

const router = Router();

router.get('/health', (req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const status = database === 'connected' ? 'ok' : 'degraded';
  res.status(database === 'connected' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    database,
    demoMode: env.DEMO_MODE,
    version: '1.0.0',
  });
});

export default router;
