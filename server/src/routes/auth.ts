import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { env } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  timezone: z.string().default('UTC'),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1, 'Password is required') });

function formatUser(user: any) {
  return {
    id: user._id.toString(), email: user.email, name: user.name,
    timezone: user.timezone, currentStreak: user.currentStreak,
    longestStreak: user.longestStreak, lastPracticeDate: user.lastPracticeDate,
    createdAt: user.createdAt,
  };
}
function requireDatabase(res: Response): boolean {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ error: 'Account service is unavailable because the database is disconnected. Please try again later.' });
  return false;
}

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  if (!requireDatabase(res)) return;
  try {
    const { email, password, name, timezone } = parsed.data;
    const lowerEmail = email.toLowerCase();
    if (await User.findOne({ email: lowerEmail })) return res.status(400).json({ error: 'User with this email already exists' });
    const user = await User.create({ email: lowerEmail, passwordHash: await bcrypt.hash(password, 10), name, timezone });
    const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user: formatUser(user) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  if (!requireDatabase(res)) return;
  try {
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(400).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ token, user: formatUser(user) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!requireDatabase(res)) return;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User account was not found.' });
    return res.status(200).json({ user: formatUser(user) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

export default router;
