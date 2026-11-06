#!/usr/bin/env bash
# Assemble dawn-prayer clips into one 1080x1920 video with crossfades and loudness-matched sound.
# Usage: dawn-prayer/build.sh   (order below; clips/NN.mp4 must exist)
set -euo pipefail
cd "$(dirname "$0")"
ORDER=(01 02 03 04 06 05 07 08)   # 06 = stepping out of the house, before the walk (05)
XF=0.5; FPS=30; OUT=dawn-prayer-zakho-1970.mp4
TMP=$(mktemp -d)

durs=()
for f in "${ORDER[@]}"; do
  ffmpeg -v error -y -i "clips/$f.mp4" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex \
    "[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,fps=$FPS,format=yuv420p,setsar=1[v];[0:a]loudnorm=I=-20:TP=-3:LRA=11,aresample=44100[ca];[ca][1:a]amix=inputs=2:duration=first:normalize=0,aformat=channel_layouts=stereo[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 17 -c:a pcm_s16le "$TMP/$f.mkv"
  durs+=("$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/$f.mkv")")
done

inputs=""; vf=""; af=""; pv="0:v"; pa="0:a"; t=0
for i in "${!ORDER[@]}"; do inputs="$inputs -i $TMP/${ORDER[$i]}.mkv"; done
for i in $(seq 1 $((${#ORDER[@]}-1))); do
  t=$(python3 -c "print(round($t+${durs[$((i-1))]}-$XF,3))")
  vf="$vf[$pv][$i:v]xfade=transition=fade:duration=$XF:offset=$t[v$i];"; pv="v$i"
  af="$af[$pa][$i:a]acrossfade=d=$XF[a$i];"; pa="a$i"
done
TOTAL=$(python3 -c "print(round($t+${durs[-1]},3))")
filt="$vf$af[$pv]fade=t=in:st=0:d=1.0,fade=t=out:st=$(python3 -c "print($TOTAL-1.8)"):d=1.8[vout];[$pa]afade=t=in:d=1.0,afade=t=out:st=$(python3 -c "print($TOTAL-2.2)"):d=2.2,alimiter=limit=0.9[aout]"
# shellcheck disable=SC2086
ffmpeg -v error -y $inputs -filter_complex "$filt" -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r $FPS -c:a aac -b:a 192k -movflags +faststart "$OUT"
rm -rf "$TMP"
echo "done: $OUT (${TOTAL}s)"
