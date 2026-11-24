import { describe, expect, it } from 'vitest';
import { isValidMediaDuration, resolveMediaDuration } from './mediaValidation';

describe('media duration validation', () => {
  it('accepts clips below the 180-second limit', () => {
    expect(isValidMediaDuration(154)).toBe(true);
  });

  it('accepts a clip exactly at 180 seconds', () => {
    expect(isValidMediaDuration(180)).toBe(true);
  });

  it('rejects clips above 180 seconds without rounding them down', () => {
    expect(isValidMediaDuration(180.001)).toBe(false);
  });

  it('uses the recorder timer when WebM metadata has no finite duration', () => {
    expect(resolveMediaDuration(Infinity, 154)).toBe(154);
    expect(isValidMediaDuration(resolveMediaDuration(Infinity, 154))).toBe(true);
  });

  it('prefers finite media metadata so durations above the limit remain rejected', () => {
    expect(resolveMediaDuration(180.25, 180)).toBe(180.25);
    expect(isValidMediaDuration(resolveMediaDuration(180.25, 180))).toBe(false);
  });
});
