import path from 'path';
import fs from 'fs';

export function getUploadsDir(fromDirname: string): string {
  return path.join(fromDirname, '../../uploads');
}

export function sweepUploadsDirectory(uploadDir: string): void {
  fs.mkdirSync(uploadDir, { recursive: true });
  for (const entry of fs.readdirSync(uploadDir, { withFileTypes: true })) {
    if (entry.isFile() || entry.isSymbolicLink()) {
      try {
        fs.unlinkSync(path.join(uploadDir, entry.name));
      } catch {
        console.warn('[Uploads] Could not remove a leftover temporary file.');
      }
    }
  }
}

export function buildAnalysisFailureUpdate(message: string) {
  const errorMessage = message || 'Media analysis failed. Please try again.';
  return {
    status: 'failed' as const,
    errorMessage,
  };
}
