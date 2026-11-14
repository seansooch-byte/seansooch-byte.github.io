# Field Notes: the daily post

`/notes/` is one post a day about the day before. Soochiebot reads Monitoring the Situation
(https://situation.seansooch.dev), then writes the post as ONE file. The site builds every page from that
file. This document is the whole contract between the writer and the site.

## Who does what

| | Does | Never does |
|---|---|---|
| Soochiebot (the writer) | Reads the situation's published stories and pulse for the day. Writes `notes/posts/<day>.json`. Opens a pull request that holds that file and what `build.py --notes` wrote. | Writes HTML. Types a web address. Types a number into a sentence. Reads anything private while writing. |
| `tools/build.py` | Checks the file against this page, builds `/notes/`, `/notes/<day>/`, `notes/index.json` and the sitemap, makes every link from an id. | Publishes a post that breaks a rule: the build stops and says which rule. |
| Sean | Reads the pull request. Merges or closes it. | |

The writer's input is the situation's record and `notes/VOICE.md`, nothing else. No texts, no mail, no
calendar, no vault. The voice file is the only thing of Sean's the writer sees, and it is in this repo so
that anyone can read what the writer was told.

## The file

`notes/posts/2026-11-12.json` is the post about 12 November 2026. One post per day; the file name is the day.

```json
{
  "schema": "notes.post/1",
  "date": "2026-11-12",
  "published": "2026-11-13",
  "model": "the model that wrote it",
  "title": "One line, 20 to 90 characters",
  "dek": "One sentence under the title, at most 200 characters.",
  "lead": {
    "desk": "business",
    "head": "The lead story's heading",
    "text": ["One to three paragraphs.", "A figure is asked for like this: {views}."],
    "cites": ["merger"]
  },
  "notes": [
    {"desk": "ai", "head": "A heading", "text": "One paragraph, at most 80 words.", "cites": ["meetings"]},
    {"desk": "sports", "head": "A heading", "text": "One paragraph.", "cites": ["lions"]}
  ],
  "take": {"text": ["One or two paragraphs: what the day adds up to."], "cites": []},
  "sources": {
    "merger": {"story": "2026-11-12-spacex-tesla-merger-talks", "label": "SpaceX and Tesla merger talks"},
    "meetings": {"story": "2026-11-12-claude-meetings-beta", "label": "Claude in meetings"},
    "lions": {"post": "2120640219871384044", "handle": "SomeAccount", "label": "The post about the Lions"}
  },
  "figures": {
    "views": {"value": "35.7M", "of": "views on the post", "source": "lions"}
  }
}
```

No other key is read, and a key this page does not name stops the build.

## The shape

- **Lead**: the one story that mattered most. One to three paragraphs.
- **Notes**: two to four other desks than the lead's, one paragraph each, no desk twice.
- **Take** (printed as "The read"): one or two paragraphs on what the day adds up to.
- 150 to 450 words in all. A post that needs more is two posts' worth of opinion.

## Sources

- A source is a story on the situation (`story`: its slug) or a post the situation confirmed with X (`post`:
  its id, and `handle`: the account). Nothing else can be cited.
- The builder writes the links: `https://situation.seansooch.dev/story/<slug>/` and
  `https://x.com/<handle>/status/<id>`. The writer never types an address, in a source or in a sentence.
- The lead cites at least one source and so does each note. Every source is cited somewhere.
- `label` is the writer's own few words for the source. Never the text of the post.

## Numbers

A sentence holds no number of its own. A number is a figure: `figures` gives it a `value`, says what it is
`of`, and names the `source` it was read from; the sentence asks for it with `{its_key}`. The page prints
every figure in the margin beside the paragraph that uses it, over its source, so a reader can check each one.

- Refused in a sentence: `35.7M`, `12%`, `$40B`, `31-17`, `5-4`, `24/7`, `3x`, `7th`, `~40%`, `+12`,
  `12-point`, `40-year-old`, `98mph`, a count after an ordinary word (`about 40 people`), and a number before
  a scale word (`Tesla 40 billion`).
- Allowed, because they are names and not measurements: a year (`2026`, `the 2020s`); a name with digits in
  it (`GPT-5`, `F-35`, `COVID-19`, `49ers`, `5G`, `9/11`); a plain version or ordinal straight after a
  capitalised name (`Gemini 4`, `Fable 5.2`, `Game 7`, `November 12`).
- Small counts are words: three, a dozen.
- The title and the dek may not ask for a figure. They have no margin to print its source in.
- A figure's `value` is a number as a reader writes one: `35.7M`, `12%`, `-3.2%`, `$1.2T`, `$40 billion`,
  `31-17`, `3x`. Not words, and not `about 40`.

The rule is a net, not a proof: a determined writer can get `top-10` through it. Do not look for the holes.

## Words

- No em dash, no en dash, no double hyphen.
- No quotation marks, double or single. An apostrophe is fine. Nothing is quoted; say what was said in your
  own words and cite it.
- No emoji or pictographs. `**bold**` is the only markup.
- No web addresses: nothing with a scheme, a `www.` or a host and a path. A name with a dot in it
  (`Crypto.com Arena`) is fine.
- Nothing that reads as a dose (a number, in digits or words, with mg, mcg, mL, IU, units of insulin and the
  like), anywhere, including a source's label.
- No private person and no minor. No personal, academic, calendar or relationship detail about Sean or
  anyone he knows. If it is not in the situation's record, it is not in the post.
- No financial advice and no bets. Say what happened and what it means, not what to buy.
- No slurs, and no joke that needs one.
- On the news desks (politics, world, defense, justice, disaster) describe and attribute. The take is for
  builds, markets, medicine, sports and the internet itself.

The builder enforces the first four groups and every structural rule above. The rest is the writer's
discipline and the reviewer's job; `tools/notes_check.py` lists every name a post uses that is in none of its
source labels, so the reviewer sees them first.

## Checks

```
python3 -I tools/build.py --notes            build the pages (stops on a post that breaks a rule)
python3 -I tools/build.py --check            what stage.sh runs: are the pages the builder's?
python3 -I tools/notes_check.py --situation /path/to/monitoring-the-situation [day ...]
```

The last one needs the situation's repo, so it runs where the writer runs. It refuses a cited post that the
ledger (`verified/posts.json`) does not hold as `ok` under that handle, and a cited story that is not in
`moments/`. Paste its output into the pull request.

## Corrections

A published post is corrected by a pull request that edits its file. The situation's record is the
authority: if a story there is corrected, the post follows it.

## Desks

`notes/desks.json` is a copy of the desk ids and names in the situation's `contract/desks.json`. When a desk
is added there, add it here in the same pull request as the first post that uses it. A retired desk stays
in the file for as long as a post names it.
