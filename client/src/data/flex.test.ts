import { describe, expect, it } from 'vitest';
import { FLEX_STOPS, flexLevelForStop, flexStopForLevel, normalizeFlexLevel } from './flex';

describe('Flex stops', () => {
  it('maps all five stops to their stored levels', () => {
    expect(FLEX_STOPS.map((stop) => flexLevelForStop(stop.index))).toEqual(['A2', 'B1', 'B2', 'C1', 'C2']);
    expect(['A2', 'B1', 'B2', 'C1', 'C2'].map(flexStopForLevel)).toEqual([0, 1, 2, 3, 4]);
  });

  it('treats an existing A1 level as the Simple stop and normalizes it to A2', () => {
    expect(flexStopForLevel('A1')).toBe(0);
    expect(normalizeFlexLevel('A1')).toBe('A2');
  });
});
