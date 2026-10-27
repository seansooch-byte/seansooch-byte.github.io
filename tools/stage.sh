#!/bin/bash
# Stage the deploy bundle for seansooch.dev from a commit.
#
# Expected behaviour (this repo has no test harness, so the contract lives here):
#   - The bundle is the committed tree of HEAD minus every path marked
#     export-ignore in .gitattributes. Nothing else decides what ships.
#   - Refuses to run on a dirty tree, so what ships is always a commit and the
#     repo cannot fall behind production.
#   - Refuses a commit that holds a symlink or a submodule. The site is regular
#     files only, and wrangler follows a link and uploads whatever it points
#     at, so a link merged from a pull request could publish a local file.
#   - Writes to /tmp/seansooch-bundle, replacing the previous bundle. Any other
#     directory must be new or empty: this script never clears a directory it
#     was only pointed at.
#   - Refuses a commit in which a page asks for an asset by a stale stamp. The
#     shared assets (design-switcher.css/.js, lab-course.js) are requested as
#     /<asset>?v=<first 10 hex of its MD5> and served with max-age=14400, so an
#     asset edited without restamping its pages reaches new visitors while any
#     browser holding the old copy keeps it for four hours. On 2026-10-27 that
#     left returning readers a three-view switcher with a fourth view wrapped
#     under it, and an old script that stalled on the fourth view's click.
#     The stamps come from ~/seansooch-astra-preview/edition_views.switcher_head.
#   - Says so when HEAD is not the origin/main it last saw: a deploy cut from an
#     unpushed commit leaves GitHub behind the site.
#   - Prints the commit, the file count and the next two commands.
#
# Usage: tools/stage.sh [dir]
set -euo pipefail

default=/tmp/seansooch-bundle
out="${1:-$default}"
case "$out" in /*) ;; *) out="$PWD/$out" ;; esac
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "refusing to stage: commit or discard these first" >&2
  git status --short >&2
  exit 1
fi

links=$(git ls-tree -r HEAD | awk '$1 == "120000" || $1 == "160000"')
if [ -n "$links" ]; then
  echo "refusing to stage: HEAD holds a symlink or submodule" >&2
  echo "$links" >&2
  exit 1
fi

md5_10() { if command -v md5sum >/dev/null; then md5sum | cut -c1-10; else md5 -q | cut -c1-10; fi; }
# Site-absolute references only ("/x.js?v=..."): an outside URL with its own ?v= is not ours to check. No match at
# all is a clean result, not an error, hence the || true under pipefail.
stale=$({ git grep -o -E '"/[A-Za-z0-9_][A-Za-z0-9_./-]*\.(css|js)\?v=[0-9a-f]+"' HEAD -- '*.html' || true; } | sort -u | while IFS= read -r hit; do
  page=${hit#HEAD:}; page=${page%%:*}; ref=${hit#HEAD:"$page":}; ref=${ref//\"/}
  asset=${ref%%\?v=*}; stamp=${ref##*\?v=}
  if git cat-file -e "HEAD:${asset#/}" 2>/dev/null; then now=$(git show "HEAD:${asset#/}" | md5_10); else now='missing'; fi
  [ "$stamp" = "$now" ] || echo "  $page asks for $asset?v=$stamp, the file is $now"
done)
if [ -n "$stale" ]; then
  echo "refusing to stage: pages ask for an asset by a stale stamp (rerun the stamping, then commit)" >&2
  echo "$stale" >&2
  exit 1
fi

if [ "$out" = "$default" ]; then
  rm -rf "$out"
elif [ -e "$out" ] && [ -n "$(ls -A "$out")" ]; then
  echo "refusing to stage into $out: it is not empty" >&2
  exit 1
fi

mkdir -p "$out"
git archive HEAD | tar -x -C "$out"

echo "staged $(git rev-parse --short HEAD) -> $out ($(find "$out" -type f | wc -l | tr -d ' ') files)"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse --verify -q origin/main || true)" ]; then
  echo "note:  HEAD is not origin/main. Push before or right after you deploy."
fi
echo "next:  tools/audit.sh $out"
echo "then, from a directory outside the bundle (wrangler writes .wrangler/ into its cwd):"
echo "  npx --yes wrangler@latest pages deploy $out --project-name sean-sooch-portfolio --branch=main --commit-dirty=true"
