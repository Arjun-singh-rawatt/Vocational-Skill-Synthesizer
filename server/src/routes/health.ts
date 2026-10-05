import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';

const router = Router();

router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    demoMode: env.DEMO_MODE,
    database: dbStatus,
    version: '1.0.0',
  });
});

export default router;
