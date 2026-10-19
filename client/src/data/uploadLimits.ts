// Keep these client-facing limits aligned with the server defaults in server/src/config/env.ts.
export const MAX_FILE_SIZE_MB = 100;
export const MAX_DURATION_SEC = 200;
export const ALLOWED_VIDEO_FORMATS = 'MP4, MOV, WEBM';
export const ALLOWED_AUDIO_FORMATS = 'MP3, WAV, WEBM';
export const ALLOWED_FORMATS = `${ALLOWED_VIDEO_FORMATS}, ${ALLOWED_AUDIO_FORMATS}`;
