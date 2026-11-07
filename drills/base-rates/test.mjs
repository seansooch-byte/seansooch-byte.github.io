import { createRequire } from 'module';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const app = require('./app.js');
const fixtures = JSON.parse(readFileSync(join(here, 'fixtures.json'), 'utf8'));
const casesFile = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));

let failed = 0;
function check(cond, message) {
  if (!cond) {
    failed += 1;
    console.error('FAIL ' + message);
  }
}

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}
function frac(n, d) {
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return [n / g, d / g];
}
function parseFrac(value) {
  if (value === null) return null;
  const parts = String(value).split('/');
  const n = BigInt(parts[0]);
  const d = parts.length > 1 ? BigInt(parts[1]) : 1n;
  return frac(n, d);
}
function sameFrac(a, b) {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}
function add(a, b) { return frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); }
function sub(a, b) { return frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); }
function mul(a, b) { return frac(a[0] * b[0], a[1] * b[1]); }
function div(a, b) { return frac(a[0] * b[1], a[1] * b[0]); }
function isZero(a) { return a[0] === 0n; }
const ONE = [1n, 1n];

function rationalMetrics(se, sp, p, rrr) {
  const tp = mul(se, p);
  const fp = mul(sub(ONE, sp), sub(ONE, p));
  const fn = mul(sub(ONE, se), p);
  const tn = mul(sp, sub(ONE, p));
  const positives = add(tp, fp);
  const negatives = add(tn, fn);
  const ppv = isZero(positives) ? null : div(tp, positives);
  const npv = isZero(negatives) ? null : div(tn, negatives);
  const nne = ppv && !isZero(ppv) ? div(ONE, ppv) : null;
  const nnt = ppv && !isZero(ppv) && !isZero(rrr) ? div(ONE, mul(ppv, rrr)) : null;
  const riskFlagged = ppv;
  const riskClear = npv === null ? null : sub(ONE, npv);
  return { ppv, npv, nne, nnt, riskFlagged, riskClear };
}

function asNumber(value) {
  if (value === null) return null;
  return Number(value[0]) / Number(value[1]);
}

function close(actual, expected, label) {
  if (expected === null) {
    check(actual === null, label + ' expected null, got ' + actual);
    return;
  }
  check(typeof actual === 'number' && Number.isFinite(actual), label + ' is not finite: ' + actual);
  if (typeof actual !== 'number') return;
  const tol = Math.max(1e-9, Math.abs(expected) * 1e-9);
  check(Math.abs(actual - expected) <= tol, label + ' got ' + actual + ' expected ' + expected);
}

function expectRow(row) {
  const se = parseFrac(row.se);
  const sp = parseFrac(row.sp);
  const p = parseFrac(row.p);
  const rrr = parseFrac(row.rrr);
  const rational = rationalMetrics(se, sp, p, rrr);
  for (const key of ['ppv', 'npv', 'nne', 'nnt', 'riskFlagged', 'riskClear']) {
    check(sameFrac(rational[key], parseFrac(row[key])), row.id + ' ' + key + ' fixture ' + row[key] + ' rational ' + (rational[key] ? rational[key].join('/') : null));
  }
  const metrics = app.compute(asNumber(se), asNumber(sp), asNumber(p), asNumber(rrr));
  for (const key of ['ppv', 'npv', 'nne', 'nnt', 'riskFlagged', 'riskClear']) {
    close(metrics[key], asNumber(rational[key]), row.id + ' app ' + key);
  }
  const view = app.viewModel(asNumber(se), asNumber(sp), asNumber(p), asNumber(rrr));
  for (const key of ['ppv', 'npv', 'nne', 'nnt', 'riskFlagged', 'riskClear']) {
    check(view.text[key] === row.display[key], row.id + ' display ' + key + ' got ' + view.text[key] + ' expected ' + row.display[key]);
    check(!String(view.text[key]).includes('NaN') && !String(view.text[key]).includes('Infinity'), row.id + ' ' + key + ' text is not a number');
  }
  const sum = view.counts.tp + view.counts.fn + view.counts.fp + view.counts.tn;
  check(sum === 1000, row.id + ' counts sum ' + sum);
  check(view.kinds.length === 1000, row.id + ' icons ' + view.kinds.length);
  check(view.summary.indexOf('NaN') === -1, row.id + ' summary has NaN');
  return view;
}

