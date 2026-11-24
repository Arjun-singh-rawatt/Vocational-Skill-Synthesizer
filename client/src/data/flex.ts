export const FLEX_STOPS = [
  { index: 0, label: 'Simple', level: 'A2' },
  { index: 1, label: 'Everyday', level: 'B1' },
  { index: 2, label: 'Confident', level: 'B2' },
  { index: 3, label: 'Polished', level: 'C1' },
  { index: 4, label: 'Sophisticated', level: 'C2' },
] as const;

export function flexStopForLevel(level: string | null | undefined): number {
  if (level === 'A1') return 0;
  const stop = FLEX_STOPS.find((option) => option.level === level);
  return stop?.index ?? 1;
}

export function flexLevelForStop(index: number): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.min(FLEX_STOPS.length - 1, Math.round(index))) : 1;
  return FLEX_STOPS[safeIndex].level;
}

export function normalizeFlexLevel(level: string | null | undefined): string {
  return flexLevelForStop(flexStopForLevel(level));
}
