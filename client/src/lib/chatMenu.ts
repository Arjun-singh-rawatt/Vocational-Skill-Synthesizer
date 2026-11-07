import rawMenu from '../data/chatMenu.json';
import { MAX_FILE_SIZE_MB, MAX_DURATION_SEC, ALLOWED_FORMATS } from '../data/uploadLimits';

export type ChatOption = { id: string; label: string; type: 'menu'|'answer'|'report'; when?: 'any'|'session'|'noSession'; target?: string; reply?: string; replyNoSession?: string; action?: 'openDiary'|'openPhrases'; next?: string; section?: 'vocabulary'|'idioms'|'wordChoices'|'sentences'|'tone'|'creative' };
export function createMenu(json: any) {
  const menus = json?.menus || {};
  const validIds = new Set<string>();
  for (const menu of Object.values<any>(menus)) for (const o of menu?.options || []) if (o?.enabled !== false && typeof o.id === 'string') validIds.add(o.id);
  const cleaned: Record<string, any> = {};
  const seen = new Set<string>();
  for (const [key, menu] of Object.entries<any>(menus)) {
    const options = (menu?.options || []).filter((o: any) => {
      const valid = o && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.id) && !seen.has(o.id) && o.enabled !== false && typeof o.label === 'string' && ['menu','answer','report'].includes(o.type) && ['any','session','noSession',undefined].includes(o.when) && (o.type !== 'menu' || typeof o.target === 'string' && menus[o.target]) && (o.type !== 'answer' || typeof o.reply === 'string') && (o.type !== 'report' || ['vocabulary','idioms','wordChoices','sentences','tone','creative'].includes(o.section)) && (!o.next || !!menus[o.next]) && (!o.action || ['openDiary','openPhrases'].includes(o.action));
      if (!valid && import.meta.env?.DEV) console.warn('[chatMenu] Skipping invalid menu option', o?.id);
      if (valid) seen.add(o.id);
      return valid;
    });
    cleaned[key] = { prompt: menu?.prompt || '', options };
  }
  const root = json?.settings?.rootMenu || 'root';
  if (!cleaned[root]?.options?.length) cleaned[root] = { prompt: 'What would you like help with?', options: [{ id: 'menu-unavailable', label: 'Menu unavailable.', type: 'answer', reply: 'Menu unavailable.' }] };
  return { settings: json.settings || {}, menus: cleaned };
}
const data = createMenu(rawMenu);
export function getMenu(menuId: string, options: { hasSession: boolean }) { const menu = data.menus[menuId] || data.menus[data.settings.rootMenu] || data.menus.root!; return { ...menu, options: menu.options.filter((o: ChatOption) => !o.when || o.when === 'any' || (o.when === 'session') === options.hasSession) }; }
export function resolveReply(option: ChatOption, context: { hasSession: boolean; temperature: number; level: string; language: string }) { const values: Record<string, string|number> = { temperature: context.temperature, level: context.level, language: context.language, maxFileSizeMB: MAX_FILE_SIZE_MB, maxDurationSec: MAX_DURATION_SEC, allowedFormats: ALLOWED_FORMATS }; return String(context.hasSession ? option.reply : option.replyNoSession || option.reply || '').replace(/{{(temperature|level|language|maxFileSizeMB|maxDurationSec|allowedFormats)}}/g, (_m, key) => String(values[key] ?? '')); }
export function formatReportSection(section: string, report: any): string { const i = report?.improvements || {}; const empty = 'Nothing to show for this yet.'; if (section === 'vocabulary') return (i.vocabulary_upgrades || []).slice(0,5).map((x:any)=>`- **${x.word}**${x.reading ? ` (${x.reading})` : ''} — ${x.meaning}. _"${x.example}"_`).join('\n') || empty; if(section==='idioms') return (i.phrase_upgrades||[]).slice(0,5).map((x:any)=>`- **${x.idiom_or_phrase}** — ${x.meaning}. _"${x.upgraded}"_`).join('\n') || empty; if(section==='wordChoices') return (i.word_choices||[]).slice(0,5).map((x:any)=>`- ~~${x.original}~~ → **${x.better}** — ${x.reason}`).join('\n') || empty; if(section==='sentences') return (i.sentence_structure||[]).slice(0,5).map((x:any)=>`| ${x.original} | ${x.improved} |`).join('\n') ? `| You said | Better |\n|---|---|\n${(i.sentence_structure||[]).slice(0,5).map((x:any)=>`| ${x.original} | ${x.improved} |`).join('\n')}` : empty; if(section==='tone') return i.tone ? `**${i.tone.label}** — ${i.tone.reason}` : empty; if(section==='creative') return (i.creative_rewrite?.items||[]).slice(0,3).map((x:any)=>`- ${x.original} → **${x.rewrite}**`).join('\n') || empty; return empty; }
export const chatMenuSettings = data.settings;