check(fixtures.cases.length === 10, 'ten case fixtures');
check(fixtures.workedChecks.length === 2, 'two worked checks');
check(casesFile.cases.length === 10, 'ten cases');

const seen = new Set();
for (const item of casesFile.cases) {
  check(!seen.has(item.id), 'duplicate id ' + item.id);
  seen.add(item.id);
  check(item.scenario.includes('fictional'), item.id + ' scenario says fictional');
  check((item.scenario.match(/\./g) || []).length === 1, item.id + ' scenario is one sentence');
  check(item.p >= 0.001 && item.p <= 0.3, item.id + ' prevalence inside 0.1% to 30%');
  const fixture = fixtures.cases.find((row) => row.id === item.id);
  check(fixture, 'fixture for ' + item.id);
  if (!fixture) continue;
  close(item.p, asNumber(parseFrac(fixture.p)), item.id + ' p matches fraction');
  close(item.se, asNumber(parseFrac(fixture.se)), item.id + ' se matches fraction');
  close(item.sp, asNumber(parseFrac(fixture.sp)), item.id + ' sp matches fraction');
  close(item.rrr, asNumber(parseFrac(fixture.rrr)), item.id + ' rrr matches fraction');
}
const prevalences = casesFile.cases.map((item) => item.p).sort((a, b) => a - b);
check(prevalences[0] === 0.001 && prevalences[prevalences.length - 1] === 0.3, 'prevalence reaches 0.1% and 30%');

for (const row of fixtures.cases) expectRow(row);
for (const row of fixtures.workedChecks) {
  const view = expectRow(row);
  check(view.text.ppv === row.published.ppv, row.id + ' published ppv');
  check(view.text.nne === row.published.nne, row.id + ' published nne');
  check(view.text.nnt === row.published.nnt, row.id + ' published nnt');
}
for (const row of fixtures.edges) expectRow(row);

const sp100 = app.viewModel(0.85, 1, 0.02, 0.25);
check(sp100.text.ppv === '100%', 'sp 100 prints 100%');
check(sp100.notes.some((note) => note.includes('Specificity is 100%') && note.includes('PPV is 100%')), 'sp 100 note');

const none = app.viewModel(0.85, 1, 0, 0.25);
check(none.text.ppv === 'Undefined', 'no positives PPV text');
check(none.text.ppv !== '100%', 'no positives is not 100%');
check(none.metrics.ppv === null, 'no positives PPV null');
check(none.notes.some((note) => note.includes('undefined') && note.includes('flags nobody')), 'no positives note');

const zeroPpv = app.viewModel(0.85, 0.9, 0, 0.25);
check(zeroPpv.text.ppv === '0%', 'zero true positives prints 0%');
check(zeroPpv.text.nne === 'Undefined' && zeroPpv.text.nnt === 'Undefined', 'zero PPV leaves NNE and NNT undefined');
check(zeroPpv.notes.some((note) => note.includes('0%') && note.includes('undefined')), 'zero PPV note');

const near = app.compute(0.85, 0.9, 1e-8, 0.25);
check(near.ppv !== null && near.ppv > 0 && near.ppv < 0.01 && Number.isFinite(near.nne) && Number.isFinite(near.nnt), 'prevalence near 0 stays finite and is not 100%');

