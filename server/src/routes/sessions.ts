import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sessionRateLimiter } from '../middleware/rateLimiter';
import { Session } from '../models/Session';
import sampleReportData from '../demo/sampleReport.json';
import { User } from '../models/User';
import { env } from '../config/env';
import { inspectMedia, detectAudioSilence } from '../services/media';
import { analyzeMediaWithGemini, createCreativeRewrite } from '../services/gemini';
import { calculateFluencyIndex } from '../services/fluency';
import { calculateStreak } from '../services/streak';
import { checkAndMarkSavedWordsLearned } from '../services/vocab';
import { buildAnalysisFailureUpdate } from '../services/sessionMedia';

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
  // MIME headers are user-controlled; inspect the actual streams with FFprobe after upload.
  fileFilter: (req, file, cb) => cb(null, true),
});

const createSessionSchema = z.object({
  language: z.enum(['English'], { error: 'Only English is supported right now.' }),
  level: z.string().optional(),
  goal: z.enum(['conversation', 'interview', 'ielts', 'presentation']),
  temperature: z.string().optional(),
});

// POST /api/sessions
router.post('/', authMiddleware, sessionRateLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  let filePath = req.file?.path;

  try {
    const parseResult = createSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const { language, goal, temperature } = parseResult.data;
    const level = parseResult.data.level || 'B1';
    if (!['A1','A2','B1','B2','C1','C2'].includes(level)) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Level ${level} is not valid for ${language}.` });
    }
    let tempNum = 0.7;
    if (temperature !== undefined) {
      const parsed = parseFloat(temperature);
      if (!isNaN(parsed)) {
        tempNum = Math.min(1, Math.max(0, parsed));
      }
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Media file (audio/video) is required' });
    }

    let mimeType: string;
    let mediaType: 'video' | 'audio';
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'The uploaded media file could not be read. Please choose it again.' });
    }
    let durationSec: number;
    try {
      const media = await inspectMedia(filePath);
      durationSec = media.durationSec;
      mediaType = media.mediaType;
      mimeType = media.mimeType;
    } catch (err: any) {
      fs.unlinkSync(filePath);
      filePath = undefined;
      return res.status(400).json({ error: err.message || 'Unable to validate uploaded media.' });
    }
    if (durationSec > env.MAX_CLIP_SECONDS) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Clip duration (${durationSec}s) exceeds maximum allowed limit of ${env.MAX_CLIP_SECONDS}s` });
    }

    const session = await Session.create({
      userId: req.userId,
      language,
      level,
      goal,
      mediaType,
      durationSec,
      status: 'processing',
      mimeType,
      temperature: tempNum,
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
      level,
      goal,
      durationSec,
      temperature: tempNum,
    }).catch((err) => {
      console.error(`[Session Job Error] Session ${session._id}:`, err);
    });
  } catch (err: any) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: env.NODE_ENV === 'development' ? (err.message || 'Failed to create session') : 'Failed to create session.' });
  }
});

// GET /api/sessions (list, newest first)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: env.NODE_ENV === 'development' ? (err.message || 'Failed to fetch sessions') : 'Failed to fetch sessions.' });
  }
});

// GET /api/sessions/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid session id.' });
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.status(200).json(session);
  } catch (err: any) {
    res.status(500).json({ error: env.NODE_ENV === 'development' ? (err.message || 'Failed to fetch session') : 'Failed to fetch session.' });
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
  level: string;
  goal: string;
  durationSec: number;
  temperature?: number;
}) {
  const {
    sessionId,
    userId,
    filePath,
    mimeType,
    mediaType,
    language,
    level,
    goal,
    durationSec,
    temperature = 0.7,
  } = opts;

  try {
    let report: any;
    let interactionId: string | undefined = undefined;
    let totalSilenceSec = 3.5;

    if (env.DEMO_MODE) {
      // Keep the existing upload/session/polling lifecycle while bypassing FFmpeg and Gemini.
      report = JSON.parse(JSON.stringify(sampleReportData));
    } else {
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('Original recording is no longer available on the server. Please upload the clip again.');
      }

      console.log(`[Background Job] Processing session ${sessionId} with real media pipeline (temperature=${temperature})...`);

      // 1. Run FFmpeg silence detection
      const silenceRes = await detectAudioSilence(filePath);
      totalSilenceSec = silenceRes.totalSilenceSec;

      // 2. Call Gemini API
      const geminiRes = await analyzeMediaWithGemini({
        filePath,
        mimeType,
        targetLanguage: language,
      level,
        goal,
        mediaType,
        temperature,
      });

    report = geminiRes.report;
    try { report.improvements.creative_rewrite = await createCreativeRewrite({ transcript: report.transcript, language, level, tone: report.improvements.tone.label, temperature }); } catch (error) { console.error('[Creative Rewrite] Failed:', error); report.improvements.creative_rewrite = null; }
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

    // 5. Update the user's practice streak
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
      $set: {
        originalTranscript: report.transcript,
        status: 'done',
        report,
        fluency,
        interactionId,
        temperature,
      },
      $unset: { errorMessage: 1 },
    });

    console.log(`[Background Job] Session ${sessionId} successfully processed and marked DONE!`);
  } catch (err: any) {
    console.error(`[Background Job Error] Session ${sessionId} failed:`, err);
    const message = env.NODE_ENV === 'development' ? err.message : 'Media analysis failed. Please try again.';
    await Session.findByIdAndUpdate(sessionId, buildAnalysisFailureUpdate(message));
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { console.warn('[Uploads] Could not remove a processed temporary file.'); }
    }
  }
}

export default router;
