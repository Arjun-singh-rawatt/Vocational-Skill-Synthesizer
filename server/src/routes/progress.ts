import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { VocabWord } from '../models/VocabWord';

const router = Router();

// GET /api/progress
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Progress is unavailable because the database is disconnected. Please try again later.' });
    }
    {
      const user = await User.findById(req.userId);
      const savedCount = await VocabWord.countDocuments({ userId: req.userId, status: 'saved' });
      const learnedCount = await VocabWord.countDocuments({ userId: req.userId, status: 'learned' });
      const completedSessions = await Session.find({ userId: req.userId, status: 'done' }).sort({ createdAt: 1 });

      const history = completedSessions.map((s) => ({
        id: s._id.toString(),
        createdAt: s.createdAt,
        language: s.language,
        goal: s.goal,
        fluencyIndex: s.fluency?.index || 0,
        wpm: s.fluency?.wpm || 0,
        scores: s.report?.scores || {
          vocabulary: 0,
          grammar: 0,
          delivery: 0,
          clarity: 0,
          body_language: null,
        },
      }));

      return res.status(200).json({
        currentStreak: user?.currentStreak ?? 0,
        longestStreak: user?.longestStreak ?? 0,
        lastPracticeDate: user?.lastPracticeDate ?? null,
        savedCount,
        learnedCount,
        totalSessions: completedSessions.length,
        history,
      });
    }

  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch progress' });
  }
});

export default router;
