#!/usr/bin/env bash
# Assemble stills/01..12.png into a 1080x1920 video with slow camera moves, crossfades and ambient audio.
# Usage: build/make_video.sh   (run from kurdish-village-1970/)
set -euo pipefail
cd "$(dirname "$0")/.."
SHOT=4.5; XF=0.7; FPS=30
FRAMES=$(python3 -c "print(int($SHOT*$FPS))")
TMP=$(mktemp -d)

# camera move per shot: in = slow push in, out = slow pull back, up/down = vertical pan
MOVES=(in down in out in in out in up in in out)

for i in $(seq 1 12); do
  f=$(printf "%02d" "$i"); m=${MOVES[$((i-1))]}
  case $m in
    in)   Z="1.0+0.10*on/$FRAMES"; X="iw/2-(iw/zoom/2)"; Y="ih/2-(ih/zoom/2)";;
    out)  Z="1.10-0.10*on/$FRAMES"; X="iw/2-(iw/zoom/2)"; Y="ih/2-(ih/zoom/2)";;
    up)   Z="1.12"; X="iw/2-(iw/zoom/2)"; Y="(ih-ih/zoom)*(1-on/$FRAMES)";;
    down) Z="1.12"; X="iw/2-(iw/zoom/2)"; Y="(ih-ih/zoom)*on/$FRAMES";;
  esac
  ffmpeg -v error -y -loop 1 -i "stills/$f.png" -frames:v "$FRAMES" -vf \
    "scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='$Z':x='$X':y='$Y':d=1:s=1080x1920:fps=$FPS,format=yuv420p" \
    -c:v libx264 -preset medium -crf 18 "$TMP/$f.mp4"
done

# chain crossfades
inputs=""; filt=""; prev="0:v"
for i in $(seq 1 12); do inputs="$inputs -i $TMP/$(printf %02d $i).mp4"; done
for i in $(seq 1 11); do
  off=$(python3 -c "print(round($i*($SHOT-$XF),3))")
  out="v$i"; filt="$filt[$prev][$i:v]xfade=transition=fade:duration=$XF:offset=$off[$out];"
  prev=$out
done
TOTAL=$(python3 -c "print(12*$SHOT-11*$XF)")
filt="$filt[$prev]fade=t=in:st=0:d=1.2,fade=t=out:st=$(python3 -c "print($TOTAL-2.5)"):d=2.5[vout]"

python3 build/make_audio.py "$TMP/ambience.wav"
# shellcheck disable=SC2086
ffmpeg -v error -y $inputs -i "$TMP/ambience.wav" -filter_complex "$filt" \
  -map "[vout]" -map 12:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 192k -shortest -movflags +faststart winter-night-zakho-1970.mp4
cp "$TMP/ambience.wav" build/ambience.wav
rm -rf "$TMP"
echo "done: winter-night-zakho-1970.mp4"
