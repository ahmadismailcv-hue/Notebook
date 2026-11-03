#!/usr/bin/env bash
# Assemble clips/01..12.mp4 (animated, with model-generated sound) into the final video.
# Upscales to 1080x1920, crossfades picture and sound, and lays the synthetic wind/stove bed underneath.
# Usage: build/make_animated.sh   (run from anywhere)
set -euo pipefail
cd "$(dirname "$0")/.."
N=12; XF=0.5; FPS=30
TMP=$(mktemp -d)

# normalise every clip: same size, fps, duration and audio format
for i in $(seq 1 $N); do
  f=$(printf "%02d" "$i")
  ffmpeg -v error -y -i "clips/$f.mp4" -f lavfi -i anullsrc=r=44100:cl=stereo \
    -filter_complex "[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,fps=$FPS,format=yuv420p,setsar=1[v];[0:a]loudnorm=I=-23:TP=-3:LRA=11,aresample=44100[ca];[ca][1:a]amix=inputs=2:duration=first:normalize=0,aresample=44100,aformat=channel_layouts=stereo[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 17 -c:a pcm_s16le "$TMP/$f.mkv" 2>/dev/null \
  || ffmpeg -v error -y -i "clips/$f.mp4" -f lavfi -i anullsrc=r=44100:cl=stereo \
    -filter_complex "[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,fps=$FPS,format=yuv420p,setsar=1[v]" \
    -map "[v]" -map 1:a -shortest -c:v libx264 -preset medium -crf 17 -c:a pcm_s16le "$TMP/$f.mkv"
done

D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/01.mkv")
SHOT=$(python3 -c "print(round(float('$D'),3))")
inputs=""; vf=""; af=""; pv="0:v"; pa="0:a"
for i in $(seq 1 $N); do inputs="$inputs -i $TMP/$(printf %02d $i).mkv"; done
for i in $(seq 1 $((N-1))); do
  off=$(python3 -c "print(round($i*($SHOT-$XF),3))")
  vf="$vf[$pv][$i:v]xfade=transition=fade:duration=$XF:offset=$off[v$i];"; pv="v$i"
  af="$af[$pa][$i:a]acrossfade=d=$XF[a$i];"; pa="a$i"
done
TOTAL=$(python3 -c "print(round($N*$SHOT-($N-1)*$XF,3))")
SHOT=$SHOT XF=$XF python3 build/make_audio.py "$TMP/bed.wav"
filt="$vf$af[$pv]fade=t=in:st=0:d=1.0,fade=t=out:st=$(python3 -c "print($TOTAL-2.0)"):d=2.0[vout];"
filt="$filt[$pa]volume=1.0[clipsnd];[$N:a]volume=0.45[bed];[clipsnd][bed]amix=inputs=2:duration=first:normalize=0,afade=t=in:d=1.0,afade=t=out:st=$(python3 -c "print($TOTAL-2.5)"):d=2.5,alimiter=limit=0.9[aout]"
# shellcheck disable=SC2086
ffmpeg -v error -y $inputs -i "$TMP/bed.wav" -filter_complex "$filt" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 192k -movflags +faststart winter-night-zakho-1970-animated.mp4
rm -rf "$TMP"
echo "done: winter-night-zakho-1970-animated.mp4 (${TOTAL}s)"
