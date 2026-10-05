export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string;
}

/**
 * Get date string YYYY-MM-DD for a given Date in a specific timezone
 */
export function getFormattedDateInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // Output format: YYYY-MM-DD
  } catch (e) {
    // Fallback if timezone string is invalid
    return date.toISOString().split('T')[0];
  }
}

/**
 * Get yesterday's date string YYYY-MM-DD in a specific timezone
 */
export function getYesterdayDateInTimezone(date: Date, timezone: string): string {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getFormattedDateInTimezone(yesterday, timezone);
}

export function calculateStreak(options: {
  lastPracticeDate: string | null;
  currentStreak: number;
  longestStreak: number;
  now: Date;
  timezone: string;
}): StreakResult {
  const todayStr = getFormattedDateInTimezone(options.now, options.timezone);
  const yesterdayStr = getYesterdayDateInTimezone(options.now, options.timezone);

  let newCurrentStreak = options.currentStreak;

  if (options.lastPracticeDate === todayStr) {
    // Already practiced today; no change in streak count
    newCurrentStreak = options.currentStreak > 0 ? options.currentStreak : 1;
  } else if (options.lastPracticeDate === yesterdayStr) {
    // Practiced yesterday; increment streak
    newCurrentStreak = options.currentStreak + 1;
  } else {
    // Practice missed or first session; reset streak to 1
    newCurrentStreak = 1;
  }

  const newLongestStreak = Math.max(options.longestStreak, newCurrentStreak);

  return {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastPracticeDate: todayStr,
  };
}
