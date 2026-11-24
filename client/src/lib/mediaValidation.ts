import { MAX_DURATION_SEC } from '../data/uploadLimits';

export function resolveMediaDuration(metadataDuration: number, recordedDuration?: number): number {
  if (Number.isFinite(metadataDuration) && metadataDuration > 0) return metadataDuration;
  if (recordedDuration !== undefined && Number.isFinite(recordedDuration) && recordedDuration > 0) return recordedDuration;
  return metadataDuration;
}

export function isValidMediaDuration(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= MAX_DURATION_SEC;
}

export function readMediaDuration(file: Blob, preferredType?: 'audio' | 'video', recordedDuration?: number): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  const type = preferredType || (file.type.startsWith('audio/') ? 'audio' : 'video');
  const media = document.createElement(type);
  media.preload = 'metadata';
  return new Promise<number>((resolve, reject) => {
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(resolveMediaDuration(media.duration, recordedDuration));
    };
    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This file is not a playable audio or video recording.'));
    };
    media.src = objectUrl;
  });
}
