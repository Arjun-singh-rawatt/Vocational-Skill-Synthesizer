import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTransientGeminiError, toUserFacingGeminiError, withGeminiRetry } from '../services/geminiRetry';

describe('Gemini transient error handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recognizes structured and JSON-stringified 503 UNAVAILABLE responses', () => {
    const error = new Error('{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}');
    expect(isTransientGeminiError(error)).toBe(true);
    expect(toUserFacingGeminiError(error).message).toContain('temporarily busy');
  });

  it('retries transient errors with bounded backoff and returns a successful response', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const waits: number[] = [];
    let calls = 0;
    const result = await withGeminiRetry(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('Service unavailable'), { status: 503 });
      return 'analysis complete';
    }, 'test request', {
      baseDelayMs: 10,
      maxDelayMs: 15,
      sleep: async (delayMs) => { waits.push(delayMs); },
    });

    expect(result).toBe('analysis complete');
    expect(calls).toBe(3);
    expect(waits).toEqual([10, 15]);
  });

  it('does not retry permanent request errors and gives a useful message after transient retries exhaust', async () => {
    const permanentOperation = vi.fn().mockRejectedValue(Object.assign(new Error('Bad request'), { status: 400 }));
    await expect(withGeminiRetry(permanentOperation, 'test request', { sleep: async () => undefined }))
      .rejects.toThrow('Bad request');
    expect(permanentOperation).toHaveBeenCalledTimes(1);

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unavailable = vi.fn().mockRejectedValue(new Error('503 UNAVAILABLE'));
    await expect(withGeminiRetry(unavailable, 'test request', {
      maxAttempts: 2,
      sleep: async () => undefined,
    })).rejects.toThrow('The AI service is temporarily busy');
    expect(unavailable).toHaveBeenCalledTimes(2);
  });
});
