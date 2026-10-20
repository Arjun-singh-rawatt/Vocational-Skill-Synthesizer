import chatData from '../data/chatIntents.json';
import { createRouter, getChatUi, getNoSessionFallback, getSuggestionsForIntent, routeChatMessage, validateIntents } from './chatRouter';

describe('chat intent data', () => {
  it('contains valid enabled intents, known placeholders, and no short phrases', () => {
    const enabled = chatData.intents.filter((intent) => intent.enabled);
    const valid = validateIntents(chatData.intents);
    expect(valid.map((intent) => intent.id)).toEqual(enabled.map((intent) => intent.id));
    expect(new Set(enabled.map((intent) => intent.id)).size).toBe(enabled.length);
    const allowed = new Set(['maxFileSizeMB', 'maxDurationSec', 'allowedFormats']);
    for (const intent of enabled) {
      expect(intent.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(intent.reply.trim()).not.toBe('');
      expect(intent.when === undefined || ['any', 'session', 'noSession'].includes(intent.when)).toBe(true);
      expect(intent).not.toHaveProperty('action');
      expect(Boolean(intent.match.exact?.length || intent.match.phrases?.length || intent.match.keywords?.length)).toBe(true);
      for (const phrase of intent.match.phrases || []) expect(phrase.trim().length).toBeGreaterThanOrEqual(3);
      for (const text of [intent.reply, intent.replyNoSession || '']) {
        for (const [, name] of text.matchAll(/\{\{([^{}]+)\}\}/g)) expect(allowed.has(name)).toBe(true);
      }
    }
  });

  it('matches two or more phrases from every intent including its Hinglish variants', () => {
    for (const intent of chatData.intents.filter((entry) => entry.enabled)) {
      const examples = [...(intent.match.exact || []), ...(intent.match.phrases || [])];
      expect(examples.length, `${intent.id} should have at least two example phrasings`).toBeGreaterThanOrEqual(2);
      const hasSession = intent.when === 'session';
      const route = createRouter([intent], chatData.settings);
      for (const example of examples) expect(route(example, { hasSession })?.id).toBe(intent.id);
    }
  });

  it('chooses session-specific text replies and never returns UI actions', () => {
    for (const intent of chatData.intents.filter((item) => item.enabled && item.replyNoSession)) {
      const example = [...(intent.match.exact || []), ...(intent.match.phrases || [])][0];
      expect(routeChatMessage(example, { hasSession: false })?.reply).not.toBe(routeChatMessage(example, { hasSession: true })?.reply);
    }
    for (const [message, guidance] of [
      ['diary', 'My Diary'],
      ['show my saved words', 'My Diary'],
      ['idioms', 'Phrases / Quote'],
      ['where are my phrases?', 'Phrases / Quote'],
    ]) {
      const result = routeChatMessage(message, { hasSession: false });
      expect(result?.reply).toContain(guidance);
      expect(result).not.toHaveProperty('action');
    }
  });

  it('provides navigation guidance without actions while leaving personal-speech questions and overlong questions for other handling', () => {
    expect(routeChatMessage('Idioms I can use', { hasSession: true })?.reply).toContain('Phrases / Quote');
    expect(routeChatMessage('give me vocabulary about temperature', { hasSession: true })?.reply).toContain('My Diary');
    expect(routeChatMessage('what did I say wrong in my video', { hasSession: true })).toBeNull();
    expect(routeChatMessage(Array(15).fill('hello').join(' '), { hasSession: false })).toBeNull();
  });

  it('answers every pre-analysis chip locally and exposes the configured fallback', () => {
    for (const chip of getChatUi().chipsBeforeAnalysis) expect(routeChatMessage(chip, { hasSession: false })).not.toBeNull();
    expect(getNoSessionFallback()).toContain('My Diary');
    expect(getChatUi().typingDelayMs).toBe(350);
  });

  it('keeps two contextual next-question suggestions available through repeated cycles', () => {
    expect(getChatUi().chipsBeforeAnalysis).toEqual(['How do I upload a video or audio?', 'How does temperature work?']);
    expect(getSuggestionsForIntent('how-to-upload', false)).toEqual(['How does temperature work?', 'How do I save vocabulary?']);
    expect(getSuggestionsForIntent('temperature', false)).toEqual(['How do I re-evaluate my recording?', 'Where can I find my saved phrases?']);
    expect(getSuggestionsForIntent(undefined, true)).toEqual(getChatUi().chipsAfterAnalysis);
    expect(routeChatMessage('How do I save vocabulary?', { hasSession: false })?.id).toBe('saved-words-diary');
    expect(routeChatMessage('How do I re-evaluate my recording?', { hasSession: true })?.id).toBe('reevaluate');
  });

  it('allows adding an intent through data and skips malformed entries without throwing', () => {
    const settings = { ...chatData.settings, maxWords: 14 };
    const route = createRouter([
      { id: 'new-howto', enabled: true, match: { phrases: ['how do i try this'] }, reply: 'A new editable answer.' },
      { id: 'bad-entry', enabled: true, match: {}, reply: '' },
    ], settings);
    expect(() => route('how do i try this', { hasSession: false })).not.toThrow();
    expect(route('how do i try this', { hasSession: false })?.reply).toBe('A new editable answer.');
    expect(route('something else', { hasSession: false })).toBeNull();
  });

  it('requires a help cue for keywords except when the message is only the keyword', () => {
    const route = createRouter([
      { id: 'vocabulary-help', enabled: true, match: { keywords: ['vocab*'] }, reply: 'Vocabulary help.' },
    ], chatData.settings);
    expect(route('vocabulary', { hasSession: false })?.id).toBe('vocabulary-help');
    expect(route('give me vocabulary', { hasSession: false })).toBeNull();
    expect(route('how do I find vocabulary', { hasSession: false })?.id).toBe('vocabulary-help');
  });
});
