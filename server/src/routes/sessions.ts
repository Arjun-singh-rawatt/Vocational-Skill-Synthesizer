import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { reevaluateRateLimiter, sessionRateLimiter } from '../middleware/rateLimiter';
import { Session } from '../models/Session';
import sampleReportData from '../demo/sampleReport.json';
import { User } from '../models/User';
import { env } from '../config/env';
import { inspectMedia, detectAudioSilence } from '../services/media';
import { analyzeMediaWithGemini, createCreativeRewrite, reimproveFromTranscript } from '../services/gemini';
import { calculateFluencyIndex } from '../services/fluency';
import { calculateStreak } from '../services/streak';
import { checkAndMarkSavedWordsLearned } from '../services/vocab';
import {
  buildAnalysisFailureUpdate,
} from '../services/sessionMedia';

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
      isReevaluating: false,
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

const reevaluateSchema = z.object({ transcript: z.string().trim().min(1).max(8000).optional(), level: z.string().optional(), temperature: z.number().min(0).max(1).optional() });
router.post('/:id/reevaluate', authMiddleware, reevaluateRateLimiter, async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid session id.' });
  const parsed = reevaluateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'processing' || session.isReevaluating) return res.status(409).json({ error: 'Evaluation already in progress' });
    if (session.status !== 'done' || !session.report) return res.status(400).json({ error: 'Session report is not ready.' });
    const transcript = parsed.data.transcript ?? session.report.transcript;
    const level = parsed.data.level ?? session.level;
    const levels = ['A1','A2','B1','B2','C1','C2'];
    if (!levels.includes(level)) return res.status(400).json({ error: 'Level is not valid for English.' });
    const temperature = parsed.data.temperature ?? session.temperature ?? 0.7;
    const locked = await Session.findOneAndUpdate({ _id: session._id, status: 'done', isReevaluating: { $ne: true } }, { $set: { isReevaluating: true, status: 'processing', temperature, level }, $unset: { errorMessage: 1 } }, { new: true });
    if (!locked) return res.status(409).json({ error: 'Evaluation already in progress' });
    res.status(202).json({ id: session._id.toString(), status: 'evaluating' });
    void (async () => { try {
      const tone = session.report!.improvements.tone;
      const improved = await reimproveFromTranscript({ transcript, language: session.language, level, goal: session.goal, tone });
      let creative = null;
      try { creative = await createCreativeRewrite({ transcript, language: session.language, level, tone: tone.label, temperature }); } catch (error) { console.error('[Creative Rewrite] Failed:', error); }
      const oldReport: any = { ...session.report! };
      const report = { ...oldReport, transcript, improved_transcript: improved.improved_transcript, improvements: { ...oldReport.improvements, ...improved.improvements, tone, creative_rewrite: creative } };
      const fluency = calculateFluencyIndex({ transcript, durationSec: session.durationSec, totalSilenceSec: session.durationSec * (session.fluency?.pauseRatio || 0), geminiFillers: report.filler_words_detected || [], language: session.language });
      await Session.findByIdAndUpdate(session._id, { $set: { report, fluency, level, temperature, status: 'done', isReevaluating: false }, $unset: { errorMessage: 1 } });
    } catch (error: any) { await Session.findByIdAndUpdate(session._id, { $set: { status: 'done', isReevaluating: false, errorMessage: env.NODE_ENV === 'development' ? (error.message || 'Re-evaluation failed') : 'Re-evaluation failed.' } }); } })();
  } catch (error: any) { res.status(500).json({ error: env.NODE_ENV === 'development' ? (error.message || 'Failed to re-evaluate session') : 'Failed to re-evaluate session.' }); }
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
  mode?: 'initial' | 'reevaluate';
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
    mode = 'initial',
  } = opts;
  const isReevaluate = mode === 'reevaluate';

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

    // 5. Update user streak only on the first analysis of a clip
    if (!isReevaluate) {
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
    }

    // 6. Save Session as "done" (keep original local media for later re-evaluation)
    await Session.findByIdAndUpdate(sessionId, {
      $set: {
        ...(isReevaluate ? {} : { originalTranscript: report.transcript }),
        status: 'done',
        report,
        fluency,
        interactionId,
        temperature,
        isReevaluating: false,
      },
      $unset: { errorMessage: 1 },
    });

    console.log(`[Background Job] Session ${sessionId} successfully processed and marked DONE!`);
  } catch (err: any) {
    console.error(`[Background Job Error] Session ${sessionId} failed:`, err);
    const message = env.NODE_ENV === 'development' ? err.message : 'Media analysis failed. Please try again.';
    await Session.findByIdAndUpdate(sessionId, buildAnalysisFailureUpdate(isReevaluate, message));
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { console.warn('[Uploads] Could not remove a processed temporary file.'); }
    }
  }
}

export default router;
