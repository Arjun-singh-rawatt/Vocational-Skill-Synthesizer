import chatData from '../data/chatIntents.json';
import { ALLOWED_FORMATS, MAX_DURATION_SEC, MAX_FILE_SIZE_MB } from '../data/uploadLimits';

export interface ChatIntent {
  id: string;
  enabled: boolean;
  match: {
    exact?: string[];
    phrases?: string[];
    keywords?: string[];
    needsHelpCue?: boolean;
  };
  when?: 'any' | 'session' | 'noSession';
  reply: string;
  replyNoSession?: string;
}
export interface ChatSettings {
  maxWords: number;
  typingDelayMs: number;
  helpCues: string[];
  personalSpeechMarkers: string[];
  noSessionFallback: string;
}
export interface ChatUi {
  hintBeforeAnalysis: string;
  hintAfterAnalysis: string;
  headerHint: string;
  emptyAnswerFallback: string;
  inputPlaceholder: string;
  inputPlaceholderBeforeAnalysis: string;
  chipsBeforeAnalysis: string[];
  chipsAfterAnalysis: string[];
  typingDelayMs: number;
}

const defaults: ChatSettings = chatData.settings;
const uiData = chatData.ui;
const isDev = () => import.meta.env?.DEV === true;

function warn(message: string) {
  if (isDev()) console.warn(`[chatRouter] ${message}`);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s?]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getInvalidReason(value: unknown, seenIds: Set<string>): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'entry must be an object';
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) return 'missing or invalid kebab-case id';
  if (seenIds.has(item.id)) return 'duplicate id';
  seenIds.add(item.id);
  if (typeof item.enabled !== 'boolean') return 'enabled must be a boolean';
  if (typeof item.reply !== 'string' || !item.reply.trim()) return 'missing or empty reply';
  if (item.replyNoSession !== undefined && (typeof item.replyNoSession !== 'string' || !item.replyNoSession.trim())) return 'replyNoSession must be a non-empty string';
  if (item.when !== undefined && !['any', 'session', 'noSession'].includes(String(item.when))) return 'unknown when value';
  if (!item.match || typeof item.match !== 'object' || Array.isArray(item.match)) return 'match must be an object';

  const match = item.match as Record<string, unknown>;
  for (const key of ['exact', 'phrases', 'keywords'] as const) {
    if (match[key] !== undefined && !isStringArray(match[key])) return `${key} must be an array of strings`;
    if (isStringArray(match[key]) && match[key].some((entry) => !entry.trim())) return `${key} contains an empty phrase`;
  }
  if (match.needsHelpCue !== undefined && typeof match.needsHelpCue !== 'boolean') return 'needsHelpCue must be a boolean';
  if (isStringArray(match.phrases) && match.phrases.some((phrase) => phrase.trim().length < 3)) return 'phrases must be at least 3 characters';
  if (!(isStringArray(match.exact) && match.exact.length) && !(isStringArray(match.phrases) && match.phrases.length) && !(isStringArray(match.keywords) && match.keywords.length)) return 'no match rule';
  return null;
}

export function validateIntents(intents: unknown): ChatIntent[] {
  if (!Array.isArray(intents)) {
    warn('Skipped intents list: expected an array');
    return [];
  }
  const seenIds = new Set<string>();
  const valid: ChatIntent[] = [];
  for (const entry of intents) {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const reason = getInvalidReason(entry, seenIds);
    if (reason) {
      warn(`Skipped intent ${typeof item.id === 'string' ? item.id : '<unknown>'}: ${reason}`);
      continue;
    }
    if (item.enabled) valid.push(item as unknown as ChatIntent);
  }
  return valid;
}

function expandPlaceholders(reply: string): string {
  const replacements: Record<string, string> = {
    maxFileSizeMB: String(MAX_FILE_SIZE_MB),
    maxDurationSec: String(MAX_DURATION_SEC),
    allowedFormats: ALLOWED_FORMATS,
  };
  return reply.replace(/\{\{([^{}]+)\}\}/g, (placeholder, name: string) => {
    if (Object.prototype.hasOwnProperty.call(replacements, name)) return replacements[name];
    warn(`Unknown placeholder ${placeholder}; left unchanged`);
    return placeholder;
  });
}

function keywordMatches(messageWords: string[], keyword: string): boolean {
  const isPrefix = keyword.trim().endsWith('*');
  const cleanKeyword = normalize(isPrefix ? keyword.trim().slice(0, -1) : keyword);
  if (isPrefix) {
    const prefix = cleanKeyword;
    return Boolean(prefix) && messageWords.some((word) => word.startsWith(prefix));
  }
  return messageWords.includes(cleanKeyword);
}

export function createRouter(intents: unknown, settings: ChatSettings = defaults) {
  const validIntents = validateIntents(intents);
  return (text: string, options: { hasSession: boolean }): null | { reply: string; id: string } => {
    const normalized = normalize(text);
    const words = normalized ? normalized.split(' ') : [];
    if (words.length > settings.maxWords) return null;
    if (options.hasSession && settings.personalSpeechMarkers.some((marker) => normalized.includes(normalize(marker)))) return null;

    for (const intent of validIntents) {
      const when = intent.when || 'any';
      if ((when === 'session' && !options.hasSession) || (when === 'noSession' && options.hasSession)) continue;
      const match = intent.match;
      const exactMatch = match.exact?.some((candidate) => normalized === normalize(candidate)) || false;
      const phraseMatch = match.phrases?.some((candidate) => normalized.includes(normalize(candidate))) || false;
      let keywordMatch = false;
      if (match.keywords?.length) {
        keywordMatch = match.keywords.some((keyword) => keywordMatches(words, keyword));
        if (keywordMatch && (match.needsHelpCue ?? true)) {
          const helpCuePresent = settings.helpCues.some((cue) => cue === '?' ? normalized.includes('?') : words.includes(normalize(cue)));
          const isKeywordAlone = match.keywords.some((keyword) => {
            const isPrefix = keyword.trim().endsWith('*');
            const cleanKeyword = normalize(isPrefix ? keyword.trim().slice(0, -1) : keyword);
            return isPrefix
              ? words.length === 1 && words[0].startsWith(cleanKeyword)
              : normalized === cleanKeyword;
          });
          keywordMatch = helpCuePresent || isKeywordAlone;
        }
      }
      if (!exactMatch && !phraseMatch && !keywordMatch) continue;
      const selectedReply = !options.hasSession && intent.replyNoSession ? intent.replyNoSession : intent.reply;
      return { reply: expandPlaceholders(selectedReply), id: intent.id };
    }
    return null;
  };
}

const defaultRoute = createRouter(chatData.intents, defaults);
export function routeChatMessage(text: string, options: { hasSession: boolean }) {
  return defaultRoute(text, options);
}

export function getChatUi(): ChatUi {
  return {
    hintBeforeAnalysis: uiData.hintBeforeAnalysis,
    hintAfterAnalysis: uiData.hintAfterAnalysis,
    headerHint: uiData.headerHint,
    emptyAnswerFallback: uiData.emptyAnswerFallback,
    inputPlaceholder: uiData.inputPlaceholder,
    inputPlaceholderBeforeAnalysis: uiData.inputPlaceholderBeforeAnalysis,
    chipsBeforeAnalysis: [...uiData.chipsBeforeAnalysis],
    chipsAfterAnalysis: [...uiData.chipsAfterAnalysis],
    typingDelayMs: defaults.typingDelayMs,
  };
}

export function getNoSessionFallback(): string {
  return expandPlaceholders(defaults.noSessionFallback);
}
