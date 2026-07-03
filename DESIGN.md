# TEXTURE — Design System & Motion

> **Direction : « Océan vers Galaxie ».**
> Un seul travelling scrubé au scroll fait descendre le visiteur depuis la
> surface d'un océan, sous l'eau, puis le fait remonter dans une galaxie où
> vit tout le corps du site. Cinéma d'auteur : letterbox 2.39:1, timecode
> permanent, grain pellicule, amorce 35 mm.

Ce fichier documente **le langage visuel et le mouvement**. Pour l'architecture
technique et le lancement, voir [`README.md`](./README.md).

---

## 1. Le voyage (ordre des scènes)

| # | Section (`id`) | Scène caméra | Ambiance |
|---|----------------|--------------|----------|
| 00 | `#hero` | **La surface** — caméra au-dessus de l'eau | Océan sarcelle, écume, reflets |
| — | `#plongee` | Coupe : immersion (flash) | Traversée de la surface |
| 01 | `#manifeste` | **Sous la surface** — dérive sous-marine | Bleu profond, coraux, rais de lumière |
| — | `#sortie` | Coupe : ascension (flash) | Remontée vers le vide |
| 02 | `#realisations` | **La bobine** *(préservé)* | Galaxie + écrans-vidéo flottants |
| 03 | `#methode` | **La méthode** *(préservé)* | Galaxie + storyboard filaire |
| 04 | `#oeil` | L'équipe | Galaxie (fond) |
| 05 | `#tarifs` | Les offres | Galaxie (fond) |
| 06 | `#generique` | Contact / fin | Galaxie (fond) |

Les scènes 02→06 vivent dans le bloc `#galaxie`, sur lequel un **travelling
avant** (dolly-in) creuse la profondeur au fil du scroll.

---

## 2. Palette

Deux familles cohabitent. La **galaxie** (froide) habille tout le voyage ; la
**projection privée** (chaude) reste la signature de la bobine et de la méthode,
inchangées.

### Océan → Galaxie (`--*` dans `tokens.css`)
| Token | Valeur | Emploi |
|-------|--------|--------|
| `--abysse` | `#060809` | Base cosmique, nuit profonde |
| `--nuit-surface` | `#071016` | Eau vue du dessus |
| `--sarcelle` | `#5fe0da` | Accent teal — eau vive & galaxie |
| `--ecume` | `#eef6f8` | Écume / texte clair (wordmark) |
| `--brume` | `#9fb9c2` | Libellés bleu-gris |
| `--or-galaxie` | `#e3c491` | Accent or — cartons galaxie |
| `--sable` | `#c2bbaa` | Corps de texte sur la galaxie |

### Projection privée (héritée, conservée)
`--noir-salle`, `--noir-fosse`, `--ivoire`, `--tungstene`, `--rec`, `--trait`…
→ utilisés par `reel.css`, `methode.css`, `hud.css`, `loader.css`.

### Palette 3D (in-shader, `galaxie.js`)
- Océan : profond `#0a2e36` → crête `#8fd0d6` → écume `#eef6f8`, reflet `#dff6f8`.
- Brouillard par zone : surface `#071016` · sous l'eau `#03181d` · espace `#020308`.
- Étoiles : blanc `#eef6f8`, teal `#5fe0da`, or `#e3c491`.

---

## 3. Typographie

| Rôle | Police | Token |
|------|--------|-------|
| Display / titres | **Instrument Serif** | `--font-display` |
| Interface / corps | **Archivo** | `--font-ui` |
| Timecode / libellés | **Space Mono** | `--font-tc` |

Les `<em>` des titres passent en italique + accent (or sur la galaxie,
tungstène sur les sections héritées). Échelle fluide : `--text-hero`,
`--text-h2`, `--text-h3`, `--text-prix`… (voir `tokens.css`).

---

## 4. Mouvement

### Timeline maîtresse (`galaxie.js`)
Une `gsap.timeline` scrubée (`#hero` → `#sortie`, `scrub: 1.3`) écrit dans deux
proxies lus par la boucle de rendu :
- `cam { x, y, z, rx, ry, rz }` — position/orientation caméra ;
- `atmo { mixUnder, mixSpace, galaxy, amp }` — brouillard, couleur de fond, houle.

Repères (unités de timeline) : hero `0–14`, plongée `14–31`, dérive sous-marine
`31–55` (volontairement **courte** — on remonte peu après la dernière ligne du
manifeste, pas de scroll à vide), ascension `55–74`. Le texte du manifeste
s'efface dès `58` pour enchaîner sur la remontée. Deux **flashs** (`#flash`)
masquent les coupes de surface.

