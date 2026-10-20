import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import fs from 'fs';
import { env } from '../config/env';
import { withGeminiRetry } from './geminiRetry';

export const reportZodSchema = z.object({
  language: z.string(),
  detected_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  transcript: z.string(),
  improved_transcript: z.string().optional(),
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
  improvements: z.object({
    word_choices: z.array(
      z.object({
        original: z.string(),
        better: z.string(),
        reason: z.string(),
      })
    ),
    vocabulary_upgrades: z.array(
      z.object({
        word: z.string(),
        meaning: z.string(),
        example: z.string(),
        replaces: z.string().nullable(),
      })
    ),
    phrase_upgrades: z.array(
      z.object({
        original_sentence: z.string(),
        upgraded: z.string(),
        idiom_or_phrase: z.string(),
        meaning: z.string(),
      })
    ),
    sentence_structure: z.array(
      z.object({
        original: z.string(),
        improved: z.string(),
        explanation: z.string(),
      })
    ),
    tone: z.object({
      label: z.enum([
        'neutral',
        'emotional',
        'suspenseful',
        'comedic',
        'serious',
        'enthusiastic',
        'nervous',
        'sad',
        'angry',
        'inspirational',
      ]),
      reason: z.string(),
    }),
  }),
});

export type IReport = z.infer<typeof reportZodSchema>;

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment.');
  }
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

function getTemperatureMode(temperature: number): { mode: string; guidance: string } {
  if (temperature < 0.35) {
    return {
      mode: 'Accurate mode',
      guidance:
        'Accurate mode: suggest simple, common, safe vocabulary and standard sentence structures that fit the speaker\'s CEFR level; use idioms only if very common; keep rewrites close to what the speaker said.',
    };
  } else if (temperature <= 0.7) {
    return {
      mode: 'Balanced mode',
      guidance:
        'Balanced mode: natural, fluent vocabulary and a mix of structures; a few well-known idioms where they genuinely fit.',
    };
  } else {
    return {
      mode: 'Creative mode',
      guidance:
        'Creative mode: richer, more expressive vocabulary, varied and more sophisticated sentence structures, and idioms/phrases wherever natural.',
    };
  }
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
    improved_transcript: { type: "STRING" },
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
    overall_summary: { type: "STRING" },
    improvements: {
      type: "OBJECT",
      properties: {
        word_choices: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              original: { type: "STRING" },
              better: { type: "STRING" },
              reason: { type: "STRING" }
            },
            required: ["original", "better", "reason"]
          }
        },
        vocabulary_upgrades: {
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
        phrase_upgrades: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              original_sentence: { type: "STRING" },
              upgraded: { type: "STRING" },
              idiom_or_phrase: { type: "STRING" },
              meaning: { type: "STRING" }
            },
            required: ["original_sentence", "upgraded", "idiom_or_phrase", "meaning"]
          }
        },
        sentence_structure: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              original: { type: "STRING" },
              improved: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["original", "improved", "explanation"]
          }
        },
        tone: {
          type: "OBJECT",
          properties: {
            label: {
              type: "STRING",
              enum: [
                "neutral",
                "emotional",
                "suspenseful",
                "comedic",
                "serious",
                "enthusiastic",
                "nervous",
                "sad",
                "angry",
                "inspirational"
              ]
            },
            reason: { type: "STRING" }
          },
          required: ["label", "reason"]
        }
      },
      required: ["word_choices", "vocabulary_upgrades", "phrase_upgrades", "sentence_structure", "tone"]
    }
  },
  required: [
    "language", "detected_level", "transcript", "improved_transcript", "scores", "plan",
    "key_details", "actions", "vocabulary_suggestions", "idiom_suggestions",
    "filler_words_detected", "overall_summary", "improvements"
  ]
});