for (const row of fixtures.iconChecks) {
  const split = app.countsPerThousand(asNumber(parseFrac(row.se)), asNumber(parseFrac(row.sp)), asNumber(parseFrac(row.p)));
  for (const key of ['tp', 'fn', 'fp', 'tn']) {
    check(split.counts[key] === row.counts[key], row.id + ' ' + key + ' got ' + split.counts[key] + ' expected ' + row.counts[key]);
  }
  const sum = split.counts.tp + split.counts.fn + split.counts.fp + split.counts.tn;
  check(sum === 1000, row.id + ' sum ' + sum);
  check(split.fractional === row.fractional, row.id + ' fractional flag');
  const view = app.viewModel(asNumber(parseFrac(row.se)), asNumber(parseFrac(row.sp)), asNumber(parseFrac(row.p)), 0.25);
  check(view.roundingNote === null || row.fractional, row.id + ' rounding note only when fractional');
  check(!row.fractional || (view.roundingNote && view.roundingNote.includes('not all whole numbers')), row.id + ' rounding sentence');
  const tallies = { tp: 0, fn: 0, fp: 0, tn: 0 };
  for (const kind of view.kinds) tallies[kind] += 1;
  for (const key of ['tp', 'fn', 'fp', 'tn']) {
    check(tallies[key] === view.counts[key], row.id + ' icons match table ' + key);
  }
}

const stops = [0.001, 0.01, 0.1, 0.5];
for (const stop of stops) {
  const index = app.sliderIndexForPrevalence(stop);
  check(app.prevalenceFromSlider(index) === stop, 'slider lands on ' + stop + ' from index ' + index);
}
check(app.prevalenceFromSlider(0) === 0.001, 'slider min is 0.1%');
check(app.prevalenceFromSlider(app.STEPS) === 0.5, 'slider max is 50%');

function expectedCounts(se, sp, p) {
  return {
    tp: 1000 * se * p,
    fn: 1000 * (1 - se) * p,
    fp: 1000 * (1 - sp) * (1 - p),
    tn: 1000 * sp * (1 - p)
  };
}
for (const item of casesFile.cases) {
  for (const p of stops.concat([item.p])) {
    const split = app.countsPerThousand(item.se, item.sp, p);
    const expected = expectedCounts(item.se, item.sp, p);
    const sum = split.counts.tp + split.counts.fn + split.counts.fp + split.counts.tn;
    check(sum === 1000, item.id + ' at ' + p + ' sums to ' + sum);
    let fractional = false;
    for (const key of ['tp', 'fn', 'fp', 'tn']) {
      check(Number.isInteger(split.counts[key]) && split.counts[key] >= 0, item.id + ' ' + key + ' integer');
      check(Math.abs(split.expected[key] - expected[key]) < 1e-6, item.id + ' expected ' + key);
      check(Math.abs(split.counts[key] - expected[key]) < 1, item.id + ' count near expected ' + key);
      if (Math.abs(expected[key] - Math.round(expected[key])) > 1e-6) fractional = true;
    }
    check(split.fractional === fractional, item.id + ' at ' + p + ' fractional flag');
    const view = app.viewModel(item.se, item.sp, p, item.rrr);
    const tallies = { tp: 0, fn: 0, fp: 0, tn: 0 };
    for (const kind of view.kinds) tallies[kind] += 1;
    for (const key of ['tp', 'fn', 'fp', 'tn']) check(tallies[key] === split.counts[key], item.id + ' icons ' + key);
    const blob = JSON.stringify(view.text) + view.notes.join(' ') + (view.roundingNote || '');
    check(blob.indexOf('NaN') === -1 && blob.indexOf('Infinity') === -1, item.id + ' at ' + p + ' has no NaN');
  }
}

check(app.parseGuess('').ok === false, 'blank guess rejected');
check(app.parseGuess('abc').ok === false, 'word guess rejected');
check(app.parseGuess('-1').ok === false, 'negative guess rejected');
check(app.parseGuess('101').ok === false, 'over 100 rejected');
check(app.parseGuess('1e2').ok === false, 'exponent rejected');
check(app.parseGuess('14.8').ok && app.parseGuess('14.8').value === 14.8, 'decimal guess');
check(app.parseGuess('14.8%').value === 14.8, 'percent sign stripped');
check(app.parseGuess('0').value === 0 && app.parseGuess('100').value === 100, 'bounds accepted');
const workedPpv = 17 / 115;
check(Math.abs(app.absoluteError(14.8, workedPpv) - Math.abs(14.8 - workedPpv * 100)) < 1e-9, 'absolute error is in percentage points');

