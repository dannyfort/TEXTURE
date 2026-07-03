#!/bin/bash
# Génère 4 vidéos placeholder cinématiques (gradients animés + grain + letterbox + timecode incrusté).
# Encodage keyframe-dense (-g 12) pour un scrub au scroll fluide. À remplacer par les vrais masters.
set -euo pipefail
cd "$(dirname "$0")/../public/assets/video"

HELV="/System/Library/Fonts/Helvetica.ttc"
MONO="/System/Library/Fonts/Monaco.ttf"

common_out=(-c:v libx264 -preset fast -crf 27 -g 12 -movflags +faststart -an)

ffmpeg -y -loglevel error -f lavfi \
  -i "gradients=s=1280x720:d=8:c0=0x241a0e:c1=0x07050a:c2=0x3a2812:nb_colors=3:speed=0.025,format=yuv420p" \
  -vf "noise=alls=9:allf=t,drawbox=y=0:h=92:c=black:t=fill,drawbox=y=628:h=92:c=black:t=fill,drawtext=text='CANDIA x TF1':fontcolor=0xE8DCC8:fontsize=62:x=(w-text_w)/2:y=(h-text_h)/2-34:fontfile=${HELV},drawtext=text='FOOTAGE PROVISOIRE - SPONSORING TV':fontcolor=0x9a8d76:fontsize=21:x=(w-text_w)/2:y=(h)/2+44:fontfile=${HELV},drawtext=text='TC %{pts\:hms}':fontcolor=0x9a8d76:fontsize=19:x=44:y=44:fontfile=${MONO}" \
  "${common_out[@]}" candia.mp4

ffmpeg -y -loglevel error -f lavfi \
  -i "gradients=s=1280x720:d=8:c0=0x0e1824:c1=0x05070a:c2=0x12283a:nb_colors=3:speed=0.025,format=yuv420p" \
  -vf "noise=alls=9:allf=t,drawbox=y=0:h=92:c=black:t=fill,drawbox=y=628:h=92:c=black:t=fill,drawtext=text='XPENG x SAMSUNG':fontcolor=0xD8E2E8:fontsize=62:x=(w-text_w)/2:y=(h-text_h)/2-34:fontfile=${HELV},drawtext=text='FOOTAGE PROVISOIRE - FILM PRODUIT 3D':fontcolor=0x768d9a:fontsize=21:x=(w-text_w)/2:y=(h)/2+44:fontfile=${HELV},drawtext=text='TC %{pts\:hms}':fontcolor=0x768d9a:fontsize=19:x=44:y=44:fontfile=${MONO}" \
  "${common_out[@]}" xpeng.mp4

ffmpeg -y -loglevel error -f lavfi \
  -i "gradients=s=1280x720:d=8:c0=0x1e0e24:c1=0x08050a:c2=0x2e123a:nb_colors=3:speed=0.025,format=yuv420p" \
  -vf "noise=alls=9:allf=t,drawbox=y=0:h=92:c=black:t=fill,drawbox=y=628:h=92:c=black:t=fill,drawtext=text='F.O.O.H.':fontcolor=0xE4D8E8:fontsize=70:x=(w-text_w)/2:y=(h-text_h)/2-34:fontfile=${HELV},drawtext=text='FOOTAGE PROVISOIRE - GRANDEUR NATURE':fontcolor=0x8d769a:fontsize=21:x=(w-text_w)/2:y=(h)/2+44:fontfile=${HELV},drawtext=text='TC %{pts\:hms}':fontcolor=0x8d769a:fontsize=19:x=44:y=44:fontfile=${MONO}" \
  "${common_out[@]}" fooh.mp4

ffmpeg -y -loglevel error -f lavfi \
  -i "gradients=s=1280x720:d=8:c0=0x1c140c:c1=0x060508:c2=0x2a1c10:nb_colors=3:speed=0.025,format=yuv420p" \
  -vf "noise=alls=9:allf=t,drawbox=y=0:h=92:c=black:t=fill,drawbox=y=628:h=92:c=black:t=fill,drawtext=text='TEXTURE':fontcolor=0xE8DCC8:fontsize=70:x=(w-text_w)/2:y=(h-text_h)/2-34:fontfile=${HELV},drawtext=text='SHOWREEL PROVISOIRE':fontcolor=0x9a8d76:fontsize=21:x=(w-text_w)/2:y=(h)/2+44:fontfile=${HELV},drawtext=text='TC %{pts\:hms}':fontcolor=0x9a8d76:fontsize=19:x=44:y=44:fontfile=${MONO}" \
  "${common_out[@]}" showreel.mp4

ls -la ./*.mp4
