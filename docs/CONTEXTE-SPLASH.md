# Contexte — Immersion SPLASH sous l'eau (pont vidéo + particules WebGL)

> Document de passation pour repartir proprement dans une nouvelle discussion.
> **Objectif : la partie plongée seulement** (zoom eau → vidéo splash → retour WebGL underwater). Le reste de la page ne bouge pas.

## 🎯 Le prompt à réaliser

> Quand je scroll et ça zoom sur l'eau pour me faire pénétrer underwater, dans le scroll remplace par cette vidéo : `/Users/danielfortunato/Desktop/TEXTURE/WATER VIDEO /MONTAGE/splash v1_gcg5.mp4`. Il faut qu'en scroll, **après le zoom avant**, ça **morph/fade fluidement et de manière imperceptible** vers cette vidéo splashv1. Puis **ajouter des effets 3D WebGL de particules**. Construire l'expérience la plus **immersive et fluide** : le comportement de scroll doit nous faire **plonger au travers de l'eau**. Une fois la vidéo d'eau finie, on peut **repasser au WebGL underwater actuel**. Focus : **immersion SPLASH + comportement de scroll uniquement** pour le moment.

## ✅ Déjà préparé dans cette session

- **Asset encodé et prêt : `public/video/splash-plongee.mp4`** (4,1 Mo).
  - Ré-encodage de `splash v1_gcg5.mp4` en **H.264 all-intra** (`-g 1 -keyint_min 1`, CRF 21, `+faststart`, audio retiré).
  - **Toutes les frames sont des I-frames → scrubbing par `currentTime` parfaitement fluide** (indispensable : une vidéo classique ne se scrube pas image par image sans saccades).
  - 1920×1080, **24 fps, 85 frames, 3,54 s**.
- Aucune modif de code n'a été conservée (l'édition entamée sur `galaxie.js` a été **annulée** — le fichier est intact).

## 📹 Contenu de la vidéo splash (analyse frame par frame)

Trajectoire caméra idéale pour un plongeon :
1. **0 → 1,4 s** : surface de l'eau en contre-plongée, soleil rasant, reflets. Ondulations lentes.
2. **~1,4 → 2,0 s** : **impact / traversée de la surface** — mousse blanche, éclaboussures plein cadre (le « splash »).
3. **2,0 → 3,5 s** : **sous l'eau** — bulles qui remontent, rais de lumière (god rays) bleus qui plongent vers le bas, bleu profond.
4. Fin (3,5 s) : bleu sombre → **raccord naturel vers le WebGL underwater** (fog `#03181d`).

➡️ La vidéo raconte déjà exactement la plongée : surface → impact → bulles → profondeur. La fin fond vers le bleu du décor 3D existant.

## 🧱 Architecture actuelle (audit)

### Le voyage global
Page unique en scroll : **surface océan → plongée sous l'eau (manifeste) → remontée dans une galaxie** (tout le site vit dans la galaxie). Tout le WebGL tourne sur **un seul `<canvas id="stage">`** via un « plateau » multi-scènes.

| Fichier | Rôle |
|---|---|
| `src/main.js` | Boot : `ScrollSmoother` (`smooth: 2.4`), loader→ident, import différé des scènes, refreshs |
| `src/scenes/stage.js` | Le plateau : 1 renderer, N scènes dessinées dans l'ordre avec `clearDepth`. Ticker GSAP. `renderer.autoClear = false` |
| `src/scenes/index.js` | Câblage scroll↔3D : enregistre `galaxie` en premier (le fond), puis bobine + méthode par-dessus |
| **`src/scenes/galaxie.js`** | **⭐ LE FICHIER À MODIFIER** — décor de fond (underwater + galaxie) **+ la timeline maîtresse scrubée** qui pilote tout le pont vidéo |
| `src/lib/video-scrub.js` | Helpers : `scrubVideo()` (pilote `currentTime` par le scroll, **déjà quantifié à 24 fps** — réutilisable tel quel), `playInView`, `freezeFrame` |
| `index.html` | DOM des vidéos hero (`#heroEau`, `#heroBulles`), `#flash`, structure des sections |
| `src/styles/sections/hero.css` | `.hero-eau` / `.hero-bulles` en `position: fixed; inset:0; object-fit:cover; z-index:0` |

### Le pont vidéo ACTUEL (à remplacer) — `galaxie.js` timeline maîtresse (~ lignes 258-305)

ScrollTrigger de la timeline maîtresse : `trigger: '#hero'`, `endTrigger: '#sortie'`, `scrub: 1.3`.
Le pont actuel (unités de temps de la timeline, 0→~24) :
```js
.to('#heroEau',    { scale: 2.4, ... }, 0)              // zoom avant dans l'eau
.set('#heroBulles',{ opacity: 1 }, 19.2)                 // bulles claquent
.to('#heroBulles', { scale: 1.65, ... }, 19.2)
.to('#heroEau',    { opacity: 0, ... }, 19.5)            // l'eau s'efface
.to('#heroBulles', { opacity: 0, ... }, 21)              // bulles → révèlent le WebGL underwater
.to(atmo, { mixUnder: 1, ... }, 17)                      // fog passe en bleu sous-marin
.to('#flash', { opacity: 0.95 → 0, ... })                // flash de coupe masque le raccord
```
- `#heroBulles` (`public/video/bulles.mp4`) joue en `playbackRate = 2.75` (impact bref).
- Proxies animés par GSAP : `cam {y,x,z,rx,ry,rz}`, `atmo {mixUnder,mixSpace,galaxy}`, `dolly {z}`. Le scroll écrit dedans, `update()` les lit (lignes ~379-438).
- Le décor **underwater** (particules, coraux, rais de lumière, bokeh) existe déjà dans `galaxie.js` (`uw` group, lignes ~48-153), visible quand `cam.y < 60`.