> **Réglage du « temps mort »** entre la fin du texte et la galaxie : trois
> leviers — la hauteur de `#manifeste` (`manifeste.css`, `230vh`), celle de
> `#sortie` (`galaxie.css`, `85vh`), et la durée de la dérive + la position de
> l'ascension dans la timeline maîtresse (`galaxie.js`). Les raccourcir = moins
> de scroll dans le vide.

### Révélations
`[data-reveal]` → arrivée « depuis la profondeur » (`opacity 0 → 1`,
`scale .9 → 1`, `blur(10px) → 0`), déclenchée à `top 88%`.

### Sections préservées à l'identique — voir §5.

---

## 5. Les deux parties intouchables

> **Contrat produit :** la *bobine* et la *méthode* gardent **exactement** le
> comportement du code d'origine, tout en vivant désormais dans la galaxie.
> Leur markup, leur CSS et leur JS n'ont pas changé.

### 5.1 La bobine (`#realisations`)
- **Fichiers :** `sections/reel.js` · `styles/sections/reel.css` ·
  `scenes/reel-lumiere.js`.
- **Comportement :** en mode *salle* (desktop), les `<video>` du DOM sont
  masquées (sources de texture) ; les vrais **écrans flottent en 3D**, espacés
  en profondeur le long d'un rail courbe. La caméra fait **un long travelling
  scrubé** qui passe devant chaque écran (Candia × TF1, XPeng × Samsung, FOOH),
  avec logos-enseignes et packshot 3D. Les fiches texte se révèlent en
  surimpression, la colonne méta tombe en cascade.
- **Rendu par-dessus la galaxie** : `reel-lumiere` est une scène du plateau
  dessinée après le fond (les écrans flottent *dans* la galaxie).
- **Seule entorse au comportement d'origine (demandée le 03-07-2026)** :
  l'*entrée* des écrans. Avant, chaque écran restait faiblement visible en
  permanence (`opacity 0.18 + …`) — on voyait Candia/XPeng par transparence
  dès l'approche. Désormais un écran **n'existe pas avant son moment** : il
  surgit du vide galactique en **pivotant sur lui-même** (téléviseur qui se
  retourne dans l'espace, cadre tungstène en surbrillance pendant la manœuvre)
  puis se pose sur le rail. Fenêtres d'arrivée indexées sur `tp` : écran 0 sur
  `[0.03 → 0.42]`, écran *i* sur `[i−0.55 → i−0.10]` (pendant la bascule de
  regard). Une fois posé (`a = 1`), géométrie et présence **strictement
  identiques à l'origine** — le travelling d'écran en écran est inchangé.

### 5.2 La méthode (`#methode`)
- **Fichiers :** `sections/methode.js` · `styles/sections/methode.css` ·
  `scenes/cadres.js`.
- **Comportement :** section **épinglée**, défilement **horizontal** des quatre
  cartes-photogrammes (brief → script → storyboard → production) ; la **bobine
  SVG tourne**, le **fil de pellicule se déroule** (`scaleX`), les illustrations
  se **dessinent au trait** (DrawSVG), le jalon clignote. Derrière : le
  **storyboard filaire** (`cadres.js`) dérive en profondeur.

---

## 6. Cinéma permanent (overlays)

| Élément | Fichier | Note |
|---------|---------|------|
| Amorce 35 mm | `loader.css` / `loader.js` | Compte à rebours 3-2-1, masque le boot WebGL |
| HUD timecode + scène | `hud.css` / `hud.js` | `SCÈNE xx` piloté par `[data-scene]`, TC 24 i/s |
| Letterbox 2.39:1 | `global.css` | Barres fixes haut/bas |
| Grain pellicule | `global.css` | Bruit SVG animé |
| Flash de coupe | `galaxie.css` | Traversées surface / sortie d'eau |

---

## 7. Accessibilité & dégradés

- **`prefers-reduced-motion`** : aucun WebGL, aucune timeline. Le canvas est
  retiré, les sections hautes (`manifeste`, transitions) sont remises à plat par
  media-query, tout le contenu est lisible d'emblée.
- **Mobile (`< 760px`)** : bobine et méthode passent en **vertical** (repli déjà
  prévu par leur code) ; le fond galaxie tourne avec des densités réduites.
- Contenu sémantique : `data-scene` pour le HUD, `aria-label`/`aria-hidden`
  soignés, `skip-link`, focus visibles.
