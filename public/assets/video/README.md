# Vidéos du site

Les `.mp4` de ce dossier sont des **placeholders générés** (`scripts/gen-placeholders.sh`).
À remplacer par les vrais masters en gardant les mêmes noms :

| Fichier | Contenu attendu |
|---|---|
| `candia.mp4` | Billboard Candia × TF1 — ✅ master réel (Danse avec les Stars 2026) |
| `candia-pekin.mp4` | Billboard Candia (Pékin Express / Koh Lanta / Île de la Tentation) — ✅ master réel, pas encore câblé dans le site |
| `xpeng.mp4` | Film XPeng × Samsung |
| `fooh.mp4` | Capsule FOOH |
| `showreel.mp4` | Showreel (réserve, hero futur) |

## Encodage requis pour le scrub au scroll

Le défilement pilote `video.currentTime` : il faut des keyframes denses, sinon ça saccade.

```bash
ffmpeg -i master.mov -c:v libx264 -preset slow -crf 23 -g 12 \
  -movflags +faststart -an -vf "scale=1280:-2" candia.mp4
```

- `-g 12` : une keyframe toutes les 12 frames (indispensable)
- `-an` : pas d'audio (les vidéos sont muettes)
- `-movflags +faststart` : lecture immédiate au streaming
- 1280 px de large suffisent (affichage ≤ 760 px)
- Viser < 8 Mo par clip ; 6–10 s par extrait
