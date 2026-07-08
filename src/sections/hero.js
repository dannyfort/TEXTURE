import { gsap } from '../lib/motion.js';

/**
 * TEXTURE STATIC LOGO — une matière par lettre, cut au survol sous orbe,
 * entrée en rafale, bump 3D au hover.
 *
 * ÉTAT STATIQUE — chaque lettre porte sa matière (vidéo-bande
 * textures-lettres.mp4 : eau, encre, ferro, pivoine, huile, mer, feu).
 * SURVOL d'une lettre : une orbe de lumière (lens flare bleuté + streak
 * anamorphique) monte devant elle, masque le cut à son sommet — la lettre
 * échange alors sa matière avec une autre (inversion) — puis repart plus
 * lentement en révélant la nouvelle. Aucun cut automatique : seul le hover
 * déclenche.
 *
 * ENTRÉE (lancerEntreeLogo, déclenchée par ident.js pendant la combustion
 * finale) — les lettres volent depuis le hors-champ en rafale mitraillette,
 * avec motion blur directionnel calculé dans le shader.
 *
 * HOVER — bump 3D fluide (« zoom gravitationnel ») : bosse qui suit le
 * curseur (ressort sous-amorti), matière grossie localement (loupe) +
 * éclairage par pseudo-normale (diffus + spéculaire).
 *
 * Sans WebGL : la vidéo plate masquée en CSS reste affichée, l'entrée se
 * réduit à un fondu rapide.
 */

/* Frontières des lettres dans le masque = frontières des bandes de matières
   dans la vidéo (px / 1754, cf. v6/README.md). */
const BORNES = [0, 250, 476, 736, 994, 1260, 1526, 1754].map((v) => v / 1754);

/* Padding du canvas autour du rect du mot (fractions du canvas) — doit
   correspondre aux inset négatifs de .titre-canvas dans hero.css. */
const PAD = { x: 0.10 / 1.20, y: 1.20 / 3.40 };

/* Positions de départ hors-champ (espace mot). */
const ENTREES = [
  { x: -0.06, y: -2.6 }, { x: 0.05, y: 2.6 }, { x: -0.04, y: -2.6 },
  { x: 0.06, y: 2.6 }, { x: -0.05, y: -2.6 }, { x: 0.04, y: 2.6 },
  { x: -0.06, y: -2.6 },
];

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uVideo;
uniform sampler2D uMasque;
uniform vec2 uPad;
uniform vec2 uOffsets[7]; /* décalage courant de chaque lettre (espace mot) */
uniform vec2 uVels[7];    /* étalement du motion blur par lettre */
uniform float uB0[7];     /* frontières lettres = frontières bandes */
uniform float uB1[7];
uniform float uBande[7];  /* quelle matière chaque lettre affiche (permutation) */
uniform float uFlash[7];  /* orbe/lens flare du cut par lettre (0..1) */
uniform vec2 uOrbe;       /* curseur, espace mot */
uniform float uBosse;     /* amplitude du bump 0..1 */
uniform float uAspect;    /* largeur / hauteur du mot */

