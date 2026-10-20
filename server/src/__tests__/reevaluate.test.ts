import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  resolveSessionMediaPath,
  reevaluatePreflight,
  buildAnalysisFailureUpdate,
} from '../services/sessionMedia';

const uploadDir = path.resolve('/tmp/fluentlens-uploads');

describe('resolveSessionMediaPath', () => {
  it('resolves a basename inside the uploads directory', () => {
    const resolved = resolveSessionMediaPath(uploadDir, 'clip-123.webm');
    expect(resolved).toBe(path.resolve(uploadDir, 'clip-123.webm'));
  });

  it('rejects missing filenames and path traversal', () => {
    expect(() => resolveSessionMediaPath(uploadDir, undefined)).toThrow(/not available/i);
    expect(() => resolveSessionMediaPath(uploadDir, '../secret.webm')).toThrow(/invalid media filename/i);
    expect(() => resolveSessionMediaPath(uploadDir, 'subdir/clip.webm')).toThrow(/invalid media filename/i);
  });
});

describe('reevaluatePreflight', () => {
  const readySession = {
    status: 'done',
    isReevaluating: false,
    mediaFilename: 'clip-123.webm',
  };

  it('rejects in-progress sessions', () => {
    expect(reevaluatePreflight({ ...readySession, status: 'processing' }, true)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(reevaluatePreflight({ ...readySession, isReevaluating: true }, true)).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it('rejects when original media is missing', () => {
    expect(reevaluatePreflight(readySession, false)).toMatchObject({ ok: false, status: 400 });
    expect(reevaluatePreflight({ ...readySession, mediaFilename: undefined }, true)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('allows re-evaluation of a completed session with original media', () => {
    expect(reevaluatePreflight(readySession, true)).toEqual({ ok: true });
  });
});

describe('buildAnalysisFailureUpdate', () => {
  it('keeps the previous successful report on re-evaluate failure', () => {
    const update = buildAnalysisFailureUpdate(true, 'Gemini failed');
    expect(update).toEqual({
      isReevaluating: false,
      errorMessage: 'Gemini failed',
    });
    expect(update).not.toHaveProperty('status');
    expect(update).not.toHaveProperty('report');
  });

  it('marks an initial analysis as failed', () => {
    expect(buildAnalysisFailureUpdate(false, 'Gemini failed')).toEqual({
      status: 'failed',
      isReevaluating: false,
      errorMessage: 'Gemini failed',
    });
  });
});
