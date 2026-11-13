import rawMenu from '../data/chatMenu.json';
import { MAX_FILE_SIZE_MB, MAX_DURATION_SEC, ALLOWED_FORMATS } from '../data/uploadLimits';

export type ChatOption = { id: string; label: string; type: 'menu'|'answer'|'report'; when?: 'any'|'session'|'noSession'; target?: string; reply?: string; replyNoSession?: string; action?: 'openDiary'|'openPhrases'; next?: string; section?: 'vocabulary'|'idioms'|'wordChoices'|'sentences'|'tone'|'creative'; enabled?: boolean };
export type MenuValidationError = { menuId: string; optionId?: string; message: string };
export type ValidatedMenu = { settings: Record<string, any>; menus: Record<string, { prompt: string; options: ChatOption[] }>; errors: MenuValidationError[]; questionCount: number; skippedOptionCount: number };
const validTypes = ['menu', 'answer', 'report'];
const validWhens = ['any', 'session', 'noSession'];
const validActions = ['openDiary', 'openPhrases'];
const validSections = ['vocabulary', 'idioms', 'wordChoices', 'sentences', 'tone', 'creative'];
const knownPlaceholders = ['maxFileSizeMB', 'maxDurationSec', 'allowedFormats', 'temperature', 'level', 'language'];
const menuUnavailableOption: ChatOption = { id: 'menu-unavailable', label: 'Menu unavailable.', type: 'answer', reply: 'Menu unavailable.' };

