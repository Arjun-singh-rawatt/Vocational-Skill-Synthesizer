export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthGrid(year: number, month: number): { leadingBlanks: number; daysInMonth: number } {
  const normalized = new Date(year, month, 1);
  return { leadingBlanks: normalized.getDay(), daysInMonth: new Date(year, month + 1, 0).getDate() };
}

export function practicedSet(practiceDates: string[]): Set<string> {
  return new Set(practiceDates);
}

export function countPracticedInMonth(practiceDates: string[], year: number, month: number): number {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  return practicedSet(practiceDates.filter((date) => date.startsWith(prefix))).size;
}

export type YearMonth = { year: number; month: number };
export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function clampMonth(month: YearMonth, earliest: YearMonth, current: YearMonth): YearMonth {
  if (compareMonths(month, earliest) < 0) return { ...earliest };
  if (compareMonths(month, current) > 0) return { ...current };
  return { ...month };
}

export function getMonthNavigationBounds(current: YearMonth, practiceDates: string[]): { earliest: YearMonth; latest: YearMonth } {
  const limitDate = new Date(current.year, current.month - 12, 1);
  const twelveMonthLimit = { year: limitDate.getFullYear(), month: limitDate.getMonth() };
  const earliestPractice = practiceDates.length
    ? practiceDates.map((key) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 })).sort(compareMonths)[0]
    : twelveMonthLimit;
  const earliest = compareMonths(earliestPractice, twelveMonthLimit) > 0 ? earliestPractice : twelveMonthLimit;
  return { earliest, latest: { ...current } };
}

export function monthFromTimezone(date: Date, timezone?: string): YearMonth {
  if (!timezone) return { year: date.getFullYear(), month: date.getMonth() };
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric' }).formatToParts(date);
    return { year: Number(parts.find((part) => part.type === 'year')?.value), month: Number(parts.find((part) => part.type === 'month')?.value) - 1 };
  } catch {
    return { year: date.getFullYear(), month: date.getMonth() };
  }
}

export function dateKeyFromTimezone(date: Date, timezone?: string): string {
  if (!timezone) return toDateKey(date);
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } catch {
    return toDateKey(date);
  }
}
