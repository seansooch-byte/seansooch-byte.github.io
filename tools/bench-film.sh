#!/bin/bash
# Add one film to the Claudia Bench (/music/claudia-bench/).
#
# Expected behaviour (the contract, since this repo has no test harness):
#   - Writes music/claudia-bench/media/<slug>/: index.m3u8, s000.ts, s001.ts ...
#     and poster.jpg (the frame at <poster-seconds>). Nothing else.
#   - ONE rendition: 720p, CRF 24 capped at 2 Mbit/s, AAC 128k. A film costs
#     about a fifth of LAST LIGHT's 1080p + 720p ladder, so the bench can keep
#     growing without the repo or a deploy upload growing with it.
#   - 6 s segments with keyframes on the segment grid. Cloudflare Pages serves
#     no file over 25 MiB, so it exits non-zero if any file it wrote is bigger.
#   - Refuses a slug that already has a folder: re-encoding means deleting it.
#   - Then add the film to FILMS in music/claudia-bench/index.html.
#
# Usage: tools/bench-film.sh <master.mp4> <slug> <poster-seconds>
set -euo pipefail

master="$1"; slug="$2"; poster="$3"
cd "$(dirname "$0")/.."
dest="music/claudia-bench/media/$slug"
if [ -e "$dest" ]; then echo "refusing: $dest exists" >&2; exit 1; fi
mkdir -p "$dest"

fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$master")
gop=$(python3 -c "from fractions import Fraction as F; import sys; print(round(6 * F(sys.argv[1])))" "$fps")

ffmpeg -v error -y -i "$master" -map 0:v:0 -map 0:a:0 \
  -vf "scale=-2:720:flags=lanczos" \
  -c:v libx264 -profile:v high -preset slow -pix_fmt yuv420p \
  -crf 24 -maxrate 2M -bufsize 4M \
  -g "$gop" -keyint_min "$gop" -sc_threshold 0 \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments \
  -hls_segment_filename "$dest/s%03d.ts" "$dest/index.m3u8"
ffmpeg -v error -y -ss "$poster" -i "$master" -frames:v 1 -vf "scale=-2:720:flags=lanczos" -q:v 3 "$dest/poster.jpg"

big=$(find "$dest" -type f -size +25M)
if [ -n "$big" ]; then echo "over 25 MiB: $big" >&2; exit 1; fi
echo "$slug: $(du -sh "$dest" | cut -f1), $(ls "$dest" | grep -c '\.ts$') segments"
