import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { spawn } from 'child_process';

export interface MediaProbeResult {
  durationSec: number;
}

export interface SilenceDetectResult {
  totalSilenceSec: number;
  pauseCount: number;
}

export interface InspectedMedia {
  durationSec: number;
  mediaType: 'audio' | 'video';
  mimeType: string;
}

function runProcess(executable: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', () => reject(new Error('Media tools are unavailable.')));
    child.once('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error('Media file could not be processed.')));
  });
}

export async function inspectMedia(filePath: string): Promise<InspectedMedia> {
  const ffprobePath = ffprobeStatic.path;
  if (!ffprobePath) throw new Error('Media validation is unavailable. Please try again later.');

  let probe: { format?: { duration?: string; format_name?: string }; streams?: Array<{ codec_type?: string }> };
  try {
    const { stdout } = await runProcess(ffprobePath, [
      '-v', 'error', '-show_entries', 'format=duration,format_name:stream=codec_type', '-of', 'json', filePath,
    ]);
    probe = JSON.parse(stdout);
  } catch {
    throw new Error('This file is not a valid supported audio or video recording.');
  }

  const formats = (probe.format?.format_name || '').split(',');
  const streams = probe.streams || [];
  const hasVideo = streams.some((stream) => stream.codec_type === 'video');
  const hasAudio = streams.some((stream) => stream.codec_type === 'audio');
  const durationSec = Number(probe.format?.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || !hasAudio) {
    throw new Error('This file must contain a valid audio track.');
  }

  if (hasVideo) {
    if (!formats.some((format) => ['mov', 'mp4', 'matroska', 'webm'].includes(format))) {
      throw new Error('Supported video formats are MP4, MOV, and WebM.');
    }
    return { durationSec, mediaType: 'video', mimeType: formats.includes('webm') || formats.includes('matroska') ? 'video/webm' : 'video/mp4' };
  }

  if (formats.includes('mp3')) return { durationSec, mediaType: 'audio', mimeType: 'audio/mpeg' };
  if (formats.includes('wav')) return { durationSec, mediaType: 'audio', mimeType: 'audio/wav' };
  if (formats.includes('ogg')) return { durationSec, mediaType: 'audio', mimeType: 'audio/ogg' };
  if (formats.includes('webm') || formats.includes('matroska')) return { durationSec, mediaType: 'audio', mimeType: 'audio/webm' };
  if (formats.some((format) => ['mov', 'mp4', 'm4a', '3gp', '3g2'].includes(format))) return { durationSec, mediaType: 'audio', mimeType: 'audio/mp4' };
  throw new Error('Supported audio formats are MP3, WAV, OGG, M4A, and WebM.');
}

export async function getMediaDuration(filePath: string): Promise<number> {
  return (await inspectMedia(filePath)).durationSec;
}

export async function detectAudioSilence(filePath: string): Promise<SilenceDetectResult> {
  if (!ffmpegPath) {
    console.warn('[Media] ffmpegPath not available; defaulting silence detection.');
    return { totalSilenceSec: 0, pauseCount: 0 };
  }

  try {
    const { stderr } = await runProcess(ffmpegPath, ['-i', filePath, '-af', 'silencedetect=noise=-30dB:d=0.4', '-f', 'null', '-']);

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
    if ((err as any).stderr) {
      let totalSilenceSec = 0;
      let pauseCount = 0;

      const durationMatches = (err as any).stderr.matchAll(/silence_duration:\s*([\d.]+)/g);
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

    console.warn('[Media] Silence detection failed; continuing without silence metrics.');
    return { totalSilenceSec: 0, pauseCount: 0 };
  }
}
