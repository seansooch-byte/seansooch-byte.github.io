#!/usr/bin/env node
// Tests for the gate tools/lab-check.mjs puts in front of every Lab change (a pull request and tools/stage.sh).
// Each case copies the repo's lab/ and the Lab's tools into a scratch repo, changes one thing, and runs the check.
// Usage, from the repo root: node --test tools/lab-check-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const repo = new URL('..', import.meta.url).pathname;
// The fixture lesson: the last shipped lesson in syllabus order that is on the kit (has a plan.json), is not owed and
// is no lesson's prerequisite. Taking it out of the syllabus then renumbers no shipped lesson the check holds to its
// number. Chosen from the data, not named, because the syllabus grows past whichever lesson was last when this was written.
const KIT_LESSON = (() => {
  const lab = p => JSON.parse(fs.readFileSync(path.join(repo, 'lab', p), 'utf8'));
  const owedNow = fs.existsSync(path.join(repo, 'tools/lab-owed.json')) ? JSON.parse(fs.readFileSync(path.join(repo, 'tools/lab-owed.json'), 'utf8')) : {};
  const shipped = new Set(lab('apps.json').map(a => a.slug));
  const plans = [...shipped].filter(s => fs.existsSync(path.join(repo, 'lab', s, 'plan.json')));
  const prereqs = new Set(plans.flatMap(s => lab(`${s}/plan.json`).prerequisites || []));
  const pick = lab('syllabus.json').modules.map(m => m.slug)
    .filter(s => shipped.has(s) && !(s in owedNow) && plans.includes(s) && !prereqs.has(s)).pop();
  if (!pick) throw new Error('no shipped, on-kit, unowed lesson that is no prerequisite: the fixture needs one');
  return pick;
})();

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-check-'));
  fs.cpSync(path.join(repo, 'lab'), path.join(dir, 'lab'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tools'));
  for (const n of fs.readdirSync(path.join(repo, 'tools'))) {
    if (/^lab-(check|index)\.mjs$|^lab-owed\.json$/.test(n)) fs.copyFileSync(path.join(repo, 'tools', n), path.join(dir, 'tools', n));
  }
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  git('init', '-q'); git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  return dir;
}
const run = (dir, ...args) => spawnSync(process.execPath, [path.join(dir, 'tools/lab-check.mjs'), ...args], { cwd: dir, encoding: 'utf8' });
const json = (dir, p) => JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8'));
const save = (dir, p, v) => fs.writeFileSync(path.join(dir, p), JSON.stringify(v, null, 2) + '\n');
const owed = dir => fs.existsSync(path.join(dir, 'tools/lab-owed.json')) ? json(dir, 'tools/lab-owed.json') : {};

test('the repo as committed passes, with what it owes printed as notes', () => {
  const r = run(scratch());
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a shipped lesson the syllabus does not place fails, and its other problems are still listed', () => {
  const dir = scratch();
  const s = json(dir, 'lab/syllabus.json');
  s.modules = s.modules.filter(m => m.slug !== KIT_LESSON);
  save(dir, 'lab/syllabus.json', s);
  const page = path.join(dir, `lab/${KIT_LESSON}/index.html`);
  fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('<link rel="stylesheet" href="/lab/kit/kit.css">', ''));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`${KIT_LESSON}: not in lab/syllabus.json`));
  assert.match(r.stdout, new RegExp(`${KIT_LESSON}: index.html lacks the kit stylesheet`));
});

test('a lesson folder the ledger does not list fails, and so does a ledger entry with no folder', () => {
  const dir = scratch();
  fs.mkdirSync(path.join(dir, 'lab/new-lesson'));
  fs.writeFileSync(path.join(dir, 'lab/new-lesson/index.html'), '<p>hi</p>');
  const a = json(dir, 'lab/apps.json');
  a.push({ slug: 'gone-lesson', title: 'Gone', date: '2026-11-14' });
  save(dir, 'lab/apps.json', a);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /lab\/new-lesson: is not in lab\/apps\.json/);
  assert.match(r.stdout, /gone-lesson: missing index\.html/);
});

test('an owed lesson that now follows the format must leave the owed list', () => {
  const dir = scratch();
  save(dir, 'tools/lab-owed.json', { ...owed(dir), [KIT_LESSON]: { since: '2026-11-14', owes: 'test' } });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`${KIT_LESSON}: is in tools/lab-owed.json but follows lab/FORMAT.md now`));
});

test('the owed list only shrinks: a pull request that adds to it fails against its base', () => {
  const dir = scratch();
  const s = json(dir, 'lab/syllabus.json');
  s.modules = s.modules.filter(m => m.slug !== KIT_LESSON);
  save(dir, 'lab/syllabus.json', s);
  save(dir, 'tools/lab-owed.json', { ...owed(dir), [KIT_LESSON]: { since: '2026-11-14', owes: 'a unit' } });
  assert.equal(run(dir).status, 0, 'without a base the owed entry stands');
  const r = run(dir, '--base', 'HEAD');
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`tools/lab-owed.json: adds ${KIT_LESSON}`));
});
