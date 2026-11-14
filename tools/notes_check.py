#!/usr/bin/env python3
"""The writer's check on a daily post, run where the writer runs. Never shipped (tools/ is export-ignore).

    python3 -I tools/notes_check.py [--situation /path/to/monitoring-the-situation] [day ...]

Expected behaviour:
  - Reads notes/posts/ through tools/build.py, so a post is held to notes/FORMAT.md by the same code that
    builds it. A post that breaks the format is reported in the builder's own words, and the exit code is 1.
  - With --situation, every source of each post is looked up in that repo: a cited post must be in
    verified/posts.json with the result "ok" and under the handle the post gives (case ignored); a cited
    story must be a file in moments/. Anything else is refused by name, and the exit code is 1.
  - Lists, for the reviewer, every run of capitalised words in a post that is in none of its source labels:
    the names a reader of the pull request should look at first. That list is a note, never a refusal.
  - Names days to check only those; with none, checks every post. A day with no post is refused.
  - Reads only. Writes nothing, and asks the network nothing.
"""
import os
import sys

if sys.path and os.path.realpath(sys.path[0]) == os.path.dirname(os.path.realpath(__file__)):
    del sys.path[0]

import json      # noqa: E402
import re        # noqa: E402
from pathlib import Path  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT / 'tools'))      # last, so the standard library is found first
import build  # noqa: E402

NAME = re.compile(r'\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)+\b')


def held(post, situation):
    """What the situation's record does not hold of this post's sources, as sentences."""
    ledger = json.loads((situation / 'verified' / 'posts.json').read_text(encoding='utf-8'))
    if not isinstance(ledger, dict):
        return ['verified/posts.json is not a ledger (an object of post ids)']
    bad = []
    for key, src in post['sources'].items():
        if 'story' in src:
            if not any((situation / 'moments').glob(f"*/*/{src['story']}.json")):
                bad.append(f"source {key}: the story {src['story']} is not in moments/")
            continue
        entry = ledger.get(src['post'])
        if not isinstance(entry, dict):
            bad.append(f"source {key}: the post {src['post']} is not in the ledger")
        elif entry.get('result') != 'ok':
            bad.append(f"source {key}: the ledger says the post {src['post']} is {entry.get('result')}, not ok")
        elif str(entry.get('handle', '')).lower() != src['handle'].lower():
            bad.append(f"source {key}: the ledger has the post {src['post']} under @{entry.get('handle')}, not @{src['handle']}")
    return bad


def names(post):
    """Runs of capitalised words that no source label accounts for."""
    labels = ' '.join(s['label'] for s in post['sources'].values()).lower()
    said = [post['title'], post['dek'], post['lead']['head'], *post['lead']['text'], *post['take']['text']]
    for n in post['notes']:
        said += [n['head'], n['text']]
    found = []
    for s in said:
        for name in NAME.findall(post['plain'](s)):
            if name.lower() not in labels and name not in found:
                found.append(name)
    return found


def main(argv, root=ROOT):
    argv = list(argv)
    situation = None
    if '--situation' in argv:
        i = argv.index('--situation')
        if i + 1 >= len(argv):
            print('usage: notes_check.py [--situation <the situation repo>] [day ...]')
            return 2
        situation = Path(argv[i + 1])
        del argv[i:i + 2]
        if not (situation / 'verified' / 'posts.json').is_file():
            print(f'refused: {situation} has no verified/posts.json, so it is not the situation repo')
            return 1
    try:
        posts = build.read_notes(root)['posts']
    except ValueError as stop:
        print(f'refused: {stop}')
        return 1
    have = {p['date'] for p in posts}
    code = 0
    for d in argv:
        if d not in have:
            print(f'refused: {d} has no post in notes/posts/')
            code = 1
    for post in posts:
        if argv and post['date'] not in argv:
            continue
        bad = held(post, situation) if situation else []
        for line in bad:
            print(f"refused: {post['date']}: {line}")
        code = 1 if bad else code
        checked = 'its sources are in the situation' if situation and not bad else 'sources not looked up (no --situation)' if not situation else 'see above'
        print(f"{'ok' if not bad else 'not ok'}: {post['date']}: meets the format; {checked}")
        read = names(post)
        if read:
            print(f"{post['date']}: names to read first (in no source label): {', '.join(read)}")
    return code


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
