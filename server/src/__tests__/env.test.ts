import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

const originalUploadLimit = process.env.MAX_UPLOAD_MB;
const originalClipLimit = process.env.MAX_CLIP_SECONDS;

afterEach(() => {
  if (originalUploadLimit === undefined) delete process.env.MAX_UPLOAD_MB;
  else process.env.MAX_UPLOAD_MB = originalUploadLimit;
  if (originalClipLimit === undefined) delete process.env.MAX_CLIP_SECONDS;
  else process.env.MAX_CLIP_SECONDS = originalClipLimit;
  vi.resetModules();
});

describe('upload environment limit', () => {
  it('defaults to 250 MB', async () => {
    delete process.env.MAX_UPLOAD_MB;
    vi.resetModules();
    const { env } = await import('../config/env.js');
    expect(env.MAX_UPLOAD_MB).toBe(250);
  });

  it('clamps values above 250 MB to 250 MB', async () => {
    process.env.MAX_UPLOAD_MB = '500';
    vi.resetModules();
    const { env } = await import('../config/env.js');
    expect(env.MAX_UPLOAD_MB).toBe(250);
  });

  it('keeps the clip duration capped at 180 seconds', async () => {
    process.env.MAX_CLIP_SECONDS = '240';
    vi.resetModules();
    const { env } = await import('../config/env.js');
    expect(env.MAX_CLIP_SECONDS).toBe(180);
  });
});
