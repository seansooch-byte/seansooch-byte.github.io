#!/bin/bash
# Turn one film into what the /music/ players stream (music/films.js).
#
# Expected behaviour (the contract, since this repo has no test harness):
#   - Writes <dest>/: index.m3u8, s000.ts, s001.ts ... and poster.jpg (the
#     frame at <poster-seconds>, 720 px tall). Nothing else. <dest> must not exist.
#   - ONE 720p stream per film, so a film costs tens of megabytes and the music
#     section can keep growing without the repo or a deploy growing with it.
#   - A master that is already H.264 + AAC at 720p or less is segmented as is
#     (no second encode; its own keyframes set the segment edges). Anything
#     else is re-encoded: 720p, CRF 24 capped at 2 Mbit/s, AAC 128k, 6 s
#     segments with keyframes on the grid.
#   - Cloudflare Pages serves no file over 25 MiB: exits non-zero if any file
#     it wrote is bigger.
#   - Then add the film to the page's films list (<script id="films">).
#
# Usage: tools/music-film.sh <master.mp4> <dest-dir> <poster-seconds>
#   e.g. tools/music-film.sh ~/Downloads/x.mp4 music/media/<slug> 4
set -euo pipefail

master="$1"; dest="$2"; poster="$3"
cd "$(dirname "$0")/.."
if [ -e "$dest" ]; then echo "refusing: $dest exists" >&2; exit 1; fi
mkdir -p "$dest"

v=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,height -of csv=p=0 "$master")
a=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$master")
hls=(-f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments
     -hls_segment_filename "$dest/s%03d.ts" "$dest/index.m3u8")

if [ "${v%%,*}" = "h264" ] && [ "${v##*,}" -le 720 ] && [ "$a" = "aac" ]; then
  mode="copied"
  ffmpeg -v error -y -i "$master" -map 0:v:0 -map 0:a:0 -c copy "${hls[@]}"
else
  mode="re-encoded"
  fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$master")
  gop=$(python3 -c "from fractions import Fraction as F; import sys; print(round(6 * F(sys.argv[1])))" "$fps")
  ffmpeg -v error -y -i "$master" -map 0:v:0 -map 0:a:0 \
    -vf "scale=-2:720:flags=lanczos" \
    -c:v libx264 -profile:v high -preset slow -pix_fmt yuv420p \
    -crf 24 -maxrate 2M -bufsize 4M \
    -g "$gop" -keyint_min "$gop" -sc_threshold 0 \
    -c:a aac -b:a 128k -ac 2 "${hls[@]}"
fi
ffmpeg -v error -y -ss "$poster" -i "$master" -frames:v 1 -vf "scale=-2:720:flags=lanczos" -q:v 3 "$dest/poster.jpg"

big=$(find "$dest" -type f -size +25M)
if [ -n "$big" ]; then echo "over 25 MiB: $big" >&2; exit 1; fi
echo "$dest: $mode, $(du -sh "$dest" | cut -f1), $(ls "$dest" | grep -c '\.ts$') segments"
