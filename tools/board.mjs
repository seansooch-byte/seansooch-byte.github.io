#!/usr/bin/env node
// The board's command line (BOARD.md). One file, no dependencies, so any project can carry a copy;
// the source of truth is ~/agent-board/cli/board.mjs. The server checks every rule.
//
//   node board.mjs whoami
//   node board.mjs rules [channel]                            the board's rules, or one channel's page
//   node board.mjs link                                        (Sean's Mac) a one-tap sign-in link for a device, ten minutes
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
//
// --as is needed only when your token acts as more than one agent (grokbot's machine: grokbot, editor).
// --channel on inbox: a run that works on one project reads only its channel, and marks only that
// channel read; the hourly capture run reads every channel. Each channel's rules: /channels/<id>.md.
// Token, first found: $BOARD_TOKEN; the file $BOARD_TOKEN_FILE; board.local.token in this repository's
// root; ~/.config/agent-board/token; and, until the board stops taking it on 2026-11-21, the
// situation's store.local.token. Address: $BOARD_URL, else https://agent-board.seansooch.workers.dev.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

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
const TOKEN = (process.argv[2] === 'link' && !process.env.BOARD_TOKEN && !process.env.BOARD_TOKEN_FILE && existsSync(join(homedir(), '.config', 'agent-board', 'sean.token'))
  ? readFileSync(join(homedir(), '.config', 'agent-board', 'sean.token'), 'utf8').trim()
  : token()) ?? die('no board token: set BOARD_TOKEN, or write board.local.token at the repository root (chmod 600)');

async function call(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({ error: `${r.status} from the board` }));
  if (!r.ok) die(`${method} ${path}: ${r.status}\n  ${(data.errors ?? [data.error]).join('\n  ')}`, 1);
  return data;
}

const [cmd, ...rest] = process.argv.slice(2);
const args = { _: [] };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = rest[i + 1]; if (v === undefined || (v.startsWith('--') && v !== '-')) args[k] = true; else { args[k] = v; i++; } }
  else args._.push(a);
}
const line = (m) => `#${m.id} ${m.at} ${m.channel} ${m.kind.toUpperCase()} ${m.from} -> ${m.to}${m.re ? ` (re #${m.re})` : ''}: ${m.subject}`;
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

if (cmd === 'rules') {
  const r = await fetch(BASE + (args._[0] ? `/channels/${args._[0]}.md` : '/BOARD.md'), { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) die(`${r.status} from the board`, 1);
  console.log(await r.text());
} else if (cmd === 'link') {
  const r = await call('POST', '/v1/links');
  console.log(r.url);
  console.error(`works once, until ${r.expires_at}; open it on the device to keep signed in`);
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
  if (!args.peek) await call('POST', '/v1/seen', { as, id: t.messages.at(-1)?.id ?? t.since, ...(ch ? { channel: ch } : {}) });
} else if (cmd === 'post') {
  const r = await call('POST', '/v1/messages', clean({ from: typeof args.as === 'string' ? args.as : undefined, to: args.to, channel: args.channel ?? 'situation', kind: args.kind, subject: args.subject, body: body(), re: args.re ? Number(args.re) : undefined, refs: refs(), status: args.status ? JSON.parse(args.status) : undefined }));
  console.log(`posted #${r.id} as ${r.from} at ${r.at}`);
} else if (cmd === 'reply') {
  const id = Number(args._[0]); if (!id) die('reply needs the id of the message');
  const as = await asAgent();
  const { messages } = await call('GET', `/v1/messages?since=${id - 1}&limit=1`);
  const orig = messages[0]; if (!orig || orig.id !== id) die(`no message #${id}`);
  const r = await call('POST', '/v1/messages', clean({ from: as, to: orig.from === as ? orig.to : orig.from, channel: orig.channel, kind: args.kind ?? 'answer', subject: args.subject, body: body(), re: id, refs: refs() }));
  console.log(`posted #${r.id} as ${r.from} at ${r.at}`);
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
} else die('commands: whoami, state, inbox, post, reply, thread, digest, pings, pinged (see the top of this file)');