export async function analyzeMediaWithGemini(options: {
  filePath: string;
  mimeType: string;
  targetLanguage: string;
  goal: string;
  mediaType: 'video' | 'audio';
  temperature?: number;
}): Promise<{ report: IReport; interactionId?: string; pathUsed: string }> {
  const ai = getGeminiClient();
  const temperature = options.temperature !== undefined ? Math.min(1, Math.max(0, options.temperature)) : 0.7;
  const { mode, guidance } = getTemperatureMode(temperature);

  console.log(`[Gemini] Uploading media file (${options.mimeType})...`);
  const uploadedFile = await withGeminiRetry(
    () => ai.files.upload({
      file: options.filePath,
      mimeType: options.mimeType,
    } as any),
    'media upload',
  );

  console.log(`[Gemini] Uploaded file name: ${uploadedFile.name}. Polling until ACTIVE...`);
  let activeFile = uploadedFile;
  let attempts = 0;
  while ((activeFile as any).state === 'PROCESSING' && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (uploadedFile.name) {
      activeFile = await withGeminiRetry(
        () => ai.files.get({ name: uploadedFile.name! }),
        'media processing status check',
      );
    }
    attempts++;
  }

  if ((activeFile as any).state === 'FAILED') {
    throw new Error('Gemini Files API failed to process media file.');
  }

  const prompt = `Analyze this spoken language recording for a learner whose goal is "${options.goal}" and target language is "${options.targetLanguage}".
Provide a complete, detailed evaluation adhering strictly to the JSON schema.
Ensure timestamps in key_details use mm:ss format. Include the complete verbatim transcript and list all filler words. Also provide improved_transcript: a complete, natural, polished rewrite of the entire transcript, preserving all of the speaker's ideas and sequence while correcting language and removing fillers. Do not summarize, omit sentences, or limit this full rewrite to the examples below.

Temperature setting: ${temperature.toFixed(2)} (${mode}).
Feedback guidance: ${guidance}

Improvements instructions:
- Cap each improvements array (word_choices, vocabulary_upgrades, phrase_upgrades, sentence_structure) at 5 items maximum to keep responses small and fast.
- Quote the speaker's actual spoken words in "original", "original_sentence", and "original"; do NOT invent sentences they did not say.
- If nothing applies for a section, return an empty array rather than inventing items.
- For audio-only and video alike, judge tone from voice (and facial expression/body language if video). Provide a valid label enum and ONE short sentence explaining why that label was chosen.`;

  let responseText = '';
  let interactionId: string | undefined = undefined;
  let pathUsed = 'Interactions API (agentic)';

  try {
    console.log('[Gemini] Attempting primary path: Interactions API');
    const interactionInput: any[] = [prompt, activeFile];

    // Note: @google/genai Interactions API is an experimental preview; we pass temperature here in interactionConfig
    const interactionConfig: any = {
      systemInstruction: COACHING_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: JSON.parse(REPORT_SCHEMA_JSON_STRING),
      temperature,
    };

    if (options.mediaType === 'video') {
      // Set agentic processing for video input part if supported
      interactionConfig.processing = 'agentic';
    }

    const interaction = await withGeminiRetry<any>(
      () => (ai as any).interactions.create({
        model: env.GEMINI_MODEL,
        input: interactionInput,
        config: interactionConfig,
      }),
      'media analysis',
    );

    interactionId = interaction.id || interaction.interactionId;
    responseText = interaction.text || (interaction.outputs && interaction.outputs[0]?.text) || JSON.stringify(interaction.response);
    pathUsed = options.mediaType === 'video' ? 'Interactions API (agentic video)' : 'Interactions API (audio)';
    console.log(`[Gemini] Interaction created successfully with ID: ${interactionId}`);
  } catch (primaryErr: any) {
    console.warn(`[Gemini] Primary path (Interactions API) failed/unavailable: ${primaryErr.message}. Falling back to generateContent...`);
    pathUsed = 'generateContent API (Fallback)';

    try {
      const response = await withGeminiRetry(
        () => ai.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: [
            { role: 'user', parts: [{ text: COACHING_SYSTEM_INSTRUCTION + '\n\n' + prompt }, { fileData: { fileUri: (activeFile as any).uri || '', mimeType: (activeFile as any).mimeType || options.mimeType } }] }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: JSON.parse(REPORT_SCHEMA_JSON_STRING),
            temperature,
          }
        }),
        'fallback media analysis',
      );

      responseText = response.text || '';
    } catch (fallbackErr: any) {
      console.error(`[Gemini] Fallback path also failed: ${fallbackErr.message}`);
      // Clean up uploaded file before throwing
      if (activeFile.name) {
        await cleanupGeminiFile(ai, activeFile.name);
      }
      throw fallbackErr;
    }
  }

  // Always attempt to delete uploaded file after analysis
  if (activeFile.name) {
    await cleanupGeminiFile(ai, activeFile.name);
  }

  // Validate JSON response with zod
  let report: IReport;
  try {
    const rawJson = JSON.parse(cleanJsonResponse(responseText));
    const parsed = reportZodSchema.safeParse(rawJson);
    if (!parsed.success) {
      console.warn(`[Gemini] Zod validation failed on initial response: ${parsed.error.errors[0].message}. Retrying once with reminder...`);
      report = await retryReportValidation(ai, rawJson, parsed.error.errors[0].message, temperature);
    } else {
      report = parsed.data;
    }
  } catch (parseErr: any) {
    console.warn(`[Gemini] Failed to parse JSON response. Retrying once... ${parseErr.message}`);
    report = await retryReportValidation(ai, responseText, parseErr.message, temperature);
  }

  return { report, interactionId, pathUsed };
}

