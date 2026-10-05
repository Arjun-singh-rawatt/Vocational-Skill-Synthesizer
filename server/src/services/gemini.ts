import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import fs from 'fs';
import { env } from '../config/env';

export const reportZodSchema = z.object({
  language: z.string(),
  detected_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  transcript: z.string(),
  scores: z.object({
    vocabulary: z.number().min(0).max(100),
    grammar: z.number().min(0).max(100),
    delivery: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    body_language: z.number().min(0).max(100).nullable(),
  }),
  plan: z.object({
    summary: z.string(),
    focus_areas: z.array(z.string()),
  }),
  key_details: z.array(
    z.object({
      timestamp: z.string(),
      category: z.enum([
        'grammar',
        'vocabulary',
        'idiom',
        'pronunciation_clarity',
        'intonation',
        'fluency',
        'body_language',
      ]),
      observation: z.string(),
      suggestion: z.string(),
      better_phrase: z.string().nullable(),
    })
  ),
  actions: z.array(
    z.object({
      title: z.string(),
      exercise: z.string(),
      duration_minutes: z.number(),
    })
  ),
  vocabulary_suggestions: z.array(
    z.object({
      word: z.string(),
      meaning: z.string(),
      example: z.string(),
      replaces: z.string().nullable(),
    })
  ),
  idiom_suggestions: z.array(
    z.object({
      idiom: z.string(),
      meaning: z.string(),
      example: z.string(),
    })
  ),
  filler_words_detected: z.array(z.string()),
  overall_summary: z.string(),
});

export type IReport = z.infer<typeof reportZodSchema>;

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment.');
  }
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

const COACHING_SYSTEM_INSTRUCTION = `
You are an expert language and communication coach. Analyze the learner's speaking in the recording.
In video mode, inspect specific segments for hesitations, tone shifts, eye contact, posture, facial expression and gestures.
Rules:
(a) judge against the learner's goal and level (CEFR), not against a "native speaker" standard; focus on intelligibility and clarity;
(b) describe pronunciation as clarity and intonation observations, and do NOT claim precise phoneme-level scoring;
(c) every key_details item needs a real mm:ss timestamp from the recording;
(d) be specific, quote what was said, and give a better phrase;
(e) if unsure, say so rather than inventing errors;
(f) write feedback in the learner's feedback language (default English) while quoting the target language;
(g) for audio-only, set body_language score to null and omit body_language items from key_details;
(h) transcribe verbatim, including filler words and false starts.
`;

const REPORT_SCHEMA_JSON_STRING = JSON.stringify({
  type: "OBJECT",
  properties: {
    language: { type: "STRING" },
    detected_level: { type: "STRING", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
    transcript: { type: "STRING" },
    scores: {
      type: "OBJECT",
      properties: {
        vocabulary: { type: "NUMBER" },
        grammar: { type: "NUMBER" },
        delivery: { type: "NUMBER" },
        clarity: { type: "NUMBER" },
        body_language: { type: "NUMBER", nullable: true }
      },
      required: ["vocabulary", "grammar", "delivery", "clarity"]
    },
    plan: {
      type: "OBJECT",
      properties: {
        summary: { type: "STRING" },
        focus_areas: { type: "ARRAY", items: { type: "STRING" } }
      },
      required: ["summary", "focus_areas"]
    },
    key_details: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          timestamp: { type: "STRING" },
          category: { type: "STRING", enum: ["grammar", "vocabulary", "idiom", "pronunciation_clarity", "intonation", "fluency", "body_language"] },
          observation: { type: "STRING" },
          suggestion: { type: "STRING" },
          better_phrase: { type: "STRING", nullable: true }
        },
        required: ["timestamp", "category", "observation", "suggestion"]
      }
    },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          exercise: { type: "STRING" },
          duration_minutes: { type: "NUMBER" }
        },
        required: ["title", "exercise", "duration_minutes"]
      }
    },
    vocabulary_suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          meaning: { type: "STRING" },
          example: { type: "STRING" },
          replaces: { type: "STRING", nullable: true }
        },
        required: ["word", "meaning", "example"]
      }
    },
    idiom_suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          idiom: { type: "STRING" },
          meaning: { type: "STRING" },
          example: { type: "STRING" }
        },
        required: ["idiom", "meaning", "example"]
      }
    },
    filler_words_detected: { type: "ARRAY", items: { type: "STRING" } },
    overall_summary: { type: "STRING" }
  },
  required: [
    "language", "detected_level", "transcript", "scores", "plan",
    "key_details", "actions", "vocabulary_suggestions", "idiom_suggestions",
    "filler_words_detected", "overall_summary"
  ]
});

