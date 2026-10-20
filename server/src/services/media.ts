import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface MediaProbeResult {
  durationSec: number;
}

export interface SilenceDetectResult {
  totalSilenceSec: number;
  pauseCount: number;
}

export async function getMediaDuration(filePath: string): Promise<number> {
  const ffprobePath = ffprobeStatic.path;
  if (!ffprobePath) {
    throw new Error('Media duration could not be checked because ffprobe is unavailable. Please try again later.');
  }

  try {
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const { stdout } = await execPromise(cmd);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration) || duration <= 0) {
      throw new Error('Unable to read media duration. Please choose a valid audio or video file.');
    }
    return Math.round(duration);
  } catch (err: any) {
    throw new Error(`Unable to read media duration. Please choose a valid audio or video file. (${err.message})`);
  }
}

export async function detectAudioSilence(filePath: string): Promise<SilenceDetectResult> {
  if (!ffmpegPath) {
    console.warn('[Media] ffmpegPath not available; defaulting silence detection.');
    return { totalSilenceSec: 0, pauseCount: 0 };
  }

  try {
    const cmd = `"${ffmpegPath}" -i "${filePath}" -af silencedetect=noise=-30dB:d=0.4 -f null -`;
    // FFmpeg outputs silencedetect details to stderr
    const { stderr } = await execPromise(cmd);

    let totalSilenceSec = 0;
    let pauseCount = 0;

    const durationMatches = stderr.matchAll(/silence_duration:\s*([\d.]+)/g);
    for (const match of durationMatches) {
      if (match[1]) {
        const dur = parseFloat(match[1]);
        if (!isNaN(dur)) {
          totalSilenceSec += dur;
          pauseCount++;
        }
      }
    }

    return {
      totalSilenceSec: Number(totalSilenceSec.toFixed(2)),
      pauseCount,
    };
  } catch (err: any) {
    // Note: ffmpeg outputs to stderr so execPromise might reject even on success, check stderr in error
    if (err.stderr) {
      let totalSilenceSec = 0;
      let pauseCount = 0;

      const durationMatches = err.stderr.matchAll(/silence_duration:\s*([\d.]+)/g);
      for (const match of durationMatches) {
        if (match[1]) {
          const dur = parseFloat(match[1]);
          if (!isNaN(dur)) {
            totalSilenceSec += dur;
            pauseCount++;
          }
        }
      }
      return { totalSilenceSec: Number(totalSilenceSec.toFixed(2)), pauseCount };
    }

    console.warn(`[Media] Silence detection warning: ${err.message}`);
    return { totalSilenceSec: 0, pauseCount: 0 };
  }
}
