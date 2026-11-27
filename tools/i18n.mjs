// Extra app languages (ru, de, ar, fr, es). Turkish and English live in app.js / istanbul.json; other
// languages are translations of the English text, kept in tools/i18n/<lang>.json and built into data/i18n/<lang>.json.
//
//   node tools/i18n.mjs source        -> writes tools/i18n/source.json (all English texts, in a fixed order)
//   node tools/i18n.mjs build [lang]  -> checks tools/i18n/<lang>.json against the source and writes data/i18n/<lang>.json
//
// tools/i18n/<lang>.json looks like { "ui": { "<UI key>": "text" }, "content": ["text for source.content[0]", ...] }.
// A missing text falls back to English in the app. {placeholders} must be kept exactly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['ru', 'de', 'ar', 'fr', 'es'];

function uiStrings() {
  const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const s = src.indexOf('var UI = {'), e = src.indexOf('\n};', s);
  const UI = (0, eval)('(' + src.slice(s + 'var UI = '.length, e + 2) + ')');
  const out = {};
  Object.keys(UI).forEach((k) => { out[k] = UI[k].en; });
  return out;
}
// English content the tourist sees: places, routes, categories, the first-aid kit and the phrasebook.
// Street markets are left in English for now (local information, long texts).
function contentStrings() {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'data', 'istanbul.json'), 'utf8'));
  const seen = new Set(), out = [];
  const add = (x) => { if (typeof x === 'string' && x.trim() && !seen.has(x)) { seen.add(x); out.push(x); } };
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') { if (typeof v.en === 'string' && 'tr' in v) add(v.en); else Object.values(v).forEach(walk); }
  };
  walk(d.categories); walk(d.places); walk(d.routes); walk(d.help.sections);
  d.help.phraseGroups.forEach((g) => { add(g.title.en); g.phrases.forEach((p) => add(p.en)); });
  // Texts written in app.js itself (palette, level and badge names), added last so earlier positions stay the same.
  const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const a = src.indexOf('var UI = {'), b = src.indexOf('\n};', a);
  const outside = src.slice(0, a) + src.slice(b);
  (outside.match(/\{ ?tr: '[^']*', en: '[^']*'/g) || []).forEach((m) => {
    const en = m.match(/en: '([^']*)'/)[1];
    if (!/^[a-z]{2}-[A-Z]{2}$/.test(en) && en !== 'English') add(en);
  });
  return out;
}
const holes = (s) => (String(s).match(/\{[a-z]+\}/gi) || []).sort().join(',');

const cmd = process.argv[2];
if (cmd === 'source') {
  fs.mkdirSync(path.join(root, 'tools', 'i18n'), { recursive: true });
  const src = { ui: uiStrings(), content: contentStrings() };
  fs.writeFileSync(path.join(root, 'tools', 'i18n', 'source.json'), JSON.stringify(src, null, 1));
  console.log(Object.keys(src.ui).length + ' UI texts, ' + src.content.length + ' content texts -> tools/i18n/source.json');
} else if (cmd === 'build') {
  const src = { ui: uiStrings(), content: contentStrings() };
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'i18n', 'source.json'), 'utf8'));
  for (const lang of process.argv[3] ? [process.argv[3]] : LANGS) {
    const f = path.join(root, 'tools', 'i18n', lang + '.json');
    if (!fs.existsSync(f)) { console.log(lang + ': no translation file yet'); continue; }
    const tr = JSON.parse(fs.readFileSync(f, 'utf8')), problems = [];
    const ui = {};
    Object.keys(src.ui).forEach((k) => {
      const v = tr.ui && tr.ui[k];
      if (v === undefined) { problems.push('missing ui ' + k); return; }
      if (holes(v) !== holes(src.ui[k])) problems.push('placeholders differ in ui ' + k);
      ui[k] = v;
    });
    // content is translated by position in the saved source list; map it by the English text
    const content = {};
    (tr.content || []).forEach((v, i) => { if (saved.content[i] !== undefined && v) content[saved.content[i]] = v; });
    src.content.forEach((en) => { if (!content[en]) problems.push('missing content: ' + en.slice(0, 50)); });
    fs.mkdirSync(path.join(root, 'data', 'i18n'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'i18n', lang + '.json'), JSON.stringify({ ui, content }));
    console.log(lang + ': ' + Object.keys(ui).length + ' UI, ' + Object.keys(content).length + ' content' + (problems.length ? ', ' + problems.length + ' problems:\n  ' + problems.slice(0, 15).join('\n  ') : ', OK'));
  }
} else {
  console.log('usage: node tools/i18n.mjs source | build [lang]');
}
