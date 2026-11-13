import { getFormattedDateInTimezone } from './streak';

export interface PracticeSessionDate {
  status: string;
  createdAt: Date;
}

function subtractCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function getPracticeDates(sessions: PracticeSessionDate[], timezone: string, now = new Date()): string[] {
  const today = getFormattedDateInTimezone(now, timezone);
  const earliest = subtractCalendarDays(today, 399);
  return [...new Set(sessions
    .filter((session) => session.status === 'done')
    .map((session) => getFormattedDateInTimezone(session.createdAt, timezone))
    .filter((date) => date >= earliest && date <= today))].sort();
}
