import { describe, it, expect } from 'vitest';
import { createMenu, formatReportSection, getMenu, resolveReply, validateMenu } from './chatMenu';
import menuJson from '../data/chatMenu.json';

describe('chat menu', () => {
  it('filters session options and keeps configured routes valid', () => {
    expect(getMenu('root', { hasSession: false }).options.every((option: any) => option.when !== 'session')).toBe(true);
    expect(getMenu('root', { hasSession: true }).options.some((option: any) => option.section === 'vocabulary')).toBe(true);
    expect(createMenu(menuJson).menus.root.options.length).toBeGreaterThan(0);
    expect(validateMenu(menuJson).errors).toEqual([]);
    expect(validateMenu(menuJson).skippedOptionCount).toBe(0);
    const menus = createMenu(menuJson).menus;
    const all = Object.values<any>(menus).flatMap((menu: any) => menu.options);
    expect(new Set(all.map((option: any) => option.id)).size).toBe(all.length);
    expect(all.filter((option: any) => option.type === 'menu').every((option: any) => !!menus[option.target])).toBe(true);
    expect(menuJson._help.split('\n')).toHaveLength(10);
    expect(JSON.stringify(menuJson)).not.toMatch(/gemini|ai response|typing options/i);
  });
  it('resolves configured placeholders', () => {
    expect(resolveReply({ id: 'a', label: 'a', type: 'answer', reply: '{{level}} {{language}} {{temperature}}' }, { hasSession: true, level: 'N5', language: 'Japanese', temperature: 0.7 })).toBe('N5 Japanese 0.7');
  });
  it('skips malformed data and formats report sections with an empty fallback', () => {
    const malformed = createMenu({ settings: { rootMenu: 'r' }, menus: { r: { options: [{ id: 'bad', label: 'oops', type: 'answer' }] } } });
    expect(malformed.menus.r.options[0].label).toBe('Menu unavailable.');
    expect(malformed.errors.some((error) => error.menuId === 'r' && error.optionId === 'bad' && error.message.includes('missing reply'))).toBe(true);
    for (const section of ['vocabulary','idioms','wordChoices','sentences','tone','creative']) expect(formatReportSection(section, {})).toBe('Nothing to show for this yet.');
  });
  it('formats populated report sections', () => {
    const report = { improvements: { vocabulary_upgrades: [{ word: '学校', reading: 'がっこう', meaning: 'school', example: '学校へ行く。' }], phrase_upgrades: [{ idiom_or_phrase: 'on time', meaning: 'punctually', upgraded: 'I arrived on time.' }], word_choices: [{ original: 'said', better: 'explained', reason: 'More exact.' }], sentence_structure: [{ original: 'I go.', improved: 'I went.', explanation: 'Past tense.' }], tone: { label: 'calm', reason: 'Steady voice.' }, creative_rewrite: { items: [{ original: 'I went.', rewrite: 'Off I went!', style_note: 'More lively.' }] } } };
    expect(formatReportSection('vocabulary', report)).toContain('**学校** (がっこう)');
    expect(formatReportSection('idioms', report)).toContain('**on time**');
    expect(formatReportSection('wordChoices', report)).toContain('**explained**');
    expect(formatReportSection('sentences', report)).toContain('| I went. |');
    expect(formatReportSection('tone', report)).toContain('**calm**');
    expect(formatReportSection('creative', report)).toContain('**Off I went!**');
  });
});
