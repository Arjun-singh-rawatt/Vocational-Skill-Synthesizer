import { describe, it, expect } from 'vitest';
import { reportZodSchema } from '../services/gemini';
import sampleReportData from '../demo/sampleReport.json';

describe('Demo Mode Sample Report Verification', () => {
  it('validates sampleReport.json against reportZodSchema cleanly', () => {
    const parseResult = reportZodSchema.safeParse(sampleReportData);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) {
      console.error(parseResult.error.errors);
    }
    expect(sampleReportData.language).toBe('English');
    expect(sampleReportData.detected_level).toBe('B2');
    expect(sampleReportData.scores.vocabulary).toBeGreaterThan(0);
    expect(sampleReportData.key_details.length).toBeGreaterThan(0);
    expect(sampleReportData.actions.length).toBeGreaterThan(0);
    expect(sampleReportData.improvements).toBeDefined();
    expect(sampleReportData.improvements.tone.label).toBeDefined();
    expect(Array.isArray(sampleReportData.improvements.word_choices)).toBe(true);
    expect(Array.isArray(sampleReportData.improvements.vocabulary_upgrades)).toBe(true);
    expect(Array.isArray(sampleReportData.improvements.phrase_upgrades)).toBe(true);
    expect(Array.isArray(sampleReportData.improvements.sentence_structure)).toBe(true);
  });
});
