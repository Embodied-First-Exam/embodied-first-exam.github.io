#!/bin/sh
# Rebuild the leaderboard slide of the intro video (site/blog/efe-intro.mp4, 13.6-16.1 s).
# 1. edit NEW_ROWS in lb9.py (the site's Standard view: solved / core Standard tests, in the leaderboard's order);
# 2. sh run.sh WORKDIR   -> WORKDIR/out/efe-intro.mp4, plus checks;
# 3. upload it to MLL-Lab/embodied-exam-data at site/blog/efe-intro.mp4 and set ?v=<first 8 of its sha256> on the
#    pages that use it (index.html, blogs/first-exam/index.html, data/blogs.json).
# Needs ffmpeg, Python with numpy, Pillow and Playwright (Chromium).
set -e
HERE=$(cd "$(dirname "$0")" && pwd); W=${1:?workdir}
mkdir -p "$W/dl" "$W/cur" "$W/fonts" "$W/out"
cp "$HERE/lb9.py" "$HERE/splice.py" "$W/"
cd "$W"
[ -f dl/efe-intro.mp4 ] || curl -sSL -o dl/efe-intro.mp4 https://huggingface.co/datasets/MLL-Lab/embodied-exam-data/resolve/main/site/blog/efe-intro.mp4
[ -f fonts/roman319.woff2 ] || curl -sSL -o fonts/roman319.woff2 https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-roman.var.woff2
ffmpeg -v error -y -i dl/efe-intro.mp4 -vf "select=between(n\,400\,500)" -vsync 0 -start_number 400 cur/%04d.png
python3 lb9.py validate        # the renderer against the current frames; the rows region should differ by a few levels only
python3 lb9.py new
python3 splice.py dl/efe-intro.mp4 out/efe-intro.mp4
# checks: frames outside the re-encoded span and the audio must be bit-identical to the current file
for r in "0 408" "495 99999"; do set -- $r
  a=$(ffmpeg -v error -i out/efe-intro.mp4 -vf "select=between(n\,$1\,$2)" -vsync 0 -f rawvideo -pix_fmt yuv420p - | md5sum)
  b=$(ffmpeg -v error -i dl/efe-intro.mp4 -vf "select=between(n\,$1\,$2)" -vsync 0 -f rawvideo -pix_fmt yuv420p - | md5sum)
  [ "$a" = "$b" ] && echo "frames $1-$2 identical" || { echo "frames $1-$2 DIFFER"; exit 1; }
done
a=$(ffmpeg -v error -i out/efe-intro.mp4 -map 0:a -c copy -f data - | md5sum); b=$(ffmpeg -v error -i dl/efe-intro.mp4 -map 0:a -c copy -f data - | md5sum)
[ "$a" = "$b" ] && echo "audio identical" || { echo "audio DIFFERS"; exit 1; }
sha256sum out/efe-intro.mp4 | cut -c1-8