## 🛠️ Approche recommandée pour l'implémentation

**Remplacer le pont `heroEau → heroBulles`** par : **`heroEau (zoom) → vidéo splash scrubée → WebGL underwater`**, avec fondus imperceptibles.

Deux options pour la vidéo splash :

**Option A (recommandée) — plan WebGL en `VideoTexture` dans `galaxie.js`.**
- Un `THREE.Mesh(PlaneGeometry, MeshBasicMaterial{ map: VideoTexture })` collé à la caméra (enfant de `camera`, `depthTest:false`, `toneMapped:false`, `fog:false`), plein cadre.
- **Avantage clé : les particules 3D peuvent passer DEVANT la vidéo** (vraie profondeur), et le fondu vidéo→underwater se fait dans le même espace WebGL → raccord invisible.
- Scrubbing : mapper la progression scroll → `video.currentTime` (réutiliser la logique quantifiée 24 fps de `video-scrub.js`).
- Redimensionnement plein cadre : calculer `planeW/planeH` selon l'aspect caméra à la distance du plan (recalculer au `resize`).
- ⚠️ Il faut `scene.add(camera)` pour que les enfants de la caméra soient dans l'arbre rendu.

**Option B — `<video>` DOM fixe** (comme `#heroEau`), scrubée via `scrubVideo()`, fondu CSS.
- Plus simple, mais les particules WebGL restent **derrière ou devant en bloc** (pas d'entrelacement de profondeur avec la vidéo). Fondu vidéo→WebGL moins « morph », plus « cross-fade ».

### Particules WebGL de traversée (les « effets 3D »)
Collées à la caméra, devant/autour du plan vidéo, révélées pendant la phase splash puis passant le relais aux particules underwater existantes :
- **Bulles** qui filent vers la caméra (rush, `PointsMaterial` additif).
- **Traînées de vitesse** (streaks verticaux) à l'impact.
- **Grosses bulles d'objectif** (sprites flous type bokeh) en avant-plan.
- Opacités pilotées par la même timeline (montée à l'impact ~1,5 s, extinction quand le décor underwater prend le relais).

### Raccords « imperceptibles »
- **Zoom → splash** : pendant que `#heroEau` finit son `scale`, faire monter l'opacité du plan splash (première frame = surface, ~identique visuellement à `#heroEau`) → cross-dissolve. Un léger `#flash` peut masquer le point de bascule.
- **Splash → underwater** : la dernière ~0,5 s de la vidéo (bleu profond) fond vers `mixUnder:1` du fog. Baisser l'opacité du plan splash pendant que les particules underwater montent. Flash discret optionnel.
- Tout doit être **réversible** (scroll arrière = ressortir de l'eau) puisque c'est scrubé, pas joué.

## ⚠️ Gotchas (mémoire projet)

- **`position: sticky` casse sous ScrollSmoother** (il translate `#smooth-content`). Tout pin/sticky doit passer par `ScrollTrigger.create({ pin })`, pas par CSS. (Le manifeste est déjà épinglé ainsi.)
- **Scrubbing vidéo** : utiliser `splash-plongee.mp4` (all-intra) — pas l'original. Quantifier `currentTime` au pas de frame (1/24) et ignorer les deltas < ½ frame (déjà fait dans `video-scrub.js`).
- **Preview Claude** : le harness throttle `requestAnimationFrame` et rend des captures noires quand l'onglet est `hidden`. Vérifier dans un onglet **au premier plan**, ou avancer les frames à la main : `import('/src/lib/motion.js').then(({gsap})=>gsap.ticker.tick())`.
- **Décodage 1re frame (Safari/mobile)** : forcer `video.currentTime = 0.001` après `loadedmetadata` pour éviter un plan noir au départ.
- **`prefers-reduced-motion`** : dans ce mode, `main.js` retire `#stage` et zappe tout le WebGL — prévoir un repli (image figée ou rien).
- three **^0.177.0** (ESM), GSAP + ScrollTrigger + ScrollSmoother importés via `src/lib/motion.js`.
- **Ne pas toucher LA BOBINE ni LA MÉTHODE** (sections « sacrées », comportement préservé à l'identique).

## 📍 Points d'entrée pour coder

1. `src/scenes/galaxie.js` — timeline maîtresse (lignes ~258-305) : y remplacer le bloc `heroEau/heroBulles` ; ajouter le plan `VideoTexture` splash + les particules ; les piloter dans `update()` (~379).
2. `index.html` — décider : garder `#heroBulles` ou le retirer ; le pont splash peut vivre 100% en WebGL.
3. `src/styles/sections/hero.css` — ajuster si on garde une couche vidéo DOM.
4. Asset déjà là : **`public/video/splash-plongee.mp4`**.

Commande de ré-encodage (si besoin de régénérer l'asset) :
```bash
ffmpeg -i "splash v1_gcg5.mp4" -an -c:v libx264 -preset slow -crf 21 \
  -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart \
  public/video/splash-plongee.mp4
```
