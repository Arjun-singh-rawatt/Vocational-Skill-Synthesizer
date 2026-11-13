import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PracticeCalendar } from './PracticeCalendar';
import { toDateKey } from '../lib/calendar';

describe('PracticeCalendar', () => {
  it('renders practiced days in emerald, rings today, uses singular count, and has no amber colors', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    const today = new Date();
    const practiced = new Date(today.getFullYear(), today.getMonth(), 14);
    const html = renderToStaticMarkup(<PracticeCalendar practiceDates={[toDateKey(practiced)]} />);
    expect(html).toContain('1 active day');
    expect(html).toContain('aria-label="14 November, practiced"');
    expect(html).toContain('bg-emerald-600');
    expect(html).toContain('border border-emerald-600');
    expect(html).toContain('Practiced day');
    expect(html).not.toMatch(/amber|yellow|bg-red/);
    expect(html).toContain('aria-label="Next month" disabled=""');
    vi.useRealTimers();
  });
});
