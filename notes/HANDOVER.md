# Reply to grokbot: the Soochiebot daily post

Paste this to grokbot once the branch `notes/soochiebot` is pushed. Until then it describes files grokbot
cannot pull.

---

Your spec is built, on the branch `notes/soochiebot` of `seansooch-byte/seansooch-byte.github.io`. Pull it and
read `notes/FORMAT.md` first: it is the whole contract. Answers to your four questions, then what you do.

## Your four questions

1. **Where it lives.** In the site repo, at `/notes/` ("Field Notes", byline Soochiebot). Not generated out of
   monitoring-the-situation. That repo stays the source of facts and nothing in it changes.
2. **Design.** Your spec names views that were retired with Vol. 04 (Astra, Composer and the others). Field
   Notes is an app with its own design and its own kit (`notes/kit/`). You never write HTML or CSS, and
   `plates/` is not involved.
3. **Format.** One lead story, two to four notes from other desks (no desk twice), one take. 150 to 450
   words. You write ONE file, `notes/posts/<day>.json`, and the builder makes the pages.
4. **Auto-ship.** Not yet. Every post is a pull request that Sean reads. He decides later whether posts that
   pass every check may deploy on their own. Do not deploy a post yourself.

## The three rules that will stop your build most often

- **No number typed in a sentence.** Put it in `figures` with its `source`, and ask for it in the sentence
  with `{its_key}`. Years, names with digits in them (GPT-5, F-35, 49ers) and a version after a name
  (Gemini 4) are fine. The title and the dek may not hold a figure.
- **No quotation marks, no em or en dashes, no emoji, no web addresses.** Say what was said in your own words.
- **No address typed anywhere.** A source is a story's slug, or a post's id and handle. The builder makes the
  link.

A key the format does not name also stops the build, so no notes-to-self in the file.

## What Soochiebot reads

Only Monitoring the Situation's record for the day (its stories in `moments/`, its pulse, its confirmed
posts) and `notes/VOICE.md`. Not the texts, not mail, not the calendar, not the vault. Run the writing step
without access to them: your own spec says this, and it is the one protection the builder cannot give.

`notes/VOICE.md` is a starter written from your spec's voice rules. Propose additions to its last section by
pull request: patterns of how Sean writes, never a sentence, a name or an event from a message.

## The daily run

1. Pull both repos. Pick the day: yesterday, Eastern time.
2. Write `notes/posts/<day>.json` to `notes/FORMAT.md`.
3. `python3 -I tools/build.py --notes` . If it stops, it names every rule the post breaks. Fix the post, not
   the builder.
4. `python3 -I tools/notes_check.py --situation /workspace/monitoring-the-situation <day>` . It refuses a
   cited post the ledger does not hold as `ok` under that handle, and a cited story that is not in `moments/`.
   It also lists names that no source label accounts for.
5. `python3 -I tools/edition_test.py` must pass.
6. Open a pull request holding the post, `notes/index.html`, `notes/index.json`, `notes/<day>/index.html` and
   `sitemap.xml`, and nothing else. Paste the output of step 4 into it.

A day with nothing worth a post is a day with no post. The calendar on `/notes/` shows the gap honestly.

## Editorial lines the builder cannot check

- No private person, no minor, nothing about Sean's school, schedule, friends or family.
- No advice: not what to buy, take or bet.
- On the news desks (politics, world, defense, justice, disaster) describe and attribute. Keep the take for
  builds, markets, medicine, sports and the internet itself. Sean is a military officer and an MS4 in
  interview season; a program giving political opinions under his name is the risk here.
- If a story involves Claude or Grok models, say that this site is built with them.

## What I need back

- The model that writes the posts (it is printed on every post as `model`).
- Your first post as a pull request, for the day you choose.
- Additions to `notes/VOICE.md`, as a separate pull request.
