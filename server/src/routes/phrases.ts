import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { SavedPhrase } from '../models/SavedPhrase';

const router = Router();
const createPhraseSchema = z.object({
  phrase: z.string().trim().min(1, 'Phrase is required'),
  context: z.string().optional(),
  authorOrSpeaker: z.string().optional(),
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const phrases = await SavedPhrase.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(phrases);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch saved phrases' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = createPhraseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { phrase, context, authorOrSpeaker } = parsed.data;
  try {
    const saved = await SavedPhrase.findOneAndUpdate(
      { userId: req.userId, phrase: phrase.trim() },
      { $setOnInsert: { userId: req.userId, phrase: phrase.trim(), ...(context ? { context } : {}), ...(authorOrSpeaker ? { authorOrSpeaker } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save phrase' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await SavedPhrase.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: 'Saved phrase not found' });
    res.status(200).json({ message: 'Saved phrase deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete phrase' });
  }
});

export default router;
