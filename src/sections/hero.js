import { gsap } from '../lib/motion.js';

/**
 * TEXTURE STATIC LOGO — matière unique de bulles d'eau, orbe révélatrice
 * au survol, entrée en rafale, bump 3D au hover.
 *
 * ÉTAT STATIQUE — les sept lettres partagent UNE seule nappe de matière :
 * bulles d'eau macro en boucle simple (bulles.mp4, jamais en
 * aller-retour/boomerang), recadrée cover sur le rect du mot.
 *
 * SURVOL d'une lettre : l'orbe de lumière du curseur devient révélatrice —
 * dans sa fenêtre circulaire, la lettre laisse voir une AUTRE matière tirée
 * au hasard parmi les sept de la bande vidéo (textures-lettres.mp4 : eau,
 * encre, ferro, pivoine, huile, mer, feu). La matière secrète n'existe que
 * là où la lumière passe ; elle s'éteint en douceur quand l'orbe repart.
 * Chaque nouveau survol retire une matière au hasard.
 *
 * ENTRÉE (lancerEntreeLogo, déclenchée par ident.js pendant la combustion
 * finale) — les lettres volent depuis le hors-champ en rafale mitraillette,
 * avec motion blur directionnel calculé dans le shader.
 *
 * HOVER — bump 3D fluide (« zoom gravitationnel ») : bosse qui suit le
 * curseur (ressort sous-amorti), matière grossie localement (loupe) +
 * éclairage par pseudo-normale (diffus + spéculaire).
 *
 * Sans WebGL : la vidéo de bulles plate masquée en CSS reste affichée,
 * l'entrée se réduit à un fondu rapide.
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
uniform sampler2D uVideo;  /* bande des 7 matières — sert aux révélations */
uniform sampler2D uBulles; /* matière de base : bulles d'eau en boucle */
uniform sampler2D uMasque;
uniform vec2 uPad;
uniform vec2 uOffsets[7]; /* décalage courant de chaque lettre (espace mot) */
uniform vec2 uVels[7];    /* étalement du motion blur par lettre */
uniform float uB0[7];     /* frontières lettres = frontières bandes */
uniform float uB1[7];
uniform float uBande[7];  /* matière secrète révélée sous l'orbe, par lettre */
uniform float uRev[7];    /* intensité de révélation par lettre (0..1) */
uniform float uFlash[7];  /* pulse lumineux de l'orbe à l'allumage (0..1) */
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

  /* ---- matière secrète + révélation + pulse de cette lettre ---- */
  float bande = 0.0;
  float flash = 0.0;
  float rev = 0.0;
  for (int k = 0; k < 7; k++) {
    if (abs(float(k) - lettre) < 0.5) { bande = uBande[k]; flash = uFlash[k]; rev = uRev[k]; }
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

  /* ---- matière de base : UNE seule nappe de bulles d'eau sous les sept
     lettres. Crop cover du 1920×1080 sur le rect 1754×210 du mot → seule
     la bande centrale (~21 % de la hauteur) vit dans les lettres. La nappe
     voyage AVEC la lettre pendant son vol (repère pl) et subit la loupe. */
  vec2 uvB = clamp(pl + dep, 0.0, 1.0);
  vec4 c = texture2D(uBulles, vec2(uvB.x, 0.5 + (uvB.y - 0.5) * 0.213));

  /* ---- orbe révélatrice : dans la fenêtre de lumière du curseur, la
     lettre survolée laisse voir sa matière secrète (bande aléatoire de la
     vidéo, repère local de la lettre → bande affectée). La matière
     n'existe que là où la lumière passe. */
  float t = (pl.x - lb0) / max(lb1 - lb0, 1e-4);
  float tS = clamp(t + dep.x / max(lb1 - lb0, 1e-4), 0.0, 1.0);
  float yS = clamp(pl.y + dep.y, 0.002, 0.998);
  vec4 cRev = texture2D(uVideo, vec2(mix(bb0, bb1, tS), yS));
  float r = sqrt(r2);
  float fenetre = smoothstep(0.78, 0.22, r) * rev;
  c = mix(c, cRev, fenetre);
  /* liseré : le bord de la fenêtre s'allume — l'orbe découpe la matière */
  float lis = (r - 0.52) * 4.5;
  c.rgb += vec3(0.75, 0.9, 1.0) * exp(-lis * lis) * rev * 0.2;

  vec2 grad = -2.0 * d / (0.5 * 0.5) * gauss * uBosse;
  vec3 n = normalize(vec3(-grad * 0.4, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(reflect(-L, n).z, 0.0), 26.0);
  c.rgb *= 1.0 + (diff - 0.5) * bosse * 1.1;
  c.rgb += spec * bosse * 0.45;

  /* ---- pulse d'allumage : lens flare bleuté + streak anamorphique,
     adouci (plus de cut à masquer — la révélation est progressive) ---- */
  float streak = exp(-pow((uvm.y - 0.5) * 3.0, 2.0));
  c.rgb += vec3(0.85, 0.95, 1.0) * flash * (0.16 + streak * 0.5);

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
  const videoBulles = document.getElementById('titreBulles');
  const canvas = document.getElementById('titreCanvas');
  if (!visuel || !video || !videoBulles || !canvas) return;

  video.play().catch(() => {});
  videoBulles.play().catch(() => {});

  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true });
  const prog = gl && compileProgramme(gl);
  if (!gl || !prog) {
    video.pause(); // la bande des matières ne sert qu'au shader
    return; // secours : vidéo de bulles plate masquée en CSS
  }

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
  const texBulles = creeTexture();

  const U = {};
  ['uPad', 'uOffsets', 'uVels', 'uB0', 'uB1', 'uBande', 'uRev', 'uFlash', 'uOrbe', 'uBosse', 'uAspect', 'uVideo', 'uMasque', 'uBulles']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uVideo, 0);
  gl.uniform1i(U.uMasque, 1);
  gl.uniform1i(U.uBulles, 2);
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
  let lettreSurvol = -1;      /* lettre survolée courante — la révélation suit les transitions */
  const refroidi = new Float32Array(7); /* anti-rebond du tirage par lettre (ms) */

  /* Matière secrète par lettre (bande révélée sous l'orbe), intensité de
     révélation, et pulse lumineux à l'allumage. */
  const bandes = new Float32Array([0, 1, 2, 3, 4, 5, 6]);
  const revs = [0, 0, 0, 0, 0, 0, 0].map(() => ({ v: 0 }));
  const tabRev = new Float32Array(7);
  const flashes = [0, 0, 0, 0, 0, 0, 0].map(() => ({ v: 0 }));
  const tabFlash = new Float32Array(7);

  /* Pulse d'allumage : l'orbe de lumière s'embrase brièvement quand elle se
     pose sur une lettre, puis retombe — la révélation, elle, reste tant que
     le curseur est sur la lettre. */
  const ORBE_ARRIVEE = 0.3;
  const ORBE_DEPART = 0.62;
  const orbeSur = (k) => {
    const f = flashes[k];
    gsap.killTweensOf(f);
    gsap.timeline()
      .to(f, { v: 1, duration: ORBE_ARRIVEE, ease: 'power2.out' })
      .to(f, { v: 0, duration: ORBE_DEPART, ease: 'power2.inOut' });
  };
  /* Révélation : à l'entrée sur une lettre, on tire au hasard sa matière
     secrète (jamais deux fois la même d'affilée) et la fenêtre de lumière
     s'ouvre ; à la sortie, elle se referme en douceur. */
  const rallumerLettre = (i) => {
    gsap.killTweensOf(revs[i]);
    gsap.to(revs[i], { v: 1, duration: 0.38, ease: 'power2.out' });
  };
  const eteindreLettre = (i) => {
    gsap.killTweensOf(revs[i]);
    gsap.to(revs[i], { v: 0, duration: 0.6, ease: 'power2.inOut' });
  };
  const revelerLettre = (i) => {
    let b = (Math.random() * 7) | 0;
    if (b === bandes[i]) b = (b + 1 + ((Math.random() * 6) | 0)) % 7;
    bandes[i] = b;
    orbeSur(i);
    rallumerLettre(i);
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

    /* révélation au survol : la lettre sous le curseur ouvre sa fenêtre de
       lumière (nouveau tirage de matière, anti-rebond de bord) ; la lettre
       quittée referme la sienne */
    const survol = souris.dedans ? lettreSous() : -1;
    if (survol !== lettreSurvol) {
      if (lettreSurvol >= 0) eteindreLettre(lettreSurvol);
      lettreSurvol = survol;
      if (survol >= 0) {
        const t = performance.now();
        if (t >= refroidi[survol]) {
          refroidi[survol] = t + 260;
          revelerLettre(survol);
        } else {
          rallumerLettre(survol); /* re-entrée rapide : même matière, sans pulse */
        }
      }
    }

    for (let i = 0; i < 7; i++) {
      tabOffsets[i * 2] = offsets[i].x;
      tabOffsets[i * 2 + 1] = offsets[i].y;
      tabVels[i * 2] = (offsets[i].x - prec[i].x) * 1.4;
      tabVels[i * 2 + 1] = (offsets[i].y - prec[i].y) * 1.4;
      prec[i].x = offsets[i].x;
      prec[i].y = offsets[i].y;
      tabRev[i] = revs[i].v;
      tabFlash[i] = flashes[i].v;
    }

    if (video.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, texVideo);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    if (videoBulles.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, texBulles);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoBulles);
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.uniform2fv(U.uOffsets, tabOffsets);
    gl.uniform2fv(U.uVels, tabVels);
    gl.uniform1fv(U.uBande, bandes);
    gl.uniform1fv(U.uRev, tabRev);
    gl.uniform1fv(U.uFlash, tabFlash);
    gl.uniform2f(U.uOrbe, orbe.x, orbe.y);
    gl.uniform1f(U.uBosse, Math.max(0, bosse));
    gl.uniform1f(U.uAspect, 1754 / 210);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  gsap.ticker.add(rendu);
}
