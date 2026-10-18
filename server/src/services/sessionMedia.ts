import path from 'path';
import fs from 'fs';

export function getUploadsDir(fromDirname: string): string {
  return path.join(fromDirname, '../../uploads');
}

export function resolveSessionMediaPath(uploadDir: string, mediaFilename?: string | null): string {
  if (!mediaFilename) {
    throw new Error('Original media is not available for this session.');
  }

  const safeName = path.basename(mediaFilename);
  if (!safeName || safeName === '.' || safeName === '..' || safeName !== mediaFilename) {
    throw new Error('Invalid media filename.');
  }

  const resolvedUploadDir = path.resolve(uploadDir);
  const filePath = path.resolve(resolvedUploadDir, safeName);
  const relative = path.relative(resolvedUploadDir, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid media path.');
  }

  return filePath;
}

export function originalMediaExists(uploadDir: string, mediaFilename?: string | null): boolean {
  try {
    return fs.existsSync(resolveSessionMediaPath(uploadDir, mediaFilename));
  } catch {
    return false;
  }
}

export type ReevaluatePreflight = { ok: true } | { ok: false; status: number; error: string };

export function reevaluatePreflight(session: {
  status?: string;
  isReevaluating?: boolean;
  isDemo?: boolean;
  mediaFilename?: string | null;
} | null, fileExists: boolean): ReevaluatePreflight {
  if (!session) {
    return { ok: false, status: 404, error: 'Session not found' };
  }

  if (session.status === 'processing' || session.isReevaluating) {
    return { ok: false, status: 409, error: 'Evaluation already in progress' };
  }

  if (session.status !== 'done') {
    return { ok: false, status: 400, error: 'Session report is not ready for re-evaluation' };
  }

  if (session.isDemo || !session.mediaFilename) {
    return {
      ok: false,
      status: 400,
      error: 'Original media is not available to re-evaluate. Upload a recording and analyze it first.',
    };
  }

  if (!fileExists) {
    return {
      ok: false,
      status: 400,
      error: 'Original recording is no longer available on the server. Please upload the clip again.',
    };
  }

  return { ok: true };
}

export function buildAnalysisFailureUpdate(isReevaluate: boolean, message: string) {
  const errorMessage = message || 'Media analysis failed. Please try again.';
  if (isReevaluate) {
    return {
      isReevaluating: false,
      errorMessage,
    };
  }
  return {
    status: 'failed' as const,
    isReevaluating: false,
    errorMessage,
  };
}
