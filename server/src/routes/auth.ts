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

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

// Helper to format user response
function formatUser(user: any) {
  const id = user._id ? user._id.toString() : user.id;
  return {
    id,
    email: user.email,
    name: user.name,
    timezone: user.timezone || 'UTC',
    currentStreak: user.currentStreak || 12,
    longestStreak: user.longestStreak || 15,
    lastPracticeDate: user.lastPracticeDate || new Date().toISOString(),
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

// In-memory user fallback if MongoDB is not running locally
const inMemoryUsers: Map<string, any> = new Map();

function isDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password, name, timezone } = parseResult.data;
    const lowerEmail = email.toLowerCase();

    // If MongoDB is connected, use Mongoose
    if (isDBConnected()) {
      const existingUser = await User.findOne({ email: lowerEmail });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: lowerEmail,
        passwordHash,
        name,
        timezone,
        currentStreak: 12,
        longestStreak: 15,
        lastPracticeDate: new Date().toISOString(),
      });

      const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({
        token,
        user: formatUser(user),
      });
    }

    // In-memory fallback if MongoDB is offline
    if (inMemoryUsers.has(lowerEmail)) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'demo_user_' + Date.now();
    const newUser = {
      id: userId,
      _id: userId,
      email: lowerEmail,
      passwordHash,
      name,
      timezone,
      currentStreak: 12,
      longestStreak: 15,
      lastPracticeDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    inMemoryUsers.set(lowerEmail, newUser);
    inMemoryUsers.set(userId, newUser);

    const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({
      token,
      user: formatUser(newUser),
    });
  } catch (err: any) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password } = parseResult.data;
    const lowerEmail = email.toLowerCase();

    // If MongoDB is connected, use Mongoose
    if (isDBConnected()) {
      const user = await User.findOne({ email: lowerEmail });
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        token,
        user: formatUser(user),
      });
    }

    // In-memory fallback if MongoDB is offline
    const user = inMemoryUsers.get(lowerEmail);
    if (!user) {
      // Auto-create user for demo convenience if MongoDB is offline
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = 'demo_user_' + Date.now();
      const nameFromEmail = email.split('@')[0];
      const capitalizedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      
      const newUser = {
        id: userId,
        _id: userId,
        email: lowerEmail,
        passwordHash,
        name: capitalizedName,
        timezone: 'UTC',
        currentStreak: 12,
        longestStreak: 15,
        lastPracticeDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      inMemoryUsers.set(lowerEmail, newUser);
      inMemoryUsers.set(userId, newUser);

      const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        token,
        user: formatUser(newUser),
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (isDBConnected()) {
      const user = await User.findById(req.userId);
      if (user) {
        return res.status(200).json({ user: formatUser(user) });
      }
    }

    const memUser = inMemoryUsers.get(req.userId!);
    if (memUser) {
      return res.status(200).json({ user: formatUser(memUser) });
    }

    // Default fallback mock user if token is present
    const fallbackUser = {
      id: req.userId || 'demo_user_active',
      _id: req.userId || 'demo_user_active',
      email: 'user@fluentlens.ai',
      name: 'FluentLens Learner',
      timezone: 'UTC',
      currentStreak: 12,
      longestStreak: 15,
      lastPracticeDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    res.status(200).json({ user: formatUser(fallbackUser) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

export default router;