async function retryReportValidation(ai: GoogleGenAI, invalidText: any, errorReason: string, temperature: number = 0.7): Promise<IReport> {
  const retryPrompt = `The following output failed schema validation because: "${errorReason}".
Please fix it and return ONLY valid JSON matching the exact schema required.
Invalid output:
${typeof invalidText === 'string' ? invalidText : JSON.stringify(invalidText)}`;

  const response = await withGeminiRetry(
    () => ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: retryPrompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: JSON.parse(REPORT_SCHEMA_JSON_STRING),
        temperature,
      }
    }),
    'report formatting retry',
  );

  const rawJson = JSON.parse(cleanJsonResponse(response.text || '{}'));
  const parsed = reportZodSchema.parse(rawJson); // throws if still invalid
  return parsed;
}

export async function askGeminiFollowUp(options: {
  question: string;
  temperature: number;
  language: string;
  goal: string;
  detectedLevel: string;
  improvements: unknown;
  vocabularySuggestions: unknown;
  idiomSuggestions: unknown;
  transcript: string;
  priorMessages: Array<{ role: 'user' | 'model'; text: string }>;
}): Promise<{ answer: string; isFallback: false }> {
  const ai = getGeminiClient();
  const temperature = Math.max(0, Math.min(1, options.temperature));
  const { mode, guidance } = getTemperatureMode(temperature);
  const systemInstruction = `You are a concise spoken-language coach. Follow these numbered instructions exactly:
1. Answer ONLY what the user asked. If they ask for vocabulary, give vocabulary only: no recap of the recording, no commentary on other aspects, and no closing remarks.
2. Use a maximum of 120 words in total, excluding table cells. At most one short intro line under 15 words, and no outro.
3. Never write paragraphs. Use ONLY these formats:
   - Vocabulary, idioms, phrases, or word corrections: markdown bullets, one line each, in the form - **word or phrase** — short meaning. _"short example"_. Bold ONLY the target word or phrase, nothing else.
   - Rewrites of sentences: a markdown table with columns "You said" | "Better".
   - Comparisons or 3+ attributes: a markdown table.
   - Any other question: at most 3 short bullets.
4. Default to 5 items. If the user asks for a number, honor it up to 10.
5. Do NOT mention timestamps (mm:ss) unless the user asks where something was said; in that case add a "Time" column.
6. Prefer items from SESSION DATA first. If the user asks for "more", create NEW items in the target language that are NOT already given in SESSION DATA or earlier in this conversation, matching the speaker's CEFR level or one level higher.
7. If the question is unrelated to the user's speaking practice, reply with one line redirecting them, nothing else.
8. Never invent things the speaker did not say. If you cannot answer from the data, say so in one line.
9. Write in English for explanations; target-language words and examples stay in the target language.

Temperature mode: ${mode}. Language guidance: ${guidance}

SESSION DATA
Target language: ${options.language}
Goal: ${options.goal}
CEFR level: ${options.detectedLevel}
Improvements: ${JSON.stringify(options.improvements)}
Vocabulary suggestions: ${JSON.stringify(options.vocabularySuggestions)}
Idiom suggestions: ${JSON.stringify(options.idiomSuggestions)}
Transcript (first 6000 characters): ${options.transcript}`;
  const contents = [
    ...options.priorMessages.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
    { role: 'user', parts: [{ text: options.question }] },
  ];
  const response = await withGeminiRetry(
    () => ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: { systemInstruction, temperature, maxOutputTokens: 400 },
    }),
    'follow-up response',
  );

  return { answer: (response.text || '').trim(), isFallback: false };
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
