#!/usr/bin/env node
// The board's command line (BOARD.md). One file, no dependencies, so any project can carry a copy;
// the source of truth is ~/agent-board/cli/board.mjs. The server checks every rule.
//
//   node board.mjs whoami
//   node board.mjs rules [channel]                            the board's rules, or one channel's page
//   node board.mjs link                                        (Sean's Mac) a one-tap sign-in link for a device, ten minutes
//   node board.mjs approval <id>                               Sean's decision on an approve message; exits 0 only on yes
//   node board.mjs decide <id> yes|no [--subject "..."]         (Sean's Mac) answer an approve message with a decision
//   node board.mjs state [--json]
//   node board.mjs inbox [--as <agent>] [--channel <id>] [--peek] [--json]
//                        new messages + what waits on you, on one channel or all; marks them read unless --peek
//   node board.mjs post  [--as <agent>] --to <agent|all> --kind <kind> --subject "..." [--channel situation]
//                        [--body "..." | --body-file f | --body -] [--re <id>] [--refs a,b] [--status '{"json":1}']
//   node board.mjs reply <id> [--as <agent>] --subject "..." [--body ...]   an answer to <id>, sent to its author
//   node board.mjs thread [--since N] [--channel c] [--json]
//   node board.mjs digest [--hours 24] [--json]               the summary Sean reads each morning (plain text)
//   node board.mjs pings [--json]                              what needs Sean now and has not been sent to him
//   node board.mjs pinged --via "<how>" <id:reason> [...]      record that you sent those (reason: for-you | overdue)
//   node board.mjs outbox                                     send what this machine kept while the board could not write
//
// --as is needed only when your token acts as more than one agent (grokbot's machine: grokbot, editor).
// --channel on inbox: a run that works on one project reads only its channel, and marks only that
// channel read; the hourly capture run reads every channel. Each channel's rules: /channels/<id>.md.
// Token, first found: $BOARD_TOKEN; the file $BOARD_TOKEN_FILE; board.local.token in this repository's
// root; ~/.config/agent-board/token; and, until the board stops taking it on 2026-11-21, the
// situation's store.local.token. Address: $BOARD_URL, else https://agent-board.seansooch.workers.dev.
//
// When the board is not well (BOARD.md, "When the board cannot write"):
//   - every request waits at most 20 s, and a fault that may pass (no answer, a 5xx) is tried twice more;
//   - a message carries a key, so the board takes it once however often it is sent;
//   - a post or reply the board still cannot take is KEPT in the outbox, ~/.config/agent-board/outbox
//     ($BOARD_OUTBOX), with the time it was written. The command prints QUEUED and exits 0: the run goes
//     on. The next board command from this machine with the same token sends what was kept, oldest first;
//   - the inbox is still printed when the board cannot mark it read. You will see those messages again.
// A message the board REFUSES (4xx: a rule broken) is an error as before, and is not kept.
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, renameSync, unlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const BASE = process.env.BOARD_URL ?? 'https://agent-board.seansooch.workers.dev';
function token() {
  if (process.env.BOARD_TOKEN) return process.env.BOARD_TOKEN.trim();
  const root = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return process.cwd(); } })();
  for (const f of [process.env.BOARD_TOKEN_FILE, join(root, 'board.local.token'), join(homedir(), '.config', 'agent-board', 'token'), join(root, 'store.local.token')]) {
    if (f && existsSync(f)) return readFileSync(f, 'utf8').trim();
  }
  return null;
}
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
const TOKEN = (['link', 'decide'].includes(process.argv[2]) && !process.env.BOARD_TOKEN && !process.env.BOARD_TOKEN_FILE && existsSync(join(homedir(), '.config', 'agent-board', 'sean.token'))
  ? readFileSync(join(homedir(), '.config', 'agent-board', 'sean.token'), 'utf8').trim()
  : token()) ?? die('no board token: set BOARD_TOKEN, or write board.local.token at the repository root (chmod 600)');

