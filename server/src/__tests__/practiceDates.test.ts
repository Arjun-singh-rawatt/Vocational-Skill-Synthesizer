import { describe, it, expect } from 'vitest';
import { getPracticeDates } from '../services/practiceDates';

describe('practice dates', () => {
  it('uses the user timezone, includes only distinct completed dates in ascending order', () => {
    const dates = getPracticeDates([
      { status: 'done', createdAt: new Date('2026-11-01T23:30:00Z') },
      { status: 'done', createdAt: new Date('2026-11-02T02:00:00Z') },
      { status: 'processing', createdAt: new Date('2026-11-03T12:00:00Z') },
      { status: 'failed', createdAt: new Date('2026-11-04T12:00:00Z') },
    ], 'Asia/Kolkata', new Date('2026-11-08T10:00:00Z'));
    expect(dates).toEqual(['2026-11-02']);
  });

  it('returns no practice dates for an account with no completed sessions', () => {
    expect(getPracticeDates([], 'UTC', new Date('2026-11-08T12:00:00Z'))).toEqual([]);
  });

  it('limits the list to the most recent 400 local calendar dates', () => {
    const dates = getPracticeDates([
      { status: 'done', createdAt: new Date('2025-10-01T12:00:00Z') },
      { status: 'done', createdAt: new Date('2025-10-05T12:00:00Z') },
      { status: 'done', createdAt: new Date('2026-11-09T12:00:00Z') },
    ], 'UTC', new Date('2026-11-08T12:00:00Z'));
    expect(dates).toEqual(['2025-10-05']);
  });
});
