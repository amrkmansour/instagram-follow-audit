#!/usr/bin/env bash
set -euo pipefail

episode_dir="$(cd "$(dirname "$0")" && pwd)"
source_video="$episode_dir/output/episode-01-high-school-friend.mp4"
output_video="$episode_dir/output/episode-01-high-school-friend-expressive-voice.mp4"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# Two character voices, varied speaking rates, short lines, and emphatic punctuation
# make the dialogue feel conversational instead of like one continuous narration.
say -v Samantha -r 188 -o "$work_dir/01.aiff" "Friends forever?"
say -v "Shelley (English (US))" -r 205 -o "$work_dir/02.aiff" "Obviously!"
say -v "Shelley (English (US))" -r 198 -o "$work_dir/03.aiff" "Cass? Seriously?"
say -v Samantha -r 176 -o "$work_dir/04.aiff" "After every vacation photo?"
say -v "Shelley (English (US))" -r 184 -o "$work_dir/05.aiff" "She was a follower. Then she wasn't."
say -v "Shelley (English (US))" -r 170 -o "$work_dir/06.aiff" "I can keep the memory."

ffmpeg -y \
  -i "$source_video" \
  -i "$work_dir/01.aiff" -i "$work_dir/02.aiff" -i "$work_dir/03.aiff" \
  -i "$work_dir/04.aiff" -i "$work_dir/05.aiff" -i "$work_dir/06.aiff" \
  -filter_complex "\
    [1:a]adelay=180|180,volume=1.10[a1];\
    [2:a]adelay=1450|1450,volume=1.08[a2];\
    [3:a]adelay=3000|3000,volume=1.10[a3];\
    [4:a]adelay=5750|5750,volume=0.94[a4];\
    [5:a]adelay=7350|7350,volume=1.08[a5];\
    [6:a]adelay=9800|9800,volume=1.02[a6];\
    [a1][a2][a3][a4][a5][a6]amix=inputs=6:duration=longest:normalize=0,\
    highpass=f=90,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,\
    loudnorm=I=-16:TP=-1.5:LRA=8,aresample=48000,apad=pad_dur=15[voice]" \
  -map 0:v:0 -map "[voice]" -c:v copy -c:a aac -b:a 192k -t 15 -movflags +faststart "$output_video"

echo "$output_video"