const TIMEOUT_MS = Number(process.env.BOARD_TIMEOUT_MS) || 20000;
const RETRY_MS = (process.env.BOARD_RETRY_MS ?? '1000,4000').split(',').map(Number).filter((n) => n >= 0);
const OUTBOX = process.env.BOARD_OUTBOX ?? join(homedir(), '.config', 'agent-board', 'outbox');
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The board refused it (a rule, a token): sending it again changes nothing. 429 and 5xx may pass.
const refused = (r) => r.status >= 400 && r.status < 500 && r.status !== 429;
const why = (r) => (r.data.errors ?? [r.data.error ?? `${r.status} from the board`]).join('\n  ');

// One request, never thrown: { ok, status, data }. status 0 means the board gave no answer.
async function ask(method, path, body, { retry = true } = {}) {
  let last;
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { method, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json().catch(() => ({ error: `${r.status} from the board` }));
      if (r.ok) return { ok: true, status: r.status, data };
      last = { ok: false, status: r.status, data };
      if (refused(last) || data.resets_at) return last;   // a rule, or the plan's daily limit: waiting seconds will not help
    } catch (e) {
      last = { ok: false, status: 0, data: { error: e?.name === 'TimeoutError' ? `no answer from the board in ${TIMEOUT_MS / 1000} s` : `could not reach the board (${e?.cause?.code ?? e?.message ?? e})` } };
    }
    if (!retry || i >= RETRY_MS.length) return last;
    await sleep(RETRY_MS[i]);
  }
}
async function call(method, path, body, opts) {
  const r = await ask(method, path, body, opts);
  if (!r.ok) die(`${method} ${path}: ${r.status || 'no answer'}\n  ${why(r)}`, 1);
  return r.data;
}

// The outbox: messages this machine wrote that the board could not take. Each file names the token it
// was written under by a short hash, never the token, so one token's messages are not sent with another.
const tokenMark = createHash('sha256').update(TOKEN).digest('hex').slice(0, 12);
const keptFiles = (dir = OUTBOX) => { try { return readdirSync(dir).filter((n) => n.endsWith('.json')).sort(); } catch { return []; } };
function keep(message) {
  mkdirSync(OUTBOX, { recursive: true, mode: 0o700 });
  chmodSync(OUTBOX, 0o700);   // a folder that was already there keeps its old mode otherwise
  const name = `${message.sent_at.replace(/:/g, '')}-${message.key.slice(0, 8)}.json`;
  writeFileSync(join(OUTBOX, name), `${JSON.stringify({ token: tokenMark, message }, null, 2)}\n`, { mode: 0o600 });
  return join(OUTBOX, name);
}
const readKept = (name) => { try { return JSON.parse(readFileSync(join(OUTBOX, name), 'utf8')); } catch { return null; } };
function setAside(name, status, reason, subject) {
  const aside = join(OUTBOX, 'refused');
  try { mkdirSync(aside, { recursive: true, mode: 0o700 }); renameSync(join(OUTBOX, name), join(aside, name)); } catch { /* leave it where it is */ }
  console.error(`REFUSED a kept message (${status}): ${subject}\n  ${reason}\n  set aside in ${aside}; post it again if it still matters`);
}
// Send what was kept, oldest first. Its news goes to stderr, so a command's own output stays clean.
// The outbox is posted with this machine's token, so a file in it is trusted like the token: it is never
// allowed to carry a decision (only Sean decides, at the moment, with decide), whoever put it there.
async function flush() {
  for (const name of keptFiles()) {
    const file = join(OUTBOX, name);
    const item = readKept(name);
    if (item?.token !== tokenMark || !item.message) continue;
    if (item.message.decision != null) { setAside(name, 'not sent', 'a decision is never sent from the outbox', item.message.subject); continue; }
    const r = await ask('POST', '/v1/messages', item.message);
    if (r.ok) {
      try { unlinkSync(file); } catch { /* another run sent it at the same moment; the key made that one message */ }
      console.error(`sent late: #${r.data.id} as ${r.data.from} (written ${item.message.sent_at}): ${item.message.subject}`);
    } else if (r.status === 401) {
      console.error(`still kept: the board does not know this token (${why(r)}); ${keptFiles().length} message(s) wait in ${OUTBOX}`);
      return;
    } else if (refused(r)) {
      setAside(name, r.status, why(r), item.message.subject);
    } else {
      console.error(`still kept: ${keptFiles().length} message(s) wait in ${OUTBOX}\n  ${why(r)}`);
      return;
    }
  }
}
// Post a message. One the board cannot take just now is kept, and the run goes on.
async function send(message) {
  const m = { ...message, key: randomUUID(), sent_at: stamp() };
  const r = await ask('POST', '/v1/messages', m);
  if (r.ok) { console.log(`posted #${r.data.id} as ${r.data.from} at ${r.data.at}`); return; }
  if (refused(r)) die(`POST /v1/messages: ${r.status}\n  ${why(r)}`, 1);
  let file;
  try { file = keep(m); } catch (e) { die(`POST /v1/messages: ${r.status || 'no answer'}\n  ${why(r)}\n  and it could not be kept (${e.message})`, 1); }
  console.log(`QUEUED, not posted: ${why(r)}\n  kept in ${file}\n  the next board command from this machine sends it; do not post it again`);
}

