import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Word selects rFonts.eastAsia for CJK independently of ascii/hAnsi. A CSS
// fallback list cannot express this when the Latin font also has CJK glyphs.
// Keep text and the renderer's kinsoku guards intact; only assign the font slot.
export function renderScriptText(text) {
  const value = this.applyCjkLineBreakGuards(text);
  const pattern = /(?:[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef][\p{Mark}\u2060]*)+/gu;
  const children = [];
  let end = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > end) children.push(value.slice(end, match.index));
    children.push(this.h({
      tagName: 'span',
      style: { font: 'inherit', 'font-family': 'var(--gw-eastasia-font, inherit)' },
      children: [match[0]],
    }));
    end = match.index + match[0].length;
  }
  if (!children.length) return this.h(value);
  if (end < value.length) children.push(value.slice(end));
  // Explicit inheritance avoids paragraph span selectors resetting run bold,
  // size or italics on the extra inline nodes.
  return this.h({ tagName: 'span', style: { font: 'inherit' }, children });
}

export function applyScriptFontPatch(source, name) {
  const pairs = [
    ['var g=[a,n].filter(e=>e).flatMap(e=>f(e,d));',
      's?t["--gw-eastasia-font"]=(0,p.eastAsianFontFamilyStack)(s,d).join(", "):h&&(t["--gw-eastasia-font"]=h.startsWith("var(")?h:(0,p.encloseFontFamily)(h));var g=[a,n].filter(e=>e).flatMap(e=>f(e,d));'],
    ['renderText(e){return this.h(this.applyCjkLineBreakGuards(e.text))}',
      `renderText(e){return (${renderScriptText.toString()}).call(this,e.text)}`],
  ];
  for (const [before, after] of pairs) {
    if (source.includes(after)) continue;
    if (source.split(before).length !== 2) throw new Error(`Script font patch target changed: ${name}`);
    source = source.replace(before, after);
  }
  return source;
}

export async function patchScriptFonts() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../node_modules/@file-viewer/docx');
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (pkg.version !== '0.3.27') throw new Error('Review script font patch before upgrading @file-viewer/docx');
  for (const name of ['docx-preview.mjs', 'docx-preview.js', 'docx-preview.worker.js']) {
    const path = resolve(root, 'dist', name);
    const source = await readFile(path, 'utf8');
    const patched = applyScriptFontPatch(source, name);
    if (patched !== source) await writeFile(path, patched, 'utf8');
  }
}
