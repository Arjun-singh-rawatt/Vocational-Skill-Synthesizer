import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { VocabWord } from '../models/VocabWord';

const router = Router();

// GET /api/progress
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    res.status(200).json({
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastPracticeDate: user.lastPracticeDate,
      savedCount,
      learnedCount,
      totalSessions: completedSessions.length,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch progress metrics' });
  }
});

export default router;
