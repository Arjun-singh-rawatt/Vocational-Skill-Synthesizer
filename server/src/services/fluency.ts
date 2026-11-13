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
// Japanese pace uses non-whitespace, non-punctuation characters/minute: 180–360 optimal,
// ramps to zero at 60 and 600. Fillers are measured per 100 characters (2 is optimal).
const JAPANESE_PACE_BANDS = { slow: 60, optimalLow: 180, optimalHigh: 360, fast: 600 };

export function calculateWordCount(transcript: string, language: string): number {
  const cleanText = transcript.trim();
  if (!cleanText) return 0;
  const langLower = language.toLowerCase();
  if (NO_SPACE_LANGUAGES.some((l) => langLower.includes(l))) return Math.ceil(cleanText.replace(/\s+/g, '').length / 2);
  return cleanText.split(/\s+/).filter(Boolean).length;
}

export function calculateFluencyIndex(options: {
  transcript: string;
  durationSec: number;
  totalSilenceSec: number;
  geminiFillers: string[];
  language: string;
}): FluencyMetrics {
  const durationSec = Math.max(options.durationSec, 1);
  const japanese = ['japanese', 'ja'].includes(options.language.toLowerCase());
  const japaneseCharacters = Array.from(options.transcript).filter((character) => !/\s|[\p{P}\p{S}]/u.test(character)).length;
  const wordCount = calculateWordCount(options.transcript, options.language);
  const durationMin = durationSec / 60;
  const wpm = Math.round((japanese ? japaneseCharacters : wordCount) / durationMin);
  const bands = japanese ? JAPANESE_PACE_BANDS : { slow: 40, optimalLow: 110, optimalHigh: 160, fast: 240 };
  let paceScore = wpm >= bands.optimalLow && wpm <= bands.optimalHigh ? 100
    : wpm < bands.optimalLow ? Math.max(0, Math.round((100 * (wpm - bands.slow)) / (bands.optimalLow - bands.slow)))
    : Math.max(0, Math.round((100 * (bands.fast - wpm)) / (bands.fast - bands.optimalHigh)));
  const pauseRatio = Number((options.totalSilenceSec / durationSec).toFixed(3));
  const pauseScore = pauseRatio <= 0.15 ? 100 : Math.max(0, Math.round((100 * (0.45 - pauseRatio)) / 0.3));
  const defaultEnglishFillers = ['um', 'uh', 'er', 'like', 'you know', 'i mean', 'basically', 'actually'];
  const japaneseFillers = ['えっと', 'えーと', 'あの', 'あのー', 'まあ', 'その', 'えー', 'なんか'];
  const allFillers = Array.from(new Set([...options.geminiFillers, ...(japanese ? japaneseFillers : defaultEnglishFillers)]));
  let fillerCount = 0;
  const lowerTranscript = options.transcript.toLowerCase();
  for (const filler of allFillers) {
    if (!filler) continue;
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = japanese ? new RegExp(escaped, 'gi') : new RegExp(`\\b${escaped}\\b`, 'gi');
    fillerCount += lowerTranscript.match(regex)?.length || 0;
  }
  const baseCount = japanese ? Math.max(japaneseCharacters / 100, 1) : Math.max(wordCount, 1);
  const fillersPer100 = Number(((fillerCount / baseCount) * 100).toFixed(1));
  const fillerScore = fillersPer100 <= 2 ? 100 : Math.max(0, Math.round((100 * (12 - fillersPer100)) / 10));
  const index = Math.round(0.4 * paceScore + 0.3 * pauseScore + 0.3 * fillerScore);
  return { wpm, pauseRatio, fillersPer100, paceScore, pauseScore, fillerScore, index };
}
