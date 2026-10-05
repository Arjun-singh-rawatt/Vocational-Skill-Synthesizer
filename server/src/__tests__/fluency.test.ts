import { describe, it, expect } from 'vitest';
import { calculateFluencyIndex, calculateWordCount } from '../services/fluency';

describe('Fluency Calculation Service', () => {
  it('correctly calculates word count for space-separated languages', () => {
    const text = 'Hello world, this is a test transcript for fluency index.';
    const count = calculateWordCount(text, 'English');
    expect(count).toBe(10);
  });

  it('correctly calculates word count approximation for non-space languages', () => {
    const text = '你好世界这是一个测试'; // 10 characters
    const count = calculateWordCount(text, 'Chinese');
    expect(count).toBe(5); // 10 / 2 = 5
  });

  it('calculates perfect 100 fluency score for optimal metrics', () => {
    // 135 WPM (optimal 110-160)
    // 135 words in 60s
    // 6s silence -> 0.10 pauseRatio (optimal <= 0.15)
    // 1 filler in 135 words -> 0.74 fillersPer100 (optimal <= 2.0)
    const result = calculateFluencyIndex({
      transcript: Array(135).fill('hello').join(' '),
      durationSec: 60,
      totalSilenceSec: 6,
      geminiFillers: ['um'],
      language: 'English',
    });

    expect(result.wpm).toBe(135);
    expect(result.paceScore).toBe(100);
    expect(result.pauseScore).toBe(100);
    expect(result.fillerScore).toBe(100);
    expect(result.index).toBe(100);
  });

  it('penalizes slow pace, long pauses, and heavy filler usage', () => {
    // 30 WPM (too slow)
    // 30s silence out of 60s -> 0.50 pauseRatio (very high)
    // 10 fillers in 30 words -> 33.3 fillersPer100
    const result = calculateFluencyIndex({
      transcript: 'um uh like basically actually hello world um uh like basically',
      durationSec: 60,
      totalSilenceSec: 30,
      geminiFillers: ['um', 'uh', 'like', 'basically', 'actually'],
      language: 'English',
    });

    expect(result.paceScore).toBeLessThan(50);
    expect(result.pauseScore).toBe(0);
    expect(result.fillerScore).toBe(0);
    expect(result.index).toBeLessThan(30);
  });
});
