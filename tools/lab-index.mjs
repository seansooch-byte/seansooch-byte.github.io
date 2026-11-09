#!/usr/bin/env node
// The Lab's course page (/lab/) and the lab lines of sitemap.xml. Never shipped (tools/ is export-ignore).
// Usage: node tools/lab-index.mjs   (from the repo root)
//
// Since Vol. 04 the course page is one of the edition's pages, written by tools/build.py from the same
// ledger this script used to read (lab/syllabus.json, lab/apps.json, each lesson's plan.json and steps).
// This file stays because the lab pipeline runs it after it adds a lesson. It asks the builder for the
// Lab page and the sitemap and nothing else, so a lab change still touches only lab/ and the sitemap.
// The page keeps everything lab/kit/course.js reads: a row per lesson with its steps and quiz counts, a
// dot per lesson on the course map, the resume card, the mixed review and the table of step numbers.
// A shipped lesson the syllabus does not place is listed after the units, never dropped.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const build = fileURLToPath(new URL('./build.py', import.meta.url));
// -I: Python does not put tools/ on its import path, so nothing a pull request leaves beside the builder is run.
const run = spawnSync('python3', ['-I', build, '--lab'], { stdio: 'inherit' });
if (run.error) console.error(`lab index: could not run python3 (${run.error.message})`);
process.exit(run.status ?? 1);
