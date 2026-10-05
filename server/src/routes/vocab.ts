import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { VocabWord } from '../models/VocabWord';

const router = Router();

const createVocabSchema = z.object({
  word: z.string().min(1, 'Word is required'),
  meaning: z.string().min(1, 'Meaning is required'),
  example: z.string().min(1, 'Example sentence is required'),
  language: z.string().min(1, 'Language is required'),
  sourceSessionId: z.string().optional(),
});

// POST /api/vocab (save a word)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = createVocabSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { word, meaning, example, language, sourceSessionId } = parseResult.data;

    // Upsert word to avoid duplicate key errors
    const vocab = await VocabWord.findOneAndUpdate(
      { userId: req.userId, word: word.trim(), language: language.trim() },
      {
        userId: req.userId,
        word: word.trim(),
        meaning,
        example,
        language: language.trim(),
        sourceSessionId: sourceSessionId || undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(vocab);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save vocabulary word' });
  }
});

// GET /api/vocab (filter by status)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const filter: any = { userId: req.userId };
    if (status === 'saved' || status === 'learned') {
      filter.status = status;
    }

    const words = await VocabWord.find(filter).sort({ createdAt: -1 });
    res.status(200).json(words);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch vocabulary words' });
  }
});

// DELETE /api/vocab/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await VocabWord.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!result) {
      return res.status(404).json({ error: 'Vocabulary item not found' });
    }
    res.status(200).json({ message: 'Vocabulary item deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete vocabulary item' });
  }
});

export default router;
