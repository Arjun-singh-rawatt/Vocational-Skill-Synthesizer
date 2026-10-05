import { describe, it, expect } from 'vitest';
import { calculateStreak, getFormattedDateInTimezone, getYesterdayDateInTimezone } from '../services/streak';

describe('Streak Calculation Pure Function', () => {
  it('increments streak when practiced on consecutive days', () => {
    const now = new Date('2026-10-06T14:00:00Z');
    const timezone = 'UTC';

    const lastPracticeDate = '2026-10-05'; // yesterday in UTC
    const result = calculateStreak({
      lastPracticeDate,
      currentStreak: 3,
      longestStreak: 5,
      now,
      timezone,
    });

    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(5);
    expect(result.lastPracticeDate).toBe('2026-10-06');
  });

  it('keeps streak unchanged if practiced multiple times on the same day', () => {
    const now = new Date('2026-10-06T18:00:00Z');
    const timezone = 'UTC';

    const lastPracticeDate = '2026-10-06'; // already practiced today
    const result = calculateStreak({
      lastPracticeDate,
      currentStreak: 4,
      longestStreak: 5,
      now,
      timezone,
    });

    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(5);
    expect(result.lastPracticeDate).toBe('2026-10-06');
  });

  it('resets streak to 1 if a day was skipped', () => {
    const now = new Date('2026-10-06T14:00:00Z');
    const timezone = 'UTC';

    const lastPracticeDate = '2026-10-04'; // 2 days ago
    const result = calculateStreak({
      lastPracticeDate,
      currentStreak: 10,
      longestStreak: 10,
      now,
      timezone,
    });

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10); // longest remains 10
    expect(result.lastPracticeDate).toBe('2026-10-06');
  });

  it('handles midnight boundary & timezone correctly (e.g. UTC vs Asia/Tokyo)', () => {
    // 2026-10-05T23:30:00Z is 2026-10-06T08:30:00 in Tokyo (+9)
    const midnightBoundaryUtc = new Date('2026-10-05T23:30:00Z');

    const dateInUtc = getFormattedDateInTimezone(midnightBoundaryUtc, 'UTC');
    const dateInTokyo = getFormattedDateInTimezone(midnightBoundaryUtc, 'Asia/Tokyo');

    expect(dateInUtc).toBe('2026-10-05');
    expect(dateInTokyo).toBe('2026-10-06');

    // Test streak in Tokyo timezone
    const resultTokyo = calculateStreak({
      lastPracticeDate: '2026-10-05', // yesterday in Tokyo
      currentStreak: 2,
      longestStreak: 2,
      now: midnightBoundaryUtc,
      timezone: 'Asia/Tokyo',
    });

    expect(resultTokyo.currentStreak).toBe(3);
    expect(resultTokyo.lastPracticeDate).toBe('2026-10-06');
  });
});
