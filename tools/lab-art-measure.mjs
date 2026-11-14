#!/usr/bin/env node
// Measure Space Grotesk in Chrome and write lab/kit/art/metrics.js: the advance width of every printable
// ASCII character (plus the arrows and signs the lessons use) at weights 500 and 700, in thousandths of
// an em. Label placement reads these instead of guessing a width per character (art direction, section 3).
// Never shipped (tools/ is export-ignore). Usage: node tools/lab-art-measure.mjs
import { createRequire } from 'module';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM || path.join(os.homedir(), 'aa-main', 'node_modules'), '/'));
const { chromium } = require('playwright-core');
const root = new URL('..', import.meta.url).pathname;

const EXTRA = [0x2191, 0x2193, 0x2192, 0x2190, 0x2194, 0xb0, 0xd7, 0x2212, 0xb7];
const chars = [...Array.from({ length: 95 }, (_, i) => 32 + i), ...EXTRA].map(c => String.fromCharCode(c));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=block"><svg width="10" height="10"><text id="t" font-family="Space Grotesk" font-size="1000"></text></svg>`);
await page.evaluate(() => Promise.all([document.fonts.load('500 20px "Space Grotesk"'), document.fonts.load('700 20px "Space Grotesk"')]));
const ok = await page.evaluate(() => document.fonts.check('700 20px "Space Grotesk"'));
if (!ok) { console.error('Space Grotesk did not load'); process.exit(1); }
const out = {};
for (const w of [500, 700]) {
  out[w] = await page.evaluate(([chars, w]) => {
    const t = document.getElementById('t');
    t.setAttribute('font-weight', w);
    return chars.map(ch => { t.textContent = ch === ' ' ? 'a a' : ch; const n = t.getComputedTextLength(); if (ch !== ' ') return Math.round(n); t.textContent = 'aa'; return Math.round(n - t.getComputedTextLength()); });
  }, [chars, w]);
}
await browser.close();
const body = `// Space Grotesk advance widths in thousandths of an em, measured in Chrome by tools/lab-art-measure.mjs
// (do not edit by hand). CHARS lists the characters; W500 and W700 hold one width per character.
export const CHARS = ${JSON.stringify(chars.join(''))};
export const W500 = ${JSON.stringify(out[500])};
export const W700 = ${JSON.stringify(out[700])};
`;
fs.writeFileSync(root + 'lab/kit/art/metrics.js', body);
console.log(`wrote lab/kit/art/metrics.js (${chars.length} characters, "Mitral valve" at 700: ${[...'Mitral valve'].reduce((s, c) => s + out[700][chars.indexOf(c)], 0) * 18 / 1000} units at 18)`);
