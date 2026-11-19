export function readMediaDuration(file: Blob, preferredType?: 'audio' | 'video'): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  const type = preferredType || (file.type.startsWith('audio/') ? 'audio' : 'video');
  const media = document.createElement(type);
  media.preload = 'metadata';
  return new Promise<number>((resolve, reject) => {
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(media.duration);
    };
    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This file is not a playable audio or video recording.'));
    };
    media.src = objectUrl;
  });
}
