import { describe, it, expect } from 'vitest';
import { countPracticedInMonth, getMonthGrid, getMonthNavigationBounds, clampMonth, toDateKey } from './calendar';

describe('calendar helpers', () => {
  it('handles leap and non-leap February and all month lengths', () => {
    expect(toDateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
    expect(getMonthGrid(2024, 1).daysInMonth).toBe(29);
    expect(getMonthGrid(2025, 1).daysInMonth).toBe(28);
    expect(getMonthGrid(2026, 3).daysInMonth).toBe(30);
    expect(getMonthGrid(2026, 0).daysInMonth).toBe(31);
  });
  it('returns Sunday-first leading blanks for months starting on each weekday', () => {
    const firstDayOffsets = new Set(Array.from({ length: 12 }, (_, month) => getMonthGrid(2026, month).leadingBlanks));
    expect(firstDayOffsets).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
  });
  it('clamps navigation to the more recent of the practice month and 12-month window', () => {
    const current = { year: 2026, month: 10 };
    expect(getMonthNavigationBounds(current, ['2026-02-02']).earliest).toEqual({ year: 2026, month: 1 });
    expect(getMonthNavigationBounds(current, ['2020-01-01']).earliest).toEqual({ year: 2025, month: 10 });
    expect(clampMonth({ year: 2027, month: 0 }, { year: 2025, month: 10 }, current)).toEqual(current);
  });
  it('counts distinct practiced dates only within the requested month', () => {
    expect(countPracticedInMonth(['2026-11-02', '2026-11-02', '2026-10-31'], 2026, 10)).toBe(1);
  });
});
