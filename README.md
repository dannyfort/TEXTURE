# TEXTURE — site studio

Site vitrine du studio de création publicitaire **Texture**. Une seule page,
scroll cinématique : un travelling « **Océan vers Galaxie** » rendu en WebGL
sert de décor continu, dans lequel s'intègrent les sections du site.

Pour le langage visuel et le mouvement, voir [`DESIGN.md`](./DESIGN.md).

---

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bundle de production dans dist/
npm run preview    # sert le build
```

Stack : **Vite** · **Three.js** (WebGL) · **GSAP** (ScrollTrigger,
ScrollSmoother, SplitText, DrawSVG). Aucun framework UI — HTML + CSS + modules ES.

---

## Le concept en une phrase

Le visiteur part **au-dessus de l'océan** (hero), **plonge sous l'eau**
(manifeste), puis **remonte dans une galaxie** où défilent la bobine, la
méthode, l'équipe, les tarifs et le générique — le tout scrubé au scroll.

---

## Architecture 3D — un plateau, plusieurs scènes

Tout le WebGL vit sur **un unique `<canvas id="stage">`** fixé derrière le DOM.
`scenes/stage.js` tient un renderer et une liste de scènes ; à chaque frame il
efface une fois, puis dessine les scènes actives dans l'ordre d'enregistrement
(`clearDepth` entre chacune). Une scène = `{ scene, camera, active, update,
resize, dispose }`.

```
scenes/index.js   ── câblage scroll ↔ scènes (ScrollTrigger)
  1. galaxie.js       LE FOND. Océan → sous-marin → galaxie + timeline maîtresse.
                      Enregistré en premier, actif toute la page, peint le fond
                      (couleur de clear + brouillard).
  2. reel-lumiere.js  LA BOBINE — écrans-vidéo flottants (par-dessus le fond).   [préservé]
  3. cadres.js        LA MÉTHODE — storyboard filaire dérivant (par-dessus).      [préservé]
```

> Les écrans de la bobine et le storyboard de la méthode se rendent **au-dessus**
> du fond galaxie : ils flottent littéralement *dans* l'espace.

---

## Arborescence

```
index.html                     Structure de la page (voyage + galaxie)
src/
  main.js                      Boot : reduced-motion, ScrollSmoother, ordre d'init
  lib/
    motion.js                  gsap + plugins (ScrollTrigger/Smoother/Split/DrawSVG)
    video-scrub.js             Lecture vidéo pilotée/chaînée (bobine)
  scenes/
    stage.js                   Plateau multi-scènes (1 renderer, N scènes)
    galaxie.js                 ★ Fond « Océan → Galaxie » + timeline maîtresse
    reel-lumiere.js            Bobine : écrans-vidéo 3D flottants          [préservé]
    cadres.js                  Méthode : storyboard filaire                [préservé]
    index.js                   Câblage scroll ↔ scènes
  sections/
    loader.js  hud.js          Amorce 35 mm · HUD timecode
    reel.js                    Bobine : travelling + fiches                [préservé]
    methode.js                 Méthode : défilé horizontal épinglé         [préservé]
  styles/
    tokens.css global.css typography.css
    sections/*.css             Une feuille par section
public/assets/                 Vidéos (candia, xpeng, fooh…), 3D (candia.glb), logos
```

---

## Notes d'intégration (design « Océan → Galaxie »)

Le design importé (Claude Design) a été porté **à 100 %**, avec **deux
exceptions volontaires** : la *bobine* et la *méthode* conservent le comportement
du code local d'origine (voir [`DESIGN.md` §5](./DESIGN.md#5-les-deux-parties-intouchables)).
Décisions clés :

1. **Un renderer, pas deux.** Le design était un WebGL autonome ; il est porté
   en scène `galaxie.js` sur le plateau multi-scènes existant, ce qui permet aux
   écrans de la bobine et au storyboard de la méthode de se rendre **par-dessus**
   le fond, inchangés.
2. **Trois.js & GSAP en ESM.** Les globals CDN du design (`window.THREE`,
   `window.gsap`) sont remplacés par les imports npm du projet.
3. **`position: sticky` → pin GSAP.** Le manifeste du design utilisait
   `position: sticky`, qui **ne tient pas sous ScrollSmoother** (le contenu est
   translaté). Il est désormais épinglé par `ScrollTrigger` dans `galaxie.js`.
   ScrollSmoother est conservé car la bobine et la méthode sont réglées pour son
   inertie.
4. **Sections retirées.** Le design ne comporte plus « Deux regards » ; les
   scènes devenues inutiles (`fond-particules`, `projector`, `regard`, `iris`)
   et leurs sections ont été supprimées.
5. **Le HUD/amorce/letterbox/grain** du projet sont conservés (le timecode reste
   piloté par `hud.js`, pas par la boucle 3D, pour éviter les doublons).

---

## Performances & garde-fous

- Le fond galaxie réduit ses densités (étoiles, particules, coraux) sous 760 px.
- `stage.js` : `pixelRatio ≤ 1.75`, MSAA activé pour la géométrie de l'océan.
- Chunks `three` et `gsap` séparés (voir `vite.config.js`), scènes importées en
  différé (`import()` dans `main.js`) — l'amorce masque le boot.
- Perte de contexte WebGL (mobile) : le plateau se coupe proprement, le DOM
  prend le relais.

---

## Vérification

`npm run dev` puis, dans le navigateur (onglet **au premier plan** — le rendu
WebGL est piloté par `requestAnimationFrame`, suspendu dans un onglet masqué) :

- **Surface** : wordmark TEXTURE sur l'océan animé, HUD `SCÈNE 00 — LA SURFACE`.
- **Plongée** : flash, passage au bleu profond, les 4 lignes du manifeste
  entrent une à une (texte épinglé).
- **Bobine** : les trois écrans-vidéo défilent en profondeur, fiches en
  surimpression (comportement d'origine).
- **Méthode** : défilé horizontal épinglé, bobine SVG qui tourne, illustrations
  dessinées au trait (comportement d'origine).
- **Œil / Tarifs / Générique** : révélations « depuis la profondeur » sur fond
  d'étoiles, accents or.
- `prefers-reduced-motion` : pas de WebGL, tout est statique et lisible.
