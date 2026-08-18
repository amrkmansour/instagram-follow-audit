#!/usr/bin/env bash
set -euo pipefail

batch_dir="$(cd "$(dirname "$0")" && pwd)"
font="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
only_episode="${1:-}"

render_episode() {
  local number="$1" slug="$2" hook="$3" reveal="$4" punchline="$5"
  local line1="$6" line2="$7" line3="$8" voice1="$9" voice2="${10}"
  local image="$batch_dir/assets/${number}-${slug}.png"
  local output="$batch_dir/output/${number}-${slug}.mp4"
  local episode_work="$work_dir/$number"
  if [[ -n "$only_episode" && "$number" != "$only_episode" ]]; then
    return
  fi
  mkdir -p "$episode_work"

  swift "$batch_dir/render_caption_cards.swift" "$episode_work" "$hook" "$reveal" "$punchline"

  say -v "$voice1" -r 188 -o "$episode_work/line1.aiff" "$line1"
  say -v "$voice2" -r 202 -o "$episode_work/line2.aiff" "$line2"
  say -v "$voice1" -r 178 -o "$episode_work/line3.aiff" "$line3"

  ffmpeg -hide_banner -loglevel error -y \
    -loop 1 -framerate 30 -i "$image" \
    -loop 1 -framerate 30 -i "$episode_work/caption-1.png" \
    -loop 1 -framerate 30 -i "$episode_work/caption-2.png" \
    -loop 1 -framerate 30 -i "$episode_work/caption-3.png" \
    -loop 1 -framerate 30 -i "$episode_work/end-card.png" \
    -i "$episode_work/line1.aiff" -i "$episode_work/line2.aiff" -i "$episode_work/line3.aiff" \
    -filter_complex "\
      [0:v]scale=1200:2133,zoompan=z='min(zoom+0.00028,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=360:s=1080x1920:fps=30[bg];\
      [bg][1:v]overlay=enable='between(t,0,3.2)'[v1];\
      [v1][2:v]overlay=enable='between(t,3.2,6.5)'[v2];\
      [v2][3:v]overlay=enable='between(t,6.5,10)'[v3];\
      [v3][4:v]overlay=enable='between(t,10,12)',format=yuv420p[v];\
      [5:a]adelay=180|180,volume=1.08[a1];\
      [6:a]adelay=3300|3300,volume=1.04[a2];\
      [7:a]adelay=6600|6600,volume=1.06[a3];\
      [a1][a2][a3]amix=inputs=3:duration=longest:normalize=0,highpass=f=90,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=48000,apad=pad_dur=12[a]" \
    -map '[v]' -map '[a]' -c:v libx264 -preset medium -crf 19 -c:a aac -b:a 192k -t 12 -movflags +faststart "$output"
}

render_episode 01 work-bestie \
  'YOUR WORK BESTIE?' 'CURRENT STATUS: ONE-WAY.' 'THE OFFICE LORE CONTINUES.' \
  'My work bestie? We shared a desk drawer and a breakdown.' \
  'Current follow status: one-way.' \
  'The office lore continues.' \
  Samantha 'Shelley (English (US))'

render_episode 02 group-chat-ghost \
  'THE GROUP CHAT OPENED A CASE.' 'THREE SUSPECTS. TOO MUCH STRING.' 'THE FILE HAD THE ANSWER.' \
  'The group chat opened a full investigation.' \
  'Three suspects. Way too much red string.' \
  'The official export had the answer.' \
  'Shelley (English (US))' Samantha

render_episode 03 gym-partner \
  'ACCOUNTABILITY PARTNER?' 'THE FOLLOW IS ONE-WAY.' 'THE WATER BOTTLES TOOK IT HARD.' \
  'My accountability partner?' \
  'She skipped leg day, and the follow back.' \
  'The matching water bottles are taking it personally.' \
  Samantha 'Shelley (English (US))'

render_episode 04 vacation-witness \
  'HE WAS IN EVERY VACATION PHOTO.' 'CURRENT STATUS: ONE-WAY.' 'THE PHOTOBOMBS LIVE FOREVER.' \
  'He photobombed every vacation. Every single one.' \
  'Current follow status: one-way.' \
  'At least the photos are committed.' \
  'Shelley (English (US))' Samantha

render_episode 05 cousin-watches-everything \
  'SHE WATCHES EVERY UPDATE.' 'CURRENT STATUS: ONE-WAY.' 'THE POPCORN EXPLAINS NOTHING.' \
  'My cousin watches every update with popcorn.' \
  'Current follow status: one-way.' \
  'I have questions. Follow Check has the list.' \
  Samantha 'Shelley (English (US))'

printf '%s\n' "$batch_dir/output"/*.mp4
