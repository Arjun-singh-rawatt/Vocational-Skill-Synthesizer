import { describe, it, expect } from 'vitest';
import { calculateFluencyIndex } from '../services/fluency';

describe('language-specific fluency', () => {
  it('measures Japanese pace by characters and detects Japanese fillers', () => {
    const result = calculateFluencyIndex({ transcript: '今日はえっと学校へ行きました。'.repeat(20), durationSec: 60, totalSilenceSec: 4, geminiFillers: [], language: 'Japanese' });
    expect(result.wpm).toBeGreaterThan(180);
    expect(result.fillersPer100).toBeGreaterThan(0);
  });
  it('preserves English word-per-minute scoring', () => {
    const result = calculateFluencyIndex({ transcript: Array(120).fill('hello').join(' '), durationSec: 60, totalSilenceSec: 4, geminiFillers: [], language: 'English' });
    expect(result.wpm).toBe(120);
  });
});
