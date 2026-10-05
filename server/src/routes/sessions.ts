import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sessionRateLimiter } from '../app';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { env } from '../config/env';
import { getMediaDuration, detectAudioSilence } from '../services/media';
import { analyzeMediaWithGemini, askGeminiFollowUp } from '../services/gemini';
import { calculateFluencyIndex } from '../services/fluency';
import { calculateStreak } from '../services/streak';
import { checkAndMarkSavedWordsLearned } from '../services/vocab';
import sampleReportData from '../demo/sampleReport.json';

const router = Router();

// Configure Multer for local temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `clip-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'video/webm',
      'video/mp4',
      'audio/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/ogg',
      'audio/mp3',
    ];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed audio/video formats only.`));
    }
  },
});

const createSessionSchema = z.object({
  language: z.string().min(1, 'Target language is required'),
  goal: z.enum(['conversation', 'interview', 'ielts', 'presentation']),
  isDemo: z.string().optional(),
});

// POST /api/sessions
router.post('/', authMiddleware, sessionRateLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  let filePath = req.file?.path;

  try {
    const parseResult = createSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { language, goal, isDemo } = parseResult.data;
    const forceDemo = isDemo === 'true' || env.DEMO_MODE;

    if (!req.file && !forceDemo) {
      return res.status(400).json({ error: 'Media file (audio/video) is required' });
    }

    let mimeType = req.file?.mimetype || 'audio/webm';
    let mediaType: 'video' | 'audio' = mimeType.startsWith('video/') ? 'video' : 'audio';
    let durationSec = 60;

    if (filePath && fs.existsSync(filePath)) {
      durationSec = await getMediaDuration(filePath);
      if (durationSec > env.MAX_CLIP_SECONDS) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: `Clip duration (${durationSec}s) exceeds maximum allowed limit of ${env.MAX_CLIP_SECONDS}s` });
      }
    }

    const session = await Session.create({
      userId: req.userId,
      language,
      goal,
      mediaType,
      durationSec,
      status: 'processing',
      chat: [],
    });

    // Return HTTP 201 immediately (do not block client)
    res.status(201).json({
      id: session._id.toString(),
      status: 'processing',
      mediaType,
      durationSec,
    });

    // Trigger background processing asynchronously
    processSessionAsync({
      sessionId: session._id.toString(),
      userId: req.userId!,
      filePath,
      mimeType,
      mediaType,
      language,
      goal,
      durationSec,
      forceDemo,
    }).catch((err) => {
      console.error(`[Session Job Error] Session ${session._id}:`, err);
    });
  } catch (err: any) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err.message || 'Failed to create session' });
  }
});

// GET /api/sessions (list, newest first)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.status(200).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch session' });
  }
});

const askSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
});

// POST /api/sessions/:id/ask
router.post('/:id/ask', authMiddleware, sessionRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = askSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { question } = parseResult.data;

    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'done') {
      return res.status(400).json({ error: 'Session report is not yet ready for follow-up questions' });
    }

    const transcript = session.report?.transcript || '';
    const reportSummary = session.report?.overall_summary || session.report?.plan?.summary || '';

    let answer = '';
    let isFallback = false;

    if (env.DEMO_MODE) {
      answer = `[Demo Mode] In your recording at 00:12, you spoke with good clarity, though reducing vocalized pauses ('you know') will make your delivery sound more authoritative.`;
      isFallback = false;
    } else {
      const chatRes = await askGeminiFollowUp({
        interactionId: session.interactionId,
        question,
        transcript,
        reportSummary,
      });
      answer = chatRes.answer;
      isFallback = chatRes.isFallback;
    }

    const userMsg = { role: 'user' as const, text: question, createdAt: new Date() };
    const modelMsg = { role: 'model' as const, text: answer, createdAt: new Date() };

    session.chat.push(userMsg, modelMsg);
    await session.save();

    res.status(200).json({
      answer,
      isFallback,
      chat: session.chat,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process follow-up question' });
  }
});

/**
 * Background Asynchronous Pipeline Job
 */
async function processSessionAsync(opts: {
  sessionId: string;
  userId: string;
  filePath?: string;
  mimeType: string;
  mediaType: 'video' | 'audio';
  language: string;
  goal: string;
  durationSec: number;
  forceDemo: boolean;
}) {
  const { sessionId, userId, filePath, mimeType, mediaType, language, goal, durationSec, forceDemo } = opts;

  try {
    let report: any;
    let interactionId: string | undefined = undefined;
    let totalSilenceSec = 3.5;

    if (forceDemo || !filePath || !fs.existsSync(filePath)) {
      console.log(`[Background Job] Processing session ${sessionId} in DEMO_MODE`);
      // Simulate 3-second processing delay for demo mode UX
      await new Promise((r) => setTimeout(r, 3000));
      report = sampleReportData;
    } else {
      console.log(`[Background Job] Processing session ${sessionId} with real media pipeline...`);

      // 1. Run FFmpeg silence detection
      const silenceRes = await detectAudioSilence(filePath);
      totalSilenceSec = silenceRes.totalSilenceSec;

      // 2. Call Gemini API
      const geminiRes = await analyzeMediaWithGemini({
        filePath,
        mimeType,
        targetLanguage: language,
        goal,
        mediaType,
      });

      report = geminiRes.report;
      interactionId = geminiRes.interactionId;
    }

    // 3. Calculate Fluency Index
    const fluency = calculateFluencyIndex({
      transcript: report.transcript,
      durationSec,
      totalSilenceSec,
      geminiFillers: report.filler_words_detected || [],
      language,
    });

    // 4. Auto-mark user saved words as learned if present in transcript
    await checkAndMarkSavedWordsLearned({
      userId,
      transcript: report.transcript,
      language,
    });

    // 5. Update user streak
    const user = await User.findById(userId);
    if (user) {
      const streakRes = calculateStreak({
        lastPracticeDate: user.lastPracticeDate,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        now: new Date(),
        timezone: user.timezone || 'UTC',
      });
      user.currentStreak = streakRes.currentStreak;
      user.longestStreak = streakRes.longestStreak;
      user.lastPracticeDate = streakRes.lastPracticeDate;
      await user.save();
    }

    // 6. Save Session as "done"
    await Session.findByIdAndUpdate(sessionId, {
      status: 'done',
      report,
      fluency,
      interactionId,
    });

    console.log(`[Background Job] Session ${sessionId} successfully processed and marked DONE!`);
  } catch (err: any) {
    console.error(`[Background Job Error] Session ${sessionId} failed:`, err);
    await Session.findByIdAndUpdate(sessionId, {
      status: 'failed',
      errorMessage: err.message || 'Media analysis failed. Please try again.',
    });
  } finally {
    // 7. ALWAYS delete the local temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[Background Job] Cleaned up temporary upload file: ${filePath}`);
      } catch (e) {
        console.warn(`[Background Job] Failed to delete temp file ${filePath}:`, e);
      }
    }
  }
}

export default router;