void main() {
  /* espace mot : (0,0)-(1,1) = rect du wordmark, le canvas déborde autour */
  vec2 uvm = (vUv - uPad) / (1.0 - 2.0 * uPad);

  /* ---- alpha des lettres + lettre du fragment (motion blur inclus) ---- */
  float alpha = 0.0;
  float lettre = -1.0;
  float lb0 = 0.0;
  float lb1 = 1.0;
  vec2 pl = uvm; /* position du fragment dans le repère de SA lettre */
  for (int i = 0; i < 7; i++) {
    vec2 p = uvm - uOffsets[i];
    vec2 v = uVels[i];
    float a = 0.0;
    for (int t = 0; t < 5; t++) {
      vec2 pt = p + v * (float(t) * 0.25 - 0.5);
      float dedans = step(uB0[i], pt.x) * step(pt.x, uB1[i])
                   * step(0.0, pt.y) * step(pt.y, 1.0);
      a += dedans * texture2D(uMasque, clamp(pt, 0.0, 1.0)).a;
    }
    a *= 0.2;
    if (a > alpha) { alpha = a; lettre = float(i); lb0 = uB0[i]; lb1 = uB1[i]; pl = p; }
  }
  if (alpha < 0.003) { gl_FragColor = vec4(0.0); return; }

  /* ---- permutation : quelle bande de matière pour cette lettre ---- */
  float bande = 0.0;
  float flash = 0.0;
  for (int k = 0; k < 7; k++) {
    if (abs(float(k) - lettre) < 0.5) { bande = uBande[k]; flash = uFlash[k]; }
  }
  float bb0 = 0.0;
  float bb1 = 1.0;
  for (int k = 0; k < 7; k++) {
    if (abs(float(k) - bande) < 0.5) { bb0 = uB0[k]; bb1 = uB1[k]; }
  }

  /* ---- bump 3D sous l'orbe : loupe + éclairage par pseudo-normale ---- */
  vec2 d = (uvm - uOrbe) * vec2(uAspect, 1.0);
  float r2 = dot(d, d);
  float gauss = exp(-r2 / (0.5 * 0.5));
  float bosse = gauss * uBosse;
  vec2 dep = -(d / vec2(uAspect, 1.0)) * bosse * 0.16;

  /* échantillonnage : position locale dans la lettre → même position dans
     la bande de matière affectée (léger stretch si largeurs différentes) ;
     la texture voyage AVEC la lettre pendant son vol (repère pl) */
  float t = (pl.x - lb0) / max(lb1 - lb0, 1e-4);
  float tS = clamp(t + dep.x / max(lb1 - lb0, 1e-4), 0.0, 1.0);
  float yS = clamp(pl.y + dep.y, 0.002, 0.998);
  vec4 c = texture2D(uVideo, vec2(mix(bb0, bb1, tS), yS));

  vec2 grad = -2.0 * d / (0.5 * 0.5) * gauss * uBosse;
  vec3 n = normalize(vec3(-grad * 0.4, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(reflect(-L, n).z, 0.0), 26.0);
  c.rgb *= 1.0 + (diff - 0.5) * bosse * 1.1;
  c.rgb += spec * bosse * 0.45;

  /* ---- orbe du cut : lens flare bleuté + streak anamorphique ---- */
  float streak = exp(-pow((uvm.y - 0.5) * 3.0, 2.0));
  c.rgb += vec3(0.85, 0.95, 1.0) * flash * (0.28 + streak * 0.85);

  gl_FragColor = vec4(c.rgb * alpha, alpha); /* alpha prémultiplié */
}`;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

function compileProgramme(gl) {
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return p;
}

/* Déclencheur d'entrée : posé par initHero, appelé par ident.js pendant la
   combustion finale. Avant WebGL prêt (ou sans WebGL) : fondu simple. */
let declencherEntree = null;

export function lancerEntreeLogo() {
  if (declencherEntree) {
    declencherEntree();
    return;
  }
  const visuel = document.getElementById('titreVisuel');
  if (visuel) {
    gsap.fromTo(visuel, { opacity: 0 }, {
      opacity: 1, duration: 0.45, ease: 'power2.out',
      onComplete: () => gsap.set(visuel, { clearProps: 'opacity' }),
    });
  }
}

export function initHero() {
  const visuel = document.getElementById('titreVisuel');
  const video = document.getElementById('titreTextures');
  const canvas = document.getElementById('titreCanvas');
  if (!visuel || !video || !canvas) return;

  video.play().catch(() => {});

  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true });
  const prog = gl && compileProgramme(gl);
  if (!gl || !prog) return; // secours : vidéo plate masquée en CSS

  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const creeTexture = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  const texVideo = creeTexture();
  const texMasque = creeTexture();

  const U = {};
  ['uPad', 'uOffsets', 'uVels', 'uB0', 'uB1', 'uBande', 'uFlash', 'uOrbe', 'uBosse', 'uAspect', 'uVideo', 'uMasque']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uVideo, 0);
  gl.uniform1i(U.uMasque, 1);
  gl.uniform2f(U.uPad, PAD.x, PAD.y);
  gl.uniform1fv(U.uB0, new Float32Array(BORNES.slice(0, 7)));
  gl.uniform1fv(U.uB1, new Float32Array(BORNES.slice(1)));

  const dimensionner = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(2, Math.round(r.width * dpr));
    canvas.height = Math.max(2, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const ro = new ResizeObserver(dimensionner);
  ro.observe(canvas);

  /* ---- état animé ---- */
  const offsets = ENTREES.map(() => ({ x: 0, y: 0 }));
  const prec = ENTREES.map(() => ({ x: 0, y: 0 }));
  const tabOffsets = new Float32Array(14);
  const tabVels = new Float32Array(14);
  const souris = { x: 0.5, y: 0.5, dedans: false };
  const orbe = { x: 0.5, y: 0.5 };
  let bosse = 0;
  let bosseV = 0;
  let masqueData = null;      /* échantillon alpha du masque (hit-test du survol) */
  let lettreSurvol = -1;      /* lettre survolée courante — le cut se déclenche à la transition */
  const refroidi = new Float32Array(7); /* anti-rebond par lettre (ms) */

  /* Permutation des matières + orbe de lumière du cut (déclenché au SURVOL). */
  const bandes = new Float32Array([0, 1, 2, 3, 4, 5, 6]);
  const flashes = [0, 0, 0, 0, 0, 0, 0].map(() => ({ v: 0 }));
  const tabFlash = new Float32Array(7);

  /* Cut au survol : passer le curseur sur une lettre y fait monter une orbe
     de lumière ; à son sommet la lettre échange sa matière avec une autre
     (inversion), puis l'orbe repart plus lentement en révélant la nouvelle.
     Aucun cut automatique — seul le hover déclenche. */
  const ORBE_ARRIVEE = 0.34; /* montée : l'orbe vient se poser devant la lettre */
  const ORBE_DEPART = 0.72;  /* descente, plus lente : révèle la nouvelle matière */
  const orbeSur = (k) => {
    const f = flashes[k];
    gsap.killTweensOf(f);
    gsap.timeline()
      .to(f, { v: 1, duration: ORBE_ARRIVEE, ease: 'power2.out' })
      .to(f, { v: 0, duration: ORBE_DEPART, ease: 'power2.inOut' });
  };
  const activerCut = (i) => {
    /* partenaire d'inversion : une autre lettre au hasard. Sa matière change
       aussi (échange), mais SANS orbe — la lumière n'apparaît que sur la
       lettre survolée. */
    let j = (Math.random() * 7) | 0;
    if (j === i) j = (j + 1 + ((Math.random() * 6) | 0)) % 7;
    orbeSur(i);
    /* le cut (inversion des matières) se fait au sommet de l'orbe de la lettre
       survolée, qui la masque ; le partenaire échange en simple cut */
    gsap.delayedCall(ORBE_ARRIVEE, () => {
      const tmp = bandes[i];
      bandes[i] = bandes[j];
      bandes[j] = tmp;
    });
  };

  /* Alpha du masque au point (u,v) en espace mot : 1 = encre, 0 = vide. */
  const alphaAt = (u, v) => {
    if (!masqueData) return 1; /* pas encore échantillonné → on se fie aux bandes */
    const w = masqueData.width, h = masqueData.height;
    const x = Math.min(w - 1, Math.max(0, (u * w) | 0));
    const y = Math.min(h - 1, Math.max(0, (v * h) | 0));
    return masqueData.data[(y * w + x) * 4 + 3] / 255;
  };
  /* Lettre réellement sous le curseur (sur l'encre + dans sa bande), -1 sinon. */
  const lettreSous = () => {
    const u = souris.x, v = souris.y;
    if (u < 0 || u > 1 || v < 0 || v > 1 || alphaAt(u, v) < 0.35) return -1;
    for (let i = 0; i < 7; i++) if (u >= BORNES[i] && u < BORNES[i + 1]) return i;
    return -1;
  };

  /* Le masque est requis AVANT d'afficher le canvas. */
  const img = new Image();
  img.onload = () => {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texMasque);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.activeTexture(gl.TEXTURE0);
    visuel.classList.add('a-webgl');
    dimensionner();
    /* échantillon alpha du masque pour le hit-test du survol des lettres */
    try {
      const mc = document.createElement('canvas');
      mc.width = img.naturalWidth;
      mc.height = img.naturalHeight;
      const mctx = mc.getContext('2d', { willReadFrequently: true });
      mctx.drawImage(img, 0, 0);
      masqueData = mctx.getImageData(0, 0, mc.width, mc.height);
    } catch { /* hit-test retombe sur les bandes seules */ }
  };
  img.src = '/masques/mot-tight.png';

  /* ---- entrée en rafale (une seule fois) ---- */
  let entreeFaite = false;
  declencherEntree = () => {
    if (entreeFaite) return;
    entreeFaite = true;
    const tl = gsap.timeline();
    ENTREES.forEach((e, i) => {
      offsets[i].x = e.x;
      offsets[i].y = e.y;
      prec[i].x = e.x;
      prec[i].y = e.y;
      tl.to(offsets[i], { x: 0, y: 0, duration: 0.55, ease: 'power4.out' }, 0.1 + i * 0.045);
    });
  };

  const finPointeur = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finPointeur) {
    const enUV = (e) => {
      const r = visuel.getBoundingClientRect();
      souris.x = (e.clientX - r.left) / r.width;
      souris.y = (e.clientY - r.top) / r.height;
    };
    visuel.addEventListener('pointerenter', (e) => { souris.dedans = true; enUV(e); });
    visuel.addEventListener('pointermove', enUV);
    visuel.addEventListener('pointerleave', () => { souris.dedans = false; });
  }

  const rendu = () => {
    const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);

    const suivi = 1 - Math.exp(-14 * dt);
    orbe.x += (souris.x - orbe.x) * suivi;
    orbe.y += (souris.y - orbe.y) * suivi;
    bosseV += (((souris.dedans ? 1 : 0) - bosse) * 80 - bosseV * 9) * dt;
    bosse += bosseV * dt;

    /* cut au survol : la lettre sous le curseur déclenche l'orbe + l'inversion,
       une seule fois par entrée (anti-rebond de bord) */
    const survol = souris.dedans ? lettreSous() : -1;
    if (survol !== lettreSurvol) {
      lettreSurvol = survol;
      const t = performance.now();
      if (survol >= 0 && t >= refroidi[survol]) {
        refroidi[survol] = t + 260;
        activerCut(survol);
      }
    }

    for (let i = 0; i < 7; i++) {
      tabOffsets[i * 2] = offsets[i].x;
      tabOffsets[i * 2 + 1] = offsets[i].y;
      tabVels[i * 2] = (offsets[i].x - prec[i].x) * 1.4;
      tabVels[i * 2 + 1] = (offsets[i].y - prec[i].y) * 1.4;
      prec[i].x = offsets[i].x;
      prec[i].y = offsets[i].y;
      tabFlash[i] = flashes[i].v;
    }

    if (video.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, texVideo);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    gl.uniform2fv(U.uOffsets, tabOffsets);
    gl.uniform2fv(U.uVels, tabVels);
    gl.uniform1fv(U.uBande, bandes);
    gl.uniform1fv(U.uFlash, tabFlash);
    gl.uniform2f(U.uOrbe, orbe.x, orbe.y);
    gl.uniform1f(U.uBosse, Math.max(0, bosse));
    gl.uniform1f(U.uAspect, 1754 / 210);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  gsap.ticker.add(rendu);
}