export async function analyzeMediaWithGemini(options: {
  filePath: string;
  mimeType: string;
  targetLanguage: string;
  goal: string;
  mediaType: 'video' | 'audio';
}): Promise<{ report: IReport; interactionId?: string; pathUsed: string }> {
  const ai = getGeminiClient();

  console.log(`[Gemini] Uploading media file (${options.mimeType})...`);
  const uploadedFile = await ai.files.upload({
    file: options.filePath,
    mimeType: options.mimeType,
  });

  console.log(`[Gemini] Uploaded file name: ${uploadedFile.name}. Polling until ACTIVE...`);
  let activeFile = uploadedFile;
  let attempts = 0;
  while (activeFile.state === 'PROCESSING' && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    activeFile = await ai.files.get({ name: uploadedFile.name });
    attempts++;
  }

  if (activeFile.state === 'FAILED') {
    throw new Error('Gemini Files API failed to process media file.');
  }

  const prompt = `Analyze this spoken language recording for a learner whose goal is "${options.goal}" and target language is "${options.targetLanguage}".
Provide a complete, detailed evaluation adhering strictly to the JSON schema.
Ensure timestamps in key_details use mm:ss format. Include verbatim transcript and list all filler words.`;

  let responseText = '';
  let interactionId: string | undefined = undefined;
  let pathUsed = 'Interactions API (agentic)';

  try {
    console.log('[Gemini] Attempting primary path: Interactions API');
    const interactionInput: any[] = [prompt, activeFile];

    const interactionConfig: any = {
      systemInstruction: COACHING_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: JSON.parse(REPORT_SCHEMA_JSON_STRING),
    };

    if (options.mediaType === 'video') {
      // Set agentic processing for video input part if supported
      interactionConfig.processing = 'agentic';
    }

    const interaction = await (ai as any).interactions.create({
      model: env.GEMINI_MODEL,
      input: interactionInput,
      config: interactionConfig,
    });

    interactionId = interaction.id || interaction.interactionId;
    responseText = interaction.text || (interaction.outputs && interaction.outputs[0]?.text) || JSON.stringify(interaction.response);
    pathUsed = options.mediaType === 'video' ? 'Interactions API (agentic video)' : 'Interactions API (audio)';
    console.log(`[Gemini] Interaction created successfully with ID: ${interactionId}`);
  } catch (primaryErr: any) {
    console.warn(`[Gemini] Primary path (Interactions API) failed/unavailable: ${primaryErr.message}. Falling back to generateContent...`);
    pathUsed = 'generateContent API (Fallback)';

    try {
      const response = await ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: COACHING_SYSTEM_INSTRUCTION + '\n\n' + prompt }, { fileData: { fileUri: activeFile.uri, mimeType: activeFile.mimeType } }] }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: JSON.parse(REPORT_SCHEMA_JSON_STRING),
        }
      });

      responseText = response.text || '';
    } catch (fallbackErr: any) {
      console.error(`[Gemini] Fallback path also failed: ${fallbackErr.message}`);
      // Clean up uploaded file before throwing
      await cleanupGeminiFile(ai, activeFile.name);
      throw fallbackErr;
    }
  }

  // Always attempt to delete uploaded file after analysis
  await cleanupGeminiFile(ai, activeFile.name);

  // Validate JSON response with zod
  let report: IReport;
  try {
    const rawJson = JSON.parse(cleanJsonResponse(responseText));
    const parsed = reportZodSchema.safeParse(rawJson);
    if (!parsed.success) {
      console.warn(`[Gemini] Zod validation failed on initial response: ${parsed.error.errors[0].message}. Retrying once with reminder...`);
      report = await retryReportValidation(ai, rawJson, parsed.error.errors[0].message);
    } else {
      report = parsed.data;
    }
  } catch (parseErr: any) {
    console.warn(`[Gemini] Failed to parse JSON response. Retrying once... ${parseErr.message}`);
    report = await retryReportValidation(ai, responseText, parseErr.message);
  }

  return { report, interactionId, pathUsed };
}

async function retryReportValidation(ai: GoogleGenAI, invalidText: any, errorReason: string): Promise<IReport> {
  const retryPrompt = `The following output failed schema validation because: "${errorReason}".
Please fix it and return ONLY valid JSON matching the exact schema required.
Invalid output:
${typeof invalidText === 'string' ? invalidText : JSON.stringify(invalidText)}`;

  const response = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: retryPrompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: JSON.parse(REPORT_SCHEMA_JSON_STRING),
    }
  });

  const rawJson = JSON.parse(cleanJsonResponse(response.text || '{}'));
  const parsed = reportZodSchema.parse(rawJson); // throws if still invalid
  return parsed;
}

export async function askGeminiFollowUp(options: {
  interactionId?: string;
  question: string;
  transcript: string;
  reportSummary: string;
}): Promise<{ answer: string; isFallback: boolean }> {
  const ai = getGeminiClient();

  if (options.interactionId) {
    try {
      console.log(`[Gemini Chat] Sending question using interactionId: ${options.interactionId}`);
      const interaction = await (ai as any).interactions.create({
        model: env.GEMINI_MODEL,
        input: options.question,
        previous_interaction_id: options.interactionId,
        config: {
          systemInstruction: 'Answer only about this recording, quoting the user and citing mm:ss timestamps if relevant.',
        },
      });

      const answer = interaction.text || (interaction.outputs && interaction.outputs[0]?.text) || 'No response generated.';
      return { answer, isFallback: false };
    } catch (err: any) {
      console.warn(`[Gemini Chat] Interactions API chat failed (${err.message}). Falling back to text context prompt...`);
    }
  }

  // Fallback text context model call
  console.log('[Gemini Chat] Executing fallback text-based chat response');
  const fallbackPrompt = `You are an AI language coach reviewing a previous speaking recording session.
Note: The original media session context is no longer active. Use the transcript and report summary below to answer the user's question accurately.
Always cite mm:ss timestamps when referring to specific parts of the transcript.

Transcript:
"${options.transcript}"

Report Summary:
"${options.reportSummary}"

User Question: "${options.question}"`;

  const response = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: fallbackPrompt }] }],
  });

  const answer = (response.text || '') + '\n\n*(Note: Answer generated from saved transcript context as original media session has expired.)*';
  return { answer, isFallback: true };
}

async function cleanupGeminiFile(ai: GoogleGenAI, fileName: string) {
  try {
    console.log(`[Gemini] Deleting file ${fileName}...`);
    await ai.files.delete({ name: fileName });
  } catch (err: any) {
    console.warn(`[Gemini] File cleanup warning: ${err.message}`);
  }
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
}
