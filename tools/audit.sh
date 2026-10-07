#!/bin/bash
# Audit a staged bundle against the live site, file by file.
#
# Expected behaviour (this repo has no test harness, so the contract lives here):
#   - Every file under <dir> is fetched from <origin> and compared by SHA-256.
#   - HTML is compared after removing the two things Cloudflare adds to every
#     page at the edge: a hidden honeypot link and a challenge-platform script.
#   - _headers and _redirects are skipped. Pages consumes them and does not
#     serve them, so their effect is checked by behaviour, not by bytes.
#   - A mismatch is retried once with a cache-busting query, because a stale
#     edge copy is a false alarm.
#   - Anything in the bundle that is not a regular file or a directory (a
#     symlink, say) is a DIFF: it cannot be compared, and it should not ship.
#   - Prints one DIFF line per mismatch, then a tally. Exits 0 only when every
#     file matched. An unknown path on Pages answers 200 with the homepage, so
#     a file that is missing from live shows up as a DIFF, never as a 404.
#
# Before a deploy the DIFF list should be exactly the files you meant to
# change. After a deploy it should be empty.
#
# Usage: tools/audit.sh [dir] [origin]
#   dir     defaults to /tmp/seansooch-bundle (what tools/stage.sh writes)
#   origin  defaults to https://seansooch.dev
set -euo pipefail

dir="${1:-/tmp/seansooch-bundle}"
origin="${2:-https://seansooch.dev}"
[ -d "$dir" ] || { echo "no bundle at $dir (run tools/stage.sh first)" >&2; exit 2; }

digest() { shasum -a 256 | cut -d' ' -f1; }
fetch() { curl -fsSL --max-time 180 "$1" 2>/dev/null || true; }
edge() {
  perl -0pe '
    s#<a href="[^"]*/cdn-cgi/content\?[^"]*"[^>]*></a>##g;
    s#<script>(?:(?!</script>).)*?/cdn-cgi/challenge-platform/(?:(?!</script>).)*?</script>##gs;
  '
}

check() {
  local rel="${1#./}" url filter=cat want u
  case "$rel" in
    index.html)   url="$origin/" ;;
    */index.html) url="$origin/${rel%index.html}" ;;
    *)            url="$origin/$rel" ;;
  esac
  case "$rel" in *.html) filter=edge ;; esac
  want=$($filter < "$rel" | digest)
  for u in "$url" "$url?audit=$RANDOM"; do
    [ "$(fetch "$u" | $filter | digest)" = "$want" ] && return 0
  done
  echo "DIFF  /$rel"
}

cd "$dir"
export origin
export -f digest fetch edge check

served=(find . ! -type d ! -name _headers ! -name _redirects)
total=$("${served[@]}" | wc -l | tr -d ' ')
# A worker that cannot run fails the substitution, and set -e stops the audit:
# it must never report a clean result it did not measure.
diffs=$(
  "${served[@]}" ! -type f | sed 's#^\./\(.*\)#DIFF  /\1  (not a regular file)#'
  "${served[@]}" -type f -print0 | xargs -0 -n 1 -P 8 "$BASH" -c 'check "$0"'
)

[ -z "$diffs" ] || echo "$diffs" | sort
n=$(printf '%s' "$diffs" | grep -c . || true)
echo "$((total - n)) of $total files identical to $origin"
[ "$n" -eq 0 ]