const throwing = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); }
};
check(app.readScore(throwing).length === 0, 'readScore survives a throw');
app.writeScore(throwing, [1.25]);
const memory = new Map();
const storage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, value); }
};
app.writeScore(storage, [1.5, 2.5]);
check(app.readScore(storage).join(',') === '1.5,2.5', 'score round trip');
const saved = JSON.parse(memory.get(app.SCORE_KEY));
check(Object.keys(saved).join(',') === 'errors', 'storage holds only the score');
check(Math.abs(app.mean([1.5, 2.5]) - 2) < 1e-12, 'mean absolute error');
app.writeScore(storage, 'not-a-score');
check(app.readScore({ getItem() { return '{'; } }).length === 0, 'bad JSON is ignored');

const drillsRoot = join(here, '..');
const dose = new RegExp('\\b\\d+(?:\\.\\d+)?\\s*(?:mg|mcg|ug|ml|iu)\\b|\\b(?:' + 'milli' + 'gram|' + 'micro' + 'gram|' + 'dos' + 'age)\\b', 'i');
const emEntity = '&' + 'mdash;';
const enEntity = '&' + 'ndash;';
function hasBannedDash(text) {
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === 0x2012 || code === 0x2013 || code === 0x2014 || code === 0x2015 || code === 0x2212) return true;
  }
  return text.includes(emEntity) || text.includes(enEntity);
}
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}
for (const path of walk(drillsRoot, [])) {
  const text = readFileSync(path, 'utf8');
  check(!hasBannedDash(text), 'dash in ' + path);
  if (!path.endsWith('test.mjs')) check(!dose.test(text), 'dose pattern in ' + path);
}
function assetUrls(text) {
  const urls = [];
  for (const tag of text.match(/<link\b[^>]*>/g) || []) {
    if (!/rel=["']stylesheet["']/.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/);
    if (href) urls.push(href[1]);
  }
  for (const tag of text.match(/<script\b[^>]*>/g) || []) {
    const src = tag.match(/src=["']([^"']+)["']/);
    if (src) urls.push(src[1]);
  }
  return urls;
}
const pageText = readFileSync(join(here, 'index.html'), 'utf8') + '\n' + readFileSync(join(drillsRoot, 'index.html'), 'utf8') + '\n' + readFileSync(join(here, 'style.css'), 'utf8');
const urls = assetUrls(pageText);
check(urls.some((url) => url.startsWith('https://fonts.googleapis.com/')), 'font stylesheet is present');
for (const url of urls) {
  const third = /^https?:\/\//.test(url) && !url.startsWith('https://fonts.googleapis.com/');
  check(!third, 'unexpected origin ' + url);
}
check(pageText.includes('Fictional cases. Educational, not for clinical use.'), 'banner text');
const hub = readFileSync(join(drillsRoot, 'index.html'), 'utf8');
const drillLinks = hub.match(/href="\/drills\/[^"]+"/g) || [];
check(drillLinks.length === 1 && drillLinks[0] === 'href="/drills/base-rates/"', 'hub lists only R9, got ' + drillLinks.join(','));
check(!/R7|R4|I-PASS|chatbot/i.test(hub), 'hub does not list later drills');
check(!/['"]fixtures\.json['"]/.test(readFileSync(join(here, 'app.js'), 'utf8')), 'app does not load fixtures');
check(!/fetch\((?!['"]cases\.json['"])/.test(readFileSync(join(here, 'app.js'), 'utf8')), 'app fetches only cases.json');

const architecture = readFileSync(join(here, '..', '..', 'ARCHITECTURE.md'), 'utf8');
check(architecture.includes('## Drills'), 'ARCHITECTURE has a Drills section');
check(architecture.includes('`drills/`'), 'ARCHITECTURE names drills/');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('ok ' + (fixtures.cases.length + fixtures.workedChecks.length + fixtures.edges.length) + ' rows, icon checks, slider stops, edges, storage, scope');
