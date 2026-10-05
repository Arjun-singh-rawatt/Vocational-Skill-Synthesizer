import path from 'path';
import fs from 'fs';
import { analyzeMediaWithGemini } from '../src/services/gemini';
import { env } from '../src/config/env';

async function main() {
  console.log('=== FluentLens Gemini Service Verification Script ===');
  console.log(`GEMINI_MODEL: ${env.GEMINI_MODEL}`);
  console.log(`DEMO_MODE: ${env.DEMO_MODE}`);

  const samplePath = process.argv[2];
  if (!samplePath || !fs.existsSync(samplePath)) {
    console.log('\nUsage: npm run test:gemini -- <path-to-media-file>');
    console.log('Example: npm run test:gemini -- ./sample.mp3');
    if (!env.GEMINI_API_KEY) {
      console.log('\n[INFO] GEMINI_API_KEY is not configured in .env. Real API calls require a key.');
      process.exit(0);
    }
    console.log('\nPlease provide a valid media file path to test Gemini analysis.');
    process.exit(1);
  }

  const extension = path.extname(samplePath).toLowerCase();
  let mimeType = 'audio/mp3';
  let mediaType: 'video' | 'audio' = 'audio';

  if (['.mp4', '.webm', '.mov', '.mkv'].includes(extension)) {
    mediaType = 'video';
    mimeType = extension === '.webm' ? 'video/webm' : 'video/mp4';
  } else if (['.wav', '.ogg', '.m4a'].includes(extension)) {
    mimeType = extension === '.wav' ? 'audio/wav' : 'audio/ogg';
  }

  console.log(`Analyzing file: ${samplePath} (${mediaType}, ${mimeType})...`);

  try {
    const result = await analyzeMediaWithGemini({
      filePath: samplePath,
      mimeType,
      targetLanguage: 'English',
      goal: 'conversation',
      mediaType,
    });

    console.log('\n--- Analysis Success ---');
    console.log(`Path Used: ${result.pathUsed}`);
    console.log(`Interaction ID: ${result.interactionId || 'N/A'}`);
    console.log('\n--- Validated Report Summary ---');
    console.log(`Detected Level: ${result.report.detected_level}`);
    console.log(`Transcript: "${result.report.transcript}"`);
    console.log('Scores:', JSON.stringify(result.report.scores, null, 2));
    console.log(`Key Details (${result.report.key_details.length} items):`);
    result.report.key_details.forEach((item) => {
      console.log(`  [${item.timestamp}] [${item.category.toUpperCase()}] ${item.observation} -> Suggestion: "${item.suggestion}" (Better: ${item.better_phrase || 'N/A'})`);
    });
    console.log(`Actions (${result.report.actions.length} items):`);
    result.report.actions.forEach((act) => {
      console.log(`  - ${act.title} (${act.duration_minutes} mins): ${act.exercise}`);
    });
    console.log(`Filler words detected: ${result.report.filler_words_detected.join(', ') || 'None'}`);
    console.log('\n✅ Report validated successfully against Zod Schema!');
  } catch (err: any) {
    console.error('\n❌ Gemini analysis failed:', err);
    process.exit(1);
  }
}

main();