export function validateMenu(json: any): ValidatedMenu {
  const sourceMenus = json?.menus && typeof json.menus === 'object' ? json.menus : {};
  const rootMenu = typeof json?.settings?.rootMenu === 'string' ? json.settings.rootMenu : 'root';
  const errors: MenuValidationError[] = [];
  const cleaned: ValidatedMenu['menus'] = {};
  const seen = new Set<string>();
  let questionCount = 0;
  let skippedOptionCount = 0;

  for (const [menuId, menu] of Object.entries<any>(sourceMenus)) {
    const options: ChatOption[] = [];
    if (!menu || typeof menu !== 'object' || !Array.isArray(menu.options)) {
      errors.push({ menuId, message: 'Menu must contain an options array.' });
      cleaned[menuId] = { prompt: '', options };
      continue;
    }
    if (typeof menu.prompt === 'string') for (const [, placeholder] of menu.prompt.matchAll(/{{([^{}]+)}}/g)) if (!knownPlaceholders.includes(placeholder)) errors.push({ menuId, message: `unknown placeholder "{{${placeholder}}}" in prompt` });
    for (const [index, option] of menu.options.entries()) {
      const optionId = typeof option?.id === 'string' ? option.id : undefined;
      const issues: string[] = [];
      if (!optionId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(optionId)) issues.push('missing or invalid kebab-case id');
      else if (seen.has(optionId)) issues.push('duplicate id');
      if (optionId) seen.add(optionId);
      if (!option || typeof option.label !== 'string' || !option.label.trim()) issues.push('missing label');
      if (!option || !validTypes.includes(option.type)) issues.push(`unknown type "${option?.type ?? ''}"`);
      if (option?.when !== undefined && !validWhens.includes(option.when)) issues.push(`unknown when "${option.when}"`);
      if (option?.action !== undefined && !validActions.includes(option.action)) issues.push(`unknown action "${option.action}"`);
      if (option?.type === 'menu') {
        if (typeof option.target !== 'string' || !option.target) issues.push('missing target menu');
        else if (!Object.prototype.hasOwnProperty.call(sourceMenus, option.target)) issues.push(`target menu "${option.target}" does not exist`);
      }
      if (option?.type === 'answer' && (typeof option.reply !== 'string' || !option.reply.trim())) issues.push('missing reply');
      if (option?.type === 'answer' && option.replyNoSession !== undefined && typeof option.replyNoSession !== 'string') issues.push('replyNoSession must be text');
      if (option?.type === 'report') {
        if (!option.section) issues.push('missing section');
        else if (!validSections.includes(option.section)) issues.push(`unknown section "${option.section}"`);
      }
      if (option?.next !== undefined && (typeof option.next !== 'string' || !Object.prototype.hasOwnProperty.call(sourceMenus, option.next))) issues.push(`next menu "${option.next}" does not exist`);
      const replies = [option?.label, option?.reply, option?.replyNoSession].filter((value) => typeof value === 'string').join('\n');
      for (const [, placeholder] of replies.matchAll(/{{([^{}]+)}}/g)) if (!knownPlaceholders.includes(placeholder)) issues.push(`unknown placeholder "{{${placeholder}}}"`);
      if (option?.enabled !== undefined && typeof option.enabled !== 'boolean') issues.push('enabled must be a boolean');
      if (issues.length) {
        const message = `option ${index + 1}: ${[...new Set(issues)].join('; ')}`;
        errors.push({ menuId, ...(optionId ? { optionId } : {}), message });
        skippedOptionCount++;
        if (import.meta.env?.DEV) console.warn(`[chatMenu] ${menuId}/${optionId || `#${index + 1}`}: ${message}`);
        continue;
      }
      if (option.enabled === false) continue;
      options.push({ ...option, when: option.when || 'any' } as ChatOption);
      questionCount++;
    }
    cleaned[menuId] = { prompt: typeof menu.prompt === 'string' ? menu.prompt : '', options };
  }
  for (const [setting, value] of Object.entries<any>(json?.settings || {})) if (typeof value === 'string') for (const [, placeholder] of value.matchAll(/{{([^{}]+)}}/g)) if (!knownPlaceholders.includes(placeholder)) errors.push({ menuId: 'settings', message: `unknown placeholder "{{${placeholder}}}" in ${setting}` });

  if (!cleaned[rootMenu]?.options.length) {
    errors.push({ menuId: rootMenu, message: 'Root menu is missing or has no valid options; using the built-in fallback.' });
    cleaned[rootMenu] = { prompt: '', options: [{ ...menuUnavailableOption }] };
  }

  const reachable = new Set<string>();
  const visit = (menuId: string) => {
    if (reachable.has(menuId) || !cleaned[menuId]) return;
    reachable.add(menuId);
    for (const option of cleaned[menuId].options) {
      if (option.type === 'menu' && option.target) visit(option.target);
      if (option.next) visit(option.next);
    }
  };
  visit(rootMenu);
  for (const menuId of Object.keys(sourceMenus)) if (!reachable.has(menuId)) errors.push({ menuId, message: 'Menu is unreachable from the root menu.' });

  return { settings: json?.settings && typeof json.settings === 'object' ? json.settings : { rootMenu }, menus: cleaned, errors, questionCount, skippedOptionCount };
}

export function createMenu(json: any) { return validateMenu(json); }
const data = validateMenu(rawMenu);
export function getMenu(menuId: string, options: { hasSession: boolean }) {
  const menu = data.menus[menuId] || data.menus[data.settings.rootMenu] || data.menus.root || { prompt: '', options: [menuUnavailableOption] };
  return { ...menu, options: menu.options.filter((option) => !option.when || option.when === 'any' || (option.when === 'session') === options.hasSession) };
}
export function resolveReply(option: ChatOption, context: { hasSession: boolean; temperature: number; level: string; language: string }) {
  const values: Record<string, string|number> = { temperature: context.temperature, level: context.level, language: context.language, maxFileSizeMB: MAX_FILE_SIZE_MB, maxDurationSec: MAX_DURATION_SEC, allowedFormats: ALLOWED_FORMATS };
  return String(context.hasSession ? option.reply : option.replyNoSession || option.reply || 'Menu unavailable.').replace(/{{(\w+)}}/g, (_match, key) => String(values[key] ?? ''));
}
export function formatReportSection(section: string, report: any): string {
  const i = report?.improvements || {};
  const empty = data.settings.emptyReportReply || 'Menu unavailable.';
  if (section === 'vocabulary') return (i.vocabulary_upgrades || []).slice(0, 5).map((x: any) => `- **${x.word}**${x.reading ? ` (${x.reading})` : ''} — ${x.meaning}. _"${x.example}"_`).join('\n') || empty;
  if (section === 'idioms') return (i.phrase_upgrades || []).slice(0, 5).map((x: any) => `- **${x.idiom_or_phrase}** — ${x.meaning}. _"${x.upgraded}"_`).join('\n') || empty;
  if (section === 'wordChoices') return (i.word_choices || []).slice(0, 5).map((x: any) => `- ~~${x.original}~~ → **${x.better}** — ${x.reason}`).join('\n') || empty;
  if (section === 'sentences') return (i.sentence_structure || []).length ? `| ${data.settings.sentenceTableYouSaid || 'Menu unavailable.'} | ${data.settings.sentenceTableBetter || 'Menu unavailable.'} |\n|---|---|\n${i.sentence_structure.slice(0, 5).map((x: any) => `| ${x.original} | ${x.improved} |`).join('\n')}` : empty;
  if (section === 'tone') return i.tone ? `**${i.tone.label}** — ${i.tone.reason}` : empty;
  if (section === 'creative') return (i.creative_rewrite?.items || []).slice(0, 3).map((x: any) => `- ${x.original} → **${x.rewrite}**`).join('\n') || empty;
  return 'Menu unavailable.';
}
export const chatMenuSettings = data.settings;
