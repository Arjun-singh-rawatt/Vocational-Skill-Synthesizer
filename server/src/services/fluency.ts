export interface FluencyMetrics {
  wpm: number;
  pauseRatio: number;
  fillersPer100: number;
  paceScore: number;
  pauseScore: number;
  fillerScore: number;
  index: number;
}

const NO_SPACE_LANGUAGES = ['chinese', 'mandarin', 'japanese', 'thai', 'zh', 'ja', 'th'];

export function calculateWordCount(transcript: string, language: string): number {
  const cleanText = transcript.trim();
  if (!cleanText) return 0;

  const langLower = language.toLowerCase();
  const isNoSpaceLang = NO_SPACE_LANGUAGES.some((l) => langLower.includes(l));

  if (isNoSpaceLang) {
    // For non-space languages, use characters / 2 as approximation
    return Math.ceil(cleanText.replace(/\s+/g, '').length / 2);
  }

  // Standard whitespace split for space-separated languages
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

export function calculateFluencyIndex(options: {
  transcript: string;
  durationSec: number;
  totalSilenceSec: number;
  geminiFillers: string[];
  language: string;
}): FluencyMetrics {
  const durationSec = Math.max(options.durationSec, 1); // avoid div by 0
  const wordCount = calculateWordCount(options.transcript, options.language);
  const durationMin = durationSec / 60;

  // 1. WPM & Pace Score
  const wpm = Math.round(wordCount / durationMin);
  let paceScore = 100;
  if (wpm >= 110 && wpm <= 160) {
    paceScore = 100;
  } else if (wpm < 110) {
    paceScore = Math.max(0, Math.round((100 * (wpm - 40)) / (110 - 40)));
  } else {
    paceScore = Math.max(0, Math.round((100 * (240 - wpm)) / (240 - 160)));
  }

  // 2. Pause Ratio & Pause Score
  const pauseRatio = Number((options.totalSilenceSec / durationSec).toFixed(3));
  let pauseScore = 100;
  if (pauseRatio <= 0.15) {
    pauseScore = 100;
  } else {
    pauseScore = Math.max(0, Math.round((100 * (0.45 - pauseRatio)) / (0.45 - 0.15)));
  }

  // 3. Fillers per 100 words & Filler Score
  const defaultEnglishFillers = ['um', 'uh', 'er', 'like', 'you know', 'i mean', 'basically', 'actually'];
  const allFillers = Array.from(new Set([...options.geminiFillers, ...defaultEnglishFillers]));

  let fillerCount = 0;
  const lowerTranscript = options.transcript.toLowerCase();
  for (const filler of allFillers) {
    if (!filler) continue;
    const regex = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerTranscript.match(regex);
    if (matches) {
      fillerCount += matches.length;
    }
  }

  const safeWordCount = Math.max(wordCount, 1);
  const fillersPer100 = Number(((fillerCount / safeWordCount) * 100).toFixed(1));
  let fillerScore = 100;
  if (fillersPer100 <= 2) {
    fillerScore = 100;
  } else {
    fillerScore = Math.max(0, Math.round((100 * (12 - fillersPer100)) / (12 - 2)));
  }

  // 4. Deterministic Index = round(0.4*paceScore + 0.3*pauseScore + 0.3*fillerScore)
  const index = Math.round(0.4 * paceScore + 0.3 * pauseScore + 0.3 * fillerScore);

  return {
    wpm,
    pauseRatio,
    fillersPer100,
    paceScore,
    pauseScore,
    fillerScore,
    index,
  };
}
