import rateLimit from 'express-rate-limit';

export const sessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Too many session requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reevaluateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req: any) => req.userId || req.ip,
  message: { error: 'Too many re-evaluations. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