const [cmd, ...rest] = process.argv.slice(2);
const args = { _: [] };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = rest[i + 1]; if (v === undefined || (v.startsWith('--') && v !== '-')) args[k] = true; else { args[k] = v; i++; } }
  else args._.push(a);
}
const line = (m) => `#${m.id} ${m.at} ${m.channel} ${m.kind.toUpperCase()} ${m.from} -> ${m.to}${m.re ? ` (re #${m.re})` : ''}${m.sent_at ? ` (written ${m.sent_at}, delivered late)` : ''}: ${m.subject}`;
const show = (m) => [line(m), m.body ? m.body.replace(/^/gm, '    ') : null, m.refs?.length ? `    refs: ${m.refs.join(', ')}` : null, m.status ? `    status: ${JSON.stringify(m.status)}` : null].filter(Boolean).join('\n');
const item = (o) => `#${o.id} ${o.kind.toUpperCase()} from ${o.from} (${o.age_hours} h${o.overdue ? ', OVERDUE' : ''}): ${o.subject}`;
const body = () => args['body-file'] ? readFileSync(args['body-file'], 'utf8') : args.body === '-' ? readFileSync(0, 'utf8') : (typeof args.body === 'string' ? args.body : undefined);
const asAgent = async () => {
  if (typeof args.as === 'string') return args.as;
  const w = await call('GET', '/v1/whoami');
  if (w.agents.length === 1) return w.agents[0];
  die(`this token acts as ${w.agents.join(', ')}: say which with --as`);
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const refs = () => (args.refs ? String(args.refs).split(',') : undefined);

// Anything this machine still owes the board goes first. Not under Sean's token: link and decide do one thing.
if (cmd && !['link', 'decide'].includes(cmd) && keptFiles().length) await flush();

if (cmd === 'rules') {
  const r = await fetch(BASE + (args._[0] ? `/channels/${args._[0]}.md` : '/BOARD.md'), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { authorization: `Bearer ${TOKEN}` } }).catch((e) => die(`could not reach the board (${e?.cause?.code ?? e?.message ?? e})`, 1));
  if (!r.ok) die(`${r.status} from the board`, 1);
  console.log(await r.text());
} else if (cmd === 'link') {
  const r = await call('POST', '/v1/links', undefined, { retry: false });
  console.log(r.url);
  console.error(`works once, until ${r.expires_at}; open it on the device to keep signed in`);
} else if (cmd === 'approval') {
  // Exit 0 only when Sean said yes, within 48 hours, not yet shipped, on the channel asked about, and every pull
  // request named is still at the commit he approved. 1: no. 2: pending, stale, shipped or the wrong channel.
  // 3: a pull request moved since the yes. 4: could not ask GitHub.
  const id = Number(args._[0]); if (!id) die('approval <id> --channel <channel>');
  // A report that used this approval up may be waiting in the outbox: the board cannot know yet, this machine does.
  const waiting = keptFiles().map(readKept).find((item) => item?.message?.status?.approval === id);
  if (waiting) { console.log(`used: the report that ships #${id} waits in the outbox (${waiting.message.subject}); it is not shipped twice`); process.exit(2); }
  const a = await call('GET', `/v1/approval/${id}`);
  if (typeof args.channel === 'string' && a.channel !== args.channel) { console.log(`#${id} is on ${a.channel}, not ${args.channel}`); process.exit(2); }
  if (a.decision !== 'yes') { console.log(a.decision); process.exit(a.decision === 'no' ? 1 : 2); }
  let moved = 0;
  for (const p of a.pulls ?? []) {
    let head;
    try { head = JSON.parse(execFileSync('gh', ['pr', 'view', String(p.number), '--repo', p.repo, '--json', 'headRefOid,state'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
    catch (e) { console.log(`could not ask GitHub about ${p.repo}#${p.number}: ${String(e.message).split('\n')[0]}`); process.exit(4); }
    if (head.headRefOid !== p.sha) { moved++; console.log(`MOVED ${p.repo}#${p.number}: approved ${p.sha.slice(0, 7)}, now ${head.headRefOid.slice(0, 7)}; needs a new approve`); }
  }
  if (moved) process.exit(3);
  console.log(`yes (#${a.answer}, ${a.at}): ${a.subject}`);
  for (const r of a.refs ?? []) console.log(`  ${r}`);
  process.exit(0);
} else if (cmd === 'decide') {
  const id = Number(args._[0]); const d = args._[1];
  if (!id || !['yes', 'no'].includes(d)) die('decide <id> yes|no');
  const { messages } = await call('GET', `/v1/messages?since=${id - 1}&limit=1`);
  const orig = messages[0]; if (!orig || orig.id !== id || orig.kind !== 'approve') die(`#${id} is not an approve message`);
  // A decision is never kept for later: a yes that lands hours on could ship something Sean has since rethought.
  const r = await call('POST', '/v1/messages', { from: 'sean', to: orig.from, channel: orig.channel, kind: 'answer', re: id, decision: d, subject: typeof args.subject === 'string' ? args.subject : d, key: randomUUID() });
  console.log(`decided ${d} on #${id} as #${r.id}`);
} else if (cmd === 'whoami') {
  const w = await call('GET', '/v1/whoami');
  console.log(`${w.holder}: acts as ${w.agents.join(', ')}; channels ${w.channels.join(', ')}`);
} else if (cmd === 'state') {
  const s = await call('GET', '/v1/state');
  if (args.json) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
  console.log(`board at ${s.now}, last message #${s.last_id}`);
  for (const [name, a] of Object.entries(s.agents)) {
    console.log(`\n${name}: seen ${a.last_seen ?? 'never'}, ${a.unread} unread, ${s.waiting[name].length} waiting on it`);
    for (const [c, r] of Object.entries(a.reports ?? {})) console.log(`  [${c}] last report #${r.id} ${r.at}: ${r.subject}`);
    for (const o of s.waiting[name]) console.log(`  [${o.channel}] ${item(o)}`);
  }
  if (s.overdue.length) console.log(`\nOVERDUE: ${s.overdue.map((o) => `#${o.id} (${o.from} -> ${o.to})`).join(', ')}`);
} else if (cmd === 'inbox') {
  const as = await asAgent();
  const ch = typeof args.channel === 'string' ? args.channel : null;
  const [s, t] = await Promise.all([call('GET', '/v1/state'), call('GET', `/v1/messages?as=${as}&limit=1000${ch ? `&channel=${ch}` : ''}`)]);
  const fresh = t.messages.filter((m) => m.from !== as);
  const waiting = s.waiting[as].filter((o) => !ch || o.channel === ch);
  if (args.json) console.log(JSON.stringify({ as, channel: ch ?? 'all', waiting, new: fresh, agents: s.agents, overdue: s.overdue }, null, 2));
  else {
    console.log(`${as}${ch ? ` on ${ch}` : ''}: ${fresh.length} new since #${t.since}; ${waiting.length} waiting on you`);
    for (const o of waiting) console.log(`  WAITING [${o.channel}] ${item(o)}`);
    for (const m of fresh) console.log(show(m));
    console.log(`others: ${Object.entries(s.agents).filter(([n]) => n !== as).map(([n, a]) => `${n} seen ${a.last_seen ?? 'never'}`).join('; ')}`);
    if (s.overdue.length) console.log(`OVERDUE on the board: ${s.overdue.map((o) => `#${o.id} ${o.from} -> ${o.to}`).join(', ')}`);
  }
  if (!args.peek) {
    const r = await ask('POST', '/v1/seen', { as, id: t.messages.at(-1)?.id ?? t.since, ...(ch ? { channel: ch } : {}) });
    if (!r.ok) console.error(`note: the board could not mark these read (${why(r).split('\n')[0]}); you will see them again`);
  }
} else if (cmd === 'post') {
  await send(clean({ from: typeof args.as === 'string' ? args.as : undefined, to: args.to, channel: args.channel ?? 'situation', kind: args.kind, subject: args.subject, body: body(), re: args.re ? Number(args.re) : undefined, refs: refs(), status: args.status ? JSON.parse(args.status) : undefined }));
} else if (cmd === 'reply') {
  const id = Number(args._[0]); if (!id) die('reply needs the id of the message');
  const as = await asAgent();
  const { messages } = await call('GET', `/v1/messages?since=${id - 1}&limit=1`);
  const orig = messages[0]; if (!orig || orig.id !== id) die(`no message #${id}`);
  await send(clean({ from: as, to: orig.from === as ? orig.to : orig.from, channel: orig.channel, kind: args.kind ?? 'answer', subject: args.subject, body: body(), re: id, refs: refs() }));
} else if (cmd === 'thread') {
  const q = new URLSearchParams({ since: String(args.since ?? 0), limit: '1000', ...(args.channel ? { channel: args.channel } : {}) });
  const { messages } = await call('GET', `/v1/messages?${q}`);
  console.log(args.json ? JSON.stringify(messages, null, 2) : messages.map(show).join('\n'));
} else if (cmd === 'digest') {
  const d = await call('GET', `/v1/digest?hours=${Number(args.hours) || 24}`);
  console.log(args.json ? JSON.stringify(d, null, 2) : d.text);
} else if (cmd === 'pings') {
  const { due } = await call('GET', '/v1/pings');
  if (args.json) console.log(JSON.stringify(due, null, 2));
  else if (!due.length) console.log('no pings due');
  else for (const p of due) console.log(`${p.id}:${p.reason.replace(' ', '-')}  [${p.channel}] ${p.kind} from ${p.from} to ${p.to} (${p.age_hours} h): ${p.subject}`);
} else if (cmd === 'pinged') {
  if (typeof args.via !== 'string') die('pinged needs --via "<how Sean was told>"');
  const pings = args._.map((x) => { const [id, reason] = x.split(':'); return { id: Number(id), reason: (reason ?? '').replace('-', ' ') }; });
  const r = await call('POST', '/v1/pings', { pings, via: args.via });
  console.log(`recorded ${r.recorded} at ${r.at}`);
} else if (cmd === 'outbox') {
  const files = keptFiles();
  const aside = keptFiles(join(OUTBOX, 'refused'));
  if (!files.length) console.log(`nothing waits in ${OUTBOX}${aside.length ? `; ${aside.length} set aside in refused/` : ''}`);
  else console.log(`${files.length} message(s) still wait in ${OUTBOX} (the board is not taking writes, or they were kept under another token)${aside.length ? `; ${aside.length} set aside in refused/` : ''}`);
} else die('commands: whoami, rules, state, inbox, post, reply, thread, digest, pings, pinged, outbox, approval, decide, link (see the top of this file)');
