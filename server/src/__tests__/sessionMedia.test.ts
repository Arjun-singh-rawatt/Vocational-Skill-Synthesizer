import { describe, it, expect } from 'vitest';
import { buildAnalysisFailureUpdate } from '../services/sessionMedia';

describe('buildAnalysisFailureUpdate', () => {
  it('marks an initial analysis as failed', () => {
    expect(buildAnalysisFailureUpdate('Gemini failed')).toEqual({
      status: 'failed',
      errorMessage: 'Gemini failed',
    });
  });
});
