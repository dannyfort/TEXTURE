/**
 * VOYAGE — « Océan vers Galaxie ».
 *
 * Décor de fond unique : la caméra part au-dessus d'un océan, plonge sous la
 * surface (manifeste), puis remonte dans une galaxie (bobine → générique).
 * Toute la scène est pilotée par une timeline maîtresse scrubée au scroll.
 *
 * Portage fidèle du design Claude « TEXTURE - Océan vers Galaxie » vers
 * l'architecture du site (three en ESM, gsap importé, plateau multi-scènes) :
 * cette scène est le FOND. La bobine (reel-lumiere.js) et la méthode
 * (cadres.js) se rendent PAR-DESSUS pendant leurs sections respectives.
 *
 * Elle est enregistrée en premier sur le plateau et reste active toute la
 * page : c'est elle qui peint le fond (couleur de clear + brouillard).
 */
import * as THREE from 'three';
import { gsap, ScrollTrigger } from '../lib/motion.js';

// Réglages « live » du design (props éditeur) figés sur leurs défauts.
const DENSITE_PARTICULES = 1;

export function createGalaxie({ renderer, isDesktop = true } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3000);
  camera.rotation.order = 'YXZ';

  // ---------- Textures utilitaires (points doux, halos anamorphiques) ----------
  const softDot = (w, h, inner) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(w / 2, h / 2); x.scale(1, h / w); x.translate(-w / 2, -h / 2);
    x.fillStyle = g; x.fillRect(0, 0, w, w); x.restore();
    return new THREE.CanvasTexture(c);
  };
  const texRound = softDot(64, 64, 'rgba(255,255,255,0.9)');
  const texAnam = softDot(128, 44, 'rgba(210,255,250,0.9)');
  const texGlow = softDot(96, 96, 'rgba(160,235,228,0.85)');

  // ---------- SCÈNE A : le pont SPLASH ----------
  // L'océan vu du dessus est la vidéo #heroEau (DOM). La traversée de la
  // surface (plongeon → mousse → bulles → bleu profond) est une vidéo SCRUBÉE
  // rendue en WebGL : voir « pont SPLASH » plus bas (après le monde sous-marin),
  // placé là pour réutiliser rnd()/disposables et se fondre dans le décor.

  // ---------- SCÈNE B : monde sous-marin ----------
  const uw = new THREE.Group();
  scene.add(uw);
  const FLOOR = -150;

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(260, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#04191d') }),
  );
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR;
  uw.add(floor);

  const disposables = [floor.geometry, floor.material, texRound, texAnam, texGlow];

  // Coraux procéduraux
  const coralTip = new THREE.SpriteMaterial({ map: texGlow, color: new THREE.Color('#5fe0da'), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const coralPalette = ['#0b3d42', '#0e4a4a', '#123a4f', '#0d5049', '#164452'];
  const coralCount = isDesktop ? 18 : 10;
  for (let c = 0; c < coralCount; c += 1) {
    const ang = Math.random() * Math.PI * 2;
    const rad = rnd(14, 95);
    const cl = new THREE.Group();
    cl.position.set(Math.cos(ang) * rad, FLOOR, Math.sin(ang) * rad - 20);
    const n = 4 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i += 1) {
      const h = rnd(5, 19);
      const geo = new THREE.ConeGeometry(rnd(0.5, 1.6), h, 6, 3);
      geo.translate(0, h / 2, 0);
      const col = new THREE.Color(coralPalette[Math.floor(Math.random() * coralPalette.length)]);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
      mesh.position.set(rnd(-4, 4), 0, rnd(-4, 4));
      mesh.rotation.set(rnd(-0.3, 0.3), rnd(0, Math.PI), rnd(-0.3, 0.3));
      cl.add(mesh);
      disposables.push(geo, mesh.material);
      if (Math.random() > 0.35) {
        const s = new THREE.Sprite(coralTip.clone());
        s.material.opacity = rnd(0.35, 0.95);
        const sc = rnd(1.6, 4.2); s.scale.set(sc, sc, 1);
        s.position.copy(mesh.position).add(new THREE.Vector3(Math.sin(mesh.rotation.z) * -h * 0.9, Math.cos(mesh.rotation.x) * h, 0));
        cl.add(s);
        disposables.push(s.material);
      }
    }
    uw.add(cl);
  }
  disposables.push(coralTip);

  // Rochers
  for (let r = 0; r < 10; r += 1) {
    const g = new THREE.IcosahedronGeometry(rnd(2, 7), 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color('#05242a') }));
    const ang = Math.random() * Math.PI * 2; const rad = rnd(10, 110);
    m.position.set(Math.cos(ang) * rad, FLOOR + 1, Math.sin(ang) * rad - 20);
    m.rotation.set(Math.random(), Math.random(), Math.random());
    m.scale.y = 0.55;
    uw.add(m);
    disposables.push(g, m.material);
  }

  // Rais de lumière
  const rayCanvas = document.createElement('canvas'); rayCanvas.width = 64; rayCanvas.height = 256;
  const rx = rayCanvas.getContext('2d');
  const rg = rx.createLinearGradient(0, 0, 0, 256);
  rg.addColorStop(0, 'rgba(190,245,240,0.55)'); rg.addColorStop(0.6, 'rgba(120,220,215,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  rx.fillStyle = rg; rx.fillRect(0, 0, 64, 256);
  const rayTex = new THREE.CanvasTexture(rayCanvas);
  const rays = [];
  for (let i = 0; i < 6; i += 1) {
    const g = new THREE.PlaneGeometry(rnd(10, 26), 220);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: rnd(0.05, 0.14), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(rnd(-90, 90), -40, rnd(-80, 10));
    m.rotation.z = rnd(-0.22, 0.22); m.rotation.y = rnd(0, Math.PI);
    rays.push(m); uw.add(m);
    disposables.push(g, m.material);
  }
  disposables.push(rayTex);

  // Particules anamorphiques (réagissent au scroll)
  const P = isDesktop ? 900 : 450;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P * 3); const pSeed = new Float32Array(P);
  for (let i = 0; i < P; i += 1) {
    pPos[i * 3] = rnd(-130, 130);
    pPos[i * 3 + 1] = rnd(FLOOR, 0);
    pPos[i * 3 + 2] = rnd(-140, 60);
    pSeed[i] = Math.random();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ map: texAnam, size: 2.6, transparent: true, opacity: 0.55, color: new THREE.Color('#bdf3ee'), blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat);
  uw.add(particles);
  disposables.push(pGeo, pMat);

  // Bokeh anamorphique (gros, premier plan)
  const bokehs = [];
  for (let i = 0; i < 22; i += 1) {
    const m = new THREE.SpriteMaterial({ map: texAnam, color: new THREE.Color(Math.random() > 0.5 ? '#5fe0da' : '#9fd8dd'), transparent: true, opacity: rnd(0.05, 0.2), blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    const w = rnd(6, 22);
    s.scale.set(w, w * 0.32, 1);
    s.position.set(rnd(-100, 100), rnd(FLOOR + 10, -10), rnd(-60, 50));
    s.userData.v = rnd(0.2, 1);
    bokehs.push(s); uw.add(s);
    disposables.push(m);
  }

  // ---------- PONT SPLASH : traversée vidéo scrubée + particules 3D ----------
  // Une vidéo de plongeon (surface ensoleillée → mousse d'impact → bulles →
  // bleu profond) rendue en VideoTexture sur un plan COLLÉ À LA CAMÉRA, dont
  // le currentTime est piloté par le scroll. Sa 1re image = surface d'eau : le
  // fondu depuis #heroEau est imperceptible. À la fin, le plan se fond dans ce
  // monde sous-marin (uw). Réversible : on remonte au scroll, on ressort.
  const texStreak = softDot(24, 128, 'rgba(225,248,250,0.9)');
  const SPLASH_FRAME = 1 / 30; // quantification 30 i/s (splash v2 = 30 fps)
  const SPLASH_DIST = 8;       // distance du plan vidéo devant la caméra
  const heroEauEl = document.getElementById('heroEau'); // vidéo de surface DOM (floutée à la sortie)
  const splashVideo = document.createElement('video');
  splashVideo.muted = true; splashVideo.playsInline = true; splashVideo.preload = 'auto';
  splashVideo.src = '/video/splash-master.mp4'; // « master » 12,2 s : plongée → pause god-rays → sortie → galaxie
  const splashEtat = { duree: 0, dernierT: -1, ok: true };
  splashVideo.addEventListener('loadedmetadata', () => {
    splashEtat.duree = splashVideo.duration || 0;
    try { splashVideo.currentTime = 0.001; } catch { /* noop */ } // force le décodage de la 1re image (Safari)
  }, { once: true });
  splashVideo.load();

  // VideoTexture (seule à téléverser correctement un <video> dans three), mais on
  // NEUTRALISE son auto-update par frame : sur une vidéo scrubée EN PAUSE,
  // VideoTexture.update() force needsUpdate à CHAQUE frame sur les navigateurs sans
  // requestVideoFrameCallback → réupload 1080p permanent. En le rendant no-op, on
  // ne téléverse plus que sur une VRAIE nouvelle image : l'événement 'seeked' (tous
  // navigateurs) + le requestVideoFrameCallback natif quand il existe.
  const splashTex = new THREE.VideoTexture(splashVideo);
  splashTex.colorSpace = THREE.SRGBColorSpace;
  splashTex.minFilter = THREE.LinearFilter;
  splashTex.generateMipmaps = false;
  splashTex.update = () => {}; // upload piloté par 'seeked'/rVFC, pas par frame rendue
  splashVideo.addEventListener('seeked', () => { splashTex.needsUpdate = true; });

  scene.add(camera); // pour que les enfants de la caméra (plan + particules) soient rendus
  // Matériau du plan vidéo : FLOU DE ZOOM radial piloté par la vitesse de scroll
  // (uBlur), pour masquer élégamment la coupe #heroEau → vidéo. On échantillonne
  // la texture en sRGB et on la réécrit telle quelle (pas de conversion) : à
  // uBlur=0 le plan est PIXEL-IDENTIQUE à la vidéo DOM #heroEau → morph sans
  // dérive de couleur. (ShaderMaterial : three n'injecte pas de tonemap/encodage.)
  const splashUniforms = {
    uTex: { value: splashTex },
    uOpacity: { value: 0 },
    uBlur: { value: 0 },                       // 0..~0.2 : amplitude du pas radial vers le centre
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
  };
  const splashMat = new THREE.ShaderMaterial({
    uniforms: splashUniforms,
    transparent: true, depthTest: false, depthWrite: false, fog: false,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uOpacity; uniform float uBlur; uniform vec2 uCenter;
      varying vec2 vUv;
      void main() {
        if (uBlur < 0.0008) {                  // pas de flou → 1 seul échantillon (évite 11 fetches inutiles)
          gl_FragColor = vec4(texture2D(uTex, vUv).rgb, uOpacity);
          return;
        }
        vec2 dir = uCenter - vUv;              // vers le centre = flou de zoom
        vec3 acc = vec3(0.0); float wsum = 0.0;
        for (int i = 0; i < 12; i++) {
          float f = float(i) / 11.0;           // 0..1
          float w = 1.0 - f * 0.55;            // les échantillons proches pèsent plus
          acc += texture2D(uTex, vUv + dir * (f * uBlur)).rgb * w; wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, uOpacity);
      }
    `,
  });
  const splashPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), splashMat);
  splashPlane.position.z = -SPLASH_DIST;
  splashPlane.renderOrder = 500; // au-dessus du décor sous-marin, sous les particules
  splashPlane.visible = false;
  camera.add(splashPlane);
  splashVideo.addEventListener('error', () => {
    // fichier absent : pas de pont vidéo — le flash masque seul la coupe
    splashEtat.ok = false; splashPlane.visible = false;
  }, { once: true });
  let splashW = 1; let splashH = 1; // plein cadre « cover » (base), recalculé au resize
  disposables.push(splashPlane.geometry, splashMat, splashTex, texStreak);

  // Particules de traversée collées à la caméra, DEVANT le plan vidéo :
  // bulles fines, traînées de vitesse, grosses bulles d'objectif.
  const fxGroup = new THREE.Group();
  fxGroup.visible = false;
  camera.add(fxGroup);
  const mkRush = ({ count, tex, size, tint, spread }) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const z = -rnd(1.4, SPLASH_DIST - 0.6);
      pos[i * 3] = rnd(-1, 1) * Math.abs(z) * spread * 1.9;
      pos[i * 3 + 1] = rnd(-1, 1) * Math.abs(z) * spread;
      pos[i * 3 + 2] = z;
      seed[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: tex, size, color: new THREE.Color(tint), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = 600;
    fxGroup.add(pts);
    disposables.push(geo, mat);
    return { geo, mat, seed, spread, count };
  };
  const rushBulles = mkRush({ count: isDesktop ? 480 : 220, tex: texRound, size: 0.16, tint: '#d4f2f4', spread: 0.8 });
  const rushTraits = mkRush({ count: isDesktop ? 150 : 70, tex: texStreak, size: 0.55, tint: '#bfe9ec', spread: 0.8 });
  const lensBulles = [];
  for (let i = 0; i < 9; i += 1) {
    const m = new THREE.SpriteMaterial({ map: texGlow, color: new THREE.Color('#cdeef0'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    const s = new THREE.Sprite(m);
    const sc = rnd(0.35, 1.1); s.scale.set(sc, sc, 1);
    s.position.set(rnd(-2.4, 2.4), rnd(-1.6, 1.6), -rnd(1.2, 2.6));
    s.userData = { v: rnd(1.4, 3), sway: rnd(0, Math.PI * 2) };
    s.renderOrder = 610;
    lensBulles.push(s); fxGroup.add(s);
    disposables.push(m);
  }

  // Gouttes de SORTIE D'EAU : fines particules spéculaires qui jaillissent vers
  // le haut quand on perce la surface (photoréaliste, additif, brèves). Pilotées
  // par fx.spray — indépendantes des bulles sous-marines.
  const SPRAY_N = isDesktop ? 170 : 80;
  const sprayGeo = new THREE.BufferGeometry();
  const sprayPos = new Float32Array(SPRAY_N * 3);
  const spraySeed = new Float32Array(SPRAY_N);
  const sprayReset = (i) => {
    sprayPos[i * 3] = rnd(-2.4, 2.4);
    sprayPos[i * 3 + 1] = rnd(-2.6, -0.4);   // partent du bas du cadre (la surface percée)
    sprayPos[i * 3 + 2] = -rnd(1.1, 4.8);
    spraySeed[i] = Math.random();
  };
  for (let i = 0; i < SPRAY_N; i += 1) sprayReset(i);
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const sprayMat = new THREE.PointsMaterial({
    map: texRound, size: 0.085, color: new THREE.Color('#eaf7ff'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: true,
  });
  const sprayPts = new THREE.Points(sprayGeo, sprayMat);
  sprayPts.renderOrder = 620;
  fxGroup.add(sprayPts);
  disposables.push(sprayGeo, sprayMat);

  // ---------- SCÈNE C : galaxie ----------
  const gal = new THREE.Group();
  gal.position.y = 900;
  scene.add(gal);

  const S = isDesktop ? 7000 : 3500;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(S * 3); const sCol = new Float32Array(S * 3);
  const cWhite = new THREE.Color('#eef6f8'); const cTeal = new THREE.Color('#5fe0da'); const cTung = new THREE.Color('#e3c491');
  for (let i = 0; i < S; i += 1) {
    const r = rnd(240, 950);
    const th = Math.random() * Math.PI * 2; const ph = Math.acos(rnd(-1, 1));
    sPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sPos[i * 3 + 1] = r * Math.cos(ph) * 0.7;
    sPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    const pick = Math.random();
    const c = pick > 0.92 ? cTung : pick > 0.82 ? cTeal : cWhite;
    const dim = rnd(0.35, 1);
    sCol[i * 3] = c.r * dim; sCol[i * 3 + 1] = c.g * dim; sCol[i * 3 + 2] = c.b * dim;
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sMat = new THREE.PointsMaterial({ map: texRound, size: 2.2, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const stars = new THREE.Points(sGeo, sMat);
  gal.add(stars);
  disposables.push(sGeo, sMat);

  const mkSpiral = (count, radius, tint1, tint2) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3); const col = new Float32Array(count * 3);
    const c1 = new THREE.Color(tint1); const c2 = new THREE.Color(tint2); const tmp = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const arm = i % 3;
      const r = (Math.random() ** 0.65) * radius;
      const a = r * 0.05 + arm * ((Math.PI * 2) / 3) + rnd(-0.22, 0.22);
      pos[i * 3] = Math.cos(a) * r + rnd(-2, 2);
      pos[i * 3 + 1] = rnd(-1, 1) * (1 - r / radius) * 9;
      pos[i * 3 + 2] = Math.sin(a) * r + rnd(-2, 2);
      tmp.copy(c1).lerp(c2, r / radius);
      const dim = rnd(0.4, 1);
      col[i * 3] = tmp.r * dim; col[i * 3 + 1] = tmp.g * dim; col[i * 3 + 2] = tmp.b * dim;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ map: texRound, size: 1.9, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    disposables.push(g, m);
    return new THREE.Points(g, m);
  };
  const spiral1 = mkSpiral(isDesktop ? 4200 : 2100, 130, '#f0e2c4', '#5fe0da');
  spiral1.position.set(-150, 60, -260); spiral1.rotation.set(0.9, 0.2, 0.35);
  gal.add(spiral1);
  const spiral2 = mkSpiral(isDesktop ? 2600 : 1300, 80, '#e3c491', '#9fd8dd');
  spiral2.position.set(190, -60, -300); spiral2.rotation.set(1.2, -0.3, -0.2);
  gal.add(spiral2);

  // Couloir d'étoiles pour le travelling avant (parallaxe de profondeur)
  const C = isDesktop ? 2600 : 1300;
  const cGeo = new THREE.BufferGeometry();
  const cPos = new Float32Array(C * 3); const cCol = new Float32Array(C * 3);
  for (let i = 0; i < C; i += 1) {
    const side = Math.random() > 0.5 ? 1 : -1;
    cPos[i * 3] = side * rnd(30, 420);
    cPos[i * 3 + 1] = rnd(-280, 280);
    cPos[i * 3 + 2] = rnd(-1400, 250);
    const pick = Math.random();
    const c = pick > 0.9 ? cTung : pick > 0.78 ? cTeal : cWhite;
    const dim = rnd(0.3, 1);
    cCol[i * 3] = c.r * dim; cCol[i * 3 + 1] = c.g * dim; cCol[i * 3 + 2] = c.b * dim;
  }
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  const corridorMat = new THREE.PointsMaterial({ map: texRound, size: 2.6, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const corridor = new THREE.Points(cGeo, corridorMat);
  gal.add(corridor);
  disposables.push(cGeo, corridorMat);

  const nebulas = [];
  for (let i = 0; i < 7; i += 1) {
    const m = new THREE.SpriteMaterial({ map: texGlow, color: new THREE.Color(i % 2 ? '#1d4a52' : '#3d3423'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    const sc = rnd(180, 420);
    s.scale.set(sc, sc * rnd(0.5, 0.9), 1);
    s.position.set(rnd(-500, 500), rnd(-220, 260), rnd(-700, -250));
    s.userData.base = rnd(0.1, 0.24);
    nebulas.push(s); gal.add(s);
    disposables.push(m);
  }

  // ---------- Atmosphère (fond + brouillard) pilotée par le scroll ----------
  const zones = {
    surface: { c: new THREE.Color('#071016'), d: 0.0016 },
    under: { c: new THREE.Color('#03181d'), d: 0.008 },
    space: { c: new THREE.Color('#020308'), d: 0.00018 },
  };
  const fog = new THREE.FogExp2(zones.surface.c.clone(), zones.surface.d);
  scene.fog = fog;
  if (renderer) renderer.setClearColor(zones.surface.c, 1);

  // Proxies animés par GSAP (le scroll écrit ici, update() lit)
  const cam = { y: 66, x: 0, z: 0, rx: -1.38, ry: 0, rz: 0 };
  const atmo = { mixUnder: 0, mixSpace: 0, galaxy: 0 };
  const dolly = { z: 0 };
  const splash = { p: 0, o: 0, s: 1.95 }; // p=progression vidéo, o=opacité, s=échelle du plan
  //   s démarre à ~2× pour matcher le zoom de #heroEau à la coupe (morph parfait),
  //   puis revient à 1 (plein cadre) pendant la plongée.
  const fx = { rush: 0, burst: 0, blur: 0, spray: 0 }; // +spray = gouttes de sortie d'eau

  // ---------- Timeline maîtresse : surface → plongée → sous l'eau → ascension ----------
  const triggers = [];
  const master = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#hero', start: 'top top', endTrigger: '#sortie', end: 'bottom top', scrub: 1.3,
    },
  });
  master
    .to(cam, { y: 46, duration: 14 }, 0)
    // ---- PONT SPLASH « MASTER » : plongée → PAUSE sous l'eau (lecture du
    //      manifeste) → remontée rapide → sortie de l'eau → ciel → GALAXIE, qui
    //      se fond dans la galaxie WebGL. Une seule vidéo (12,2 s) scrubée,
    //      SYNCHRONISÉE au scroll d'après la géométrie réelle des sections
    //      (mesurée) : le manifeste se lit ≈ pos 22→48, le texte sort ≈ pos 48,
    //      #sortie couvre pos 62,5→74. Morph d'entrée #heroEau→vidéo inchangé
    //      (échelle splash.s + fondu rapide + flou de zoom ∝ vitesse). Réversible.
    .to('#heroEau', { scale: 2.0, duration: 13, ease: 'power1.in' }, 0)
    .to(splash, { o: 1, duration: 1.6, ease: 'power2.out' }, 12)           // FONDU RAPIDE d'entrée
    .to('#heroEau', { opacity: 0, duration: 1.8, ease: 'power2.in' }, 12.2)
    .to(splash, { s: 1, duration: 9, ease: 'power2.out' }, 12.4)           // dé-zoom → plein cadre (morph)
    // SCRUB vidéo synchronisé (ease none = mapping scroll↔temps prévisible) :
    .to(splash, { p: 0.164, duration: 10, ease: 'none' }, 12)            // 0→2 s : surface → impact → sous l'eau
    .to(splash, { p: 0.738, duration: 25, ease: 'none' }, 22)            // 2→9 s : PAUSE god-rays (lecture manifeste)
    .to(splash, { p: 0.869, duration: 6, ease: 'none' }, 47)             // 9→10.6 s : remontée rapide → sortie d'eau
    .to(splash, { p: 1, duration: 13, ease: 'none' }, 53)               // 10.6→12.2 s : ciel → étoiles (jusqu'à pos 66)
    // La vidéo GARDE ses étoiles jusqu'à l'arrivée de la bobine : le fondu vers la
    // galaxie WebGL est calé sur le début de #galaxie (pos ~70) pour qu'il n'y ait
    // PAS de vide « espace vide » avant le 1er écran — l'espace naît quand la bobine arrive.
    .to(splash, { o: 0, duration: 4, ease: 'power2.inOut' }, 66)         // fondu → galaxie WebGL, calé sur la bobine
    // flou de zoom : pic à la coupe d'entrée + regain à la remontée rapide
    .fromTo(fx, { blur: 0 }, { blur: 1, duration: 1.8, ease: 'power2.out' }, 11.6)
    .to(fx, { blur: 0.3, duration: 5, ease: 'power2.inOut' }, 13.4)
    .to(fx, { blur: 0, duration: 8, ease: 'power1.out' }, 20)
    .to(fx, { blur: 0.6, duration: 2.5, ease: 'power2.in' }, 46)         // remontée : flou de vitesse
    .to(fx, { blur: 0, duration: 5, ease: 'power1.out' }, 54)
    // particules : impact d'entrée, léger flux pendant la pause, jaillissement
    // de bulles à la remontée, puis plus rien une fois hors de l'eau.
    .to(fx, { rush: 1, duration: 4.5, ease: 'power1.in' }, 12.6)
    .to(fx, { burst: 1, duration: 1.2, ease: 'power2.in' }, 15.6)
    .to(fx, { burst: 0, duration: 3, ease: 'power2.out' }, 16.8)
    .to(fx, { rush: 0.12, duration: 6, ease: 'power1.out' }, 19)         // fond de bulles pendant la lecture
    .to(fx, { rush: 0.8, duration: 3, ease: 'power2.in' }, 47)           // jaillissement à la remontée
    .to(fx, { rush: 0, duration: 5, ease: 'power1.out' }, 54)            // hors de l'eau → plus de bulles
    .to(fx, { spray: 1, duration: 1.4, ease: 'power2.out' }, 51)         // GOUTTES : perçage de la surface (~pos 53)
    .to(fx, { spray: 0, duration: 3, ease: 'power1.out' }, 52.6)
    // caméra WebGL (cachée derrière la vidéo ; sert au repli + à la galaxie finale)
    .to(cam, { y: -6, duration: 8, ease: 'power2.in' }, 13)
    .to(cam, { y: -96, rx: -0.06, duration: 12, ease: 'power2.out' }, 21)
    .to(cam, { z: 26, duration: 10 }, 21)
    .to(atmo, { mixUnder: 1, duration: 8, ease: 'power1.in' }, 30)
    .to('#heroInner', { opacity: 0, scale: 1.16, duration: 6, ease: 'power1.in' }, 11)
    .to('#heroScroll', { opacity: 0, duration: 3 }, 11)
    .to('#flash', { opacity: 0.9, duration: 1.0, ease: 'power2.in' }, 15.8) // flash à l'impact
    .to('#flash', { opacity: 0, duration: 2.6, ease: 'power2.out' }, 16.8)
    // dérive sous-marine (cachée derrière la vidéo) pendant le manifeste
    .to(cam, { z: -34, x: 8, ry: 0.16, duration: 22 }, 31)
    // ASCENSION WebGL calée sur la sortie d'eau de la vidéo : la galaxie WebGL est
    // prête (atmo.galaxy≈1, caméra dans les étoiles) quand la vidéo se fond dedans.
    .to(cam, { y: -20, rx: 0.42, duration: 6, ease: 'power3.in' }, 50)
    .to(cam, { y: 640, duration: 8, ease: 'power2.in' }, 56)
    .to(cam, { y: 900, rx: 0, ry: 0, x: 0, z: 0, duration: 6, ease: 'power2.out' }, 64)
    .to(atmo, { mixUnder: 0, duration: 6 }, 56)
    .to(atmo, { mixSpace: 1, galaxy: 1, duration: 8 }, 61);              // galaxie WebGL prête ~pos 69 = arrivée bobine
  // Pas de flash à l'entrée de la galaxie : on arrive DANS LE NOIR — c'est
  // l'espace. La vidéo (fin = étoiles) se fond directement dans la galaxie WebGL.
  triggers.push(master.scrollTrigger);

  // Manifeste : entrées séquentielles des quatre lignes
  const mtl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#manifeste', start: 'top 70%', end: 'bottom bottom', scrub: 0.8 },
  });
  mtl
    .from('#m1', { opacity: 0, y: 46, duration: 10 }, 2)
    .from('#m2', { opacity: 0, y: 46, duration: 10 }, 14)
    .from('#m3', { opacity: 0, y: 40, duration: 10 }, 28)
    .from('#m4', { opacity: 0, y: 34, duration: 10 }, 40)
    .to('#m1, #m2, #m3, #m4', { opacity: 0, y: -60, duration: 10, stagger: 1.2, ease: 'power1.in' }, 58);
  triggers.push(mtl.scrollTrigger);

  // Épinglage du manifeste : remplace le position:sticky du design, qui ne
  // tient pas sous ScrollSmoother. La section fait 360vh → le pin garde le
  // texte centré pendant toute la dérive sous-marine. pinSpacing:false : la
  // hauteur de la section fournit déjà la distance de scroll.
  const manifPin = ScrollTrigger.create({
    trigger: '#manifeste',
    start: 'top top',
    end: 'bottom bottom',
    pin: '.manifeste-pin',
    pinSpacing: false,
  });
  triggers.push(manifPin);

  // Travelling avant dans la galaxie (dolly in) pendant les sections galaxie
  const dollyTween = gsap.to(dolly, {
    z: 560, ease: 'none',
    scrollTrigger: { trigger: '#galaxie', start: 'top bottom', end: 'bottom bottom', scrub: 1.5 },
  });
  triggers.push(dollyTween.scrollTrigger);
  const driftTween = gsap.to(cam, {
    ry: -0.06, rz: 0.015, ease: 'none',
    scrollTrigger: { trigger: '#galaxie', start: 'top bottom', end: 'bottom bottom', scrub: 2 },
  });
  triggers.push(driftTween.scrollTrigger);

  // Révélations « travelling avant » : les blocs arrivent de la profondeur
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const tw = gsap.from(el, {
      opacity: 0, scale: 0.9, filter: 'blur(10px)', duration: 1.3, ease: 'power3.out',
      transformOrigin: '50% 50%',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
    triggers.push(tw.scrollTrigger);
  });

  // ---------- Souris (parallaxe légère) ----------
  const mouse = { x: 0, y: 0 };
  const onMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // ---------- Boucle (update appelé par le plateau) ----------
  const startT = performance.now();
  const clock = new THREE.Clock();
  const tmpC = new THREE.Color();
  let smoothVel = 0;
  let lastY;

  return {
    scene,
    camera,
    active: true, // le fond est toujours à l'écran
    setActive(on) { this.active = on; },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // plan splash : couvre le cadre (object-fit: cover) à sa distance
      const fH = 2 * Math.tan(((camera.fov * Math.PI) / 180) / 2) * SPLASH_DIST;
      const fW = fH * (w / h);
      const va = 16 / 9; // ratio de la vidéo splash
      if (fW / fH > va) { splashW = fW; splashH = fW / va; } else { splashH = fH; splashW = fH * va; }
      splashPlane.scale.set(splashW, splashH, 1);
    },
    update() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = (performance.now() - startT) / 1000;

      // atmosphère : couleur de fond + densité de brouillard
      tmpC.copy(zones.surface.c).lerp(zones.under.c, atmo.mixUnder).lerp(zones.space.c, atmo.mixSpace);
      fog.color.copy(tmpC);
      fog.density = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(zones.surface.d, zones.under.d, atmo.mixUnder),
        zones.space.d, atmo.mixSpace,
      );
      if (renderer) renderer.setClearColor(tmpC, 1);

      // caméra : proxy + respiration sous-marine + parallaxe souris
      const breathe = Math.sin(t * 0.5) * 0.6 * atmo.mixUnder;
      camera.position.set(cam.x + mouse.x * 2.2, cam.y + breathe, cam.z - dolly.z);
      camera.rotation.x = cam.rx + mouse.y * -0.02;
      camera.rotation.y = cam.ry + mouse.x * -0.03;
      camera.rotation.z = cam.rz;

      // vitesse de scroll lissée (0..1) — pilote le flou de zoom et les particules
      const y = window.scrollY;
      smoothVel += ((Math.min(Math.abs(lastY !== undefined ? y - lastY : 0), 120) / 120) - smoothVel) * 0.08;
      lastY = y;

      // ---- pont splash : plan vidéo scrubé + flou de zoom + particules ----
      const splashOn = splash.o > 0.002 && splashEtat.ok;
      splashPlane.visible = splashOn;
      if (splashOn) {
        splashUniforms.uOpacity.value = splash.o;
        // flou de zoom = gate (fx.blur) × vitesse de scroll → masque la coupe
        splashUniforms.uBlur.value = fx.blur * (0.045 + smoothVel * 0.16);
        // échelle : pré-zoomée pour matcher #heroEau à la coupe, puis plein cadre
        splashPlane.scale.set(splashW * splash.s, splashH * splash.s, 1);
        if (splashEtat.duree && splashVideo.readyState >= 2) {
          const cible = Math.round((splash.p * splashEtat.duree) / SPLASH_FRAME) * SPLASH_FRAME;
          if (Math.abs(cible - splashEtat.dernierT) >= SPLASH_FRAME / 2) {
            splashVideo.currentTime = Math.min(cible, splashEtat.duree - SPLASH_FRAME);
            splashEtat.dernierT = cible;
            // l'upload GPU se fait sur l'événement 'seeked' (voir plus haut)
          }
        }
      }
      // flou de la vidéo de surface DOM pendant sa sortie (accompagne le morph).
      // Gaté : uniquement si le pont vidéo est valide (splashEtat.ok) ET #heroEau
      // encore visible → jamais de flou résiduel sur un élément déjà invisible
      // (déjà fondu au noir) ni sur le repli « vidéo absente ». Sinon on nettoie.
      if (heroEauEl) {
        const eauVisible = splashEtat.ok && parseFloat(heroEauEl.style.opacity || '1') > 0.01;
        if (eauVisible && fx.blur > 0.002) {
          heroEauEl.style.filter = `blur(${(fx.blur * (0.6 + smoothVel * 5)).toFixed(2)}px)`;
        } else if (heroEauEl.style.filter) {
          heroEauEl.style.filter = '';
        }
      }

      const fxOn = (fx.rush > 0.002 || fx.burst > 0.002 || fx.spray > 0.002) && splashEtat.ok;
      fxGroup.visible = fxOn;
      if (fxOn) {
        // flux : les particules montent (on plonge) et filent vers le spectateur
        const flux = (layer, mul, sway) => {
          const arr = layer.geo.attributes.position.array;
          const sp = dt * (2.4 + fx.rush * 9 + fx.burst * 24) * mul;
          for (let i = 0; i < layer.count; i += 1) {
            arr[i * 3 + 1] += sp * (0.5 + layer.seed[i]);
            arr[i * 3 + 2] += sp * (0.7 + layer.seed[i] * 0.6);
            arr[i * 3] += Math.sin(t * 1.3 + layer.seed[i] * 9) * dt * sway;
            if (arr[i * 3 + 2] > -0.5) { // passé la caméra → réapparaît au loin
              const z = -rnd(SPLASH_DIST * 0.5, SPLASH_DIST - 0.6);
              arr[i * 3 + 2] = z;
              arr[i * 3] = rnd(-1, 1) * Math.abs(z) * layer.spread * 1.9;
              arr[i * 3 + 1] = -Math.abs(z) * layer.spread * rnd(0.6, 1.1);
            }
          }
          layer.geo.attributes.position.needsUpdate = true;
        };
        flux(rushBulles, 1, 0.6);
        rushBulles.mat.opacity = Math.min(1, fx.rush * 0.85 + fx.burst * 0.9);
        rushBulles.mat.size = 0.16 + fx.burst * 0.5;
        flux(rushTraits, 1.8, 0.2);
        rushTraits.mat.opacity = Math.min(1, fx.rush * 0.3 + fx.burst * 0.85);
        lensBulles.forEach((s) => {
          s.position.y += dt * s.userData.v * (0.6 + fx.rush * 2 + fx.burst * 5);
          s.position.x += Math.sin(t * 0.6 + s.userData.sway) * dt * 0.4;
          s.position.z += dt * (0.3 + fx.burst * 2.6);
          if (s.position.y > 2.4 || s.position.z > -0.4) {
            s.position.set(rnd(-2.4, 2.4), -rnd(1.4, 2.6), -rnd(1.6, 2.8));
          }
          s.material.opacity = Math.min(0.85, fx.rush * 0.5 + fx.burst * 0.7) * (0.5 + s.userData.v * 0.12);
        });
        // gouttes de sortie d'eau : jaillissent vers le haut + s'écartent, brèves
        if (fx.spray > 0.002) {
          const arr = sprayGeo.attributes.position.array;
          for (let i = 0; i < SPRAY_N; i += 1) {
            arr[i * 3 + 1] += dt * (5 + spraySeed[i] * 11);                            // montée rapide
            arr[i * 3] += (arr[i * 3] >= 0 ? 1 : -1) * dt * (1.3 + spraySeed[i] * 2.4); // s'écarte du centre
            arr[i * 3 + 2] += dt * (1.1 + spraySeed[i] * 2);                           // vers la caméra
            if (arr[i * 3 + 1] > 2.8 || arr[i * 3 + 2] > -0.35) sprayReset(i);
          }
          sprayGeo.attributes.position.needsUpdate = true;
          sprayMat.opacity = Math.min(0.9, fx.spray);
          sprayMat.size = 0.07 + fx.spray * 0.05;
        } else if (sprayMat.opacity !== 0) {
          sprayMat.opacity = 0;
        }
      }

      // visibilités par zone
      uw.visible = cam.y < 60;
      gal.visible = atmo.galaxy > 0.01;

      // particules sous-marines : dérive + réaction à la vitesse de scroll
      if (uw.visible) {
        const arr = pGeo.attributes.position.array;
        const rise = dt * (1.2 + smoothVel * 26);
        for (let i = 0; i < P; i += 1) {
          arr[i * 3 + 1] += rise * (0.4 + pSeed[i]);
          arr[i * 3] += Math.sin(t * 0.4 + pSeed[i] * 9) * dt * 1.4;
          if (arr[i * 3 + 1] > 0) arr[i * 3 + 1] = FLOOR + 2;
        }
        pGeo.attributes.position.needsUpdate = true;
        pMat.size = 2.6 + smoothVel * 7;
        pMat.opacity = 0.55 * DENSITE_PARTICULES;
        bokehs.forEach((s, i) => {
          s.position.y += dt * s.userData.v * (1 + smoothVel * 14);
          s.position.x += Math.sin(t * 0.3 + i) * dt * 0.8;
          if (s.position.y > -4) s.position.y = FLOOR + 12;
          s.material.rotation = Math.sin(t * 0.2 + i) * 0.08;
        });
        rays.forEach((r, i) => { r.rotation.z = Math.sin(t * 0.15 + i * 1.7) * 0.18; });
      }

      // galaxie : opacités + rotation lente
      if (gal.visible) {
        const op = atmo.galaxy;
        sMat.opacity = op;
        corridorMat.opacity = op * 0.9;
        spiral1.material.opacity = op * 0.95;
        spiral2.material.opacity = op * 0.8;
        nebulas.forEach((nb) => { nb.material.opacity = nb.userData.base * op; });
        stars.rotation.y = t * 0.004;
        spiral1.rotation.z += dt * 0.02;
        spiral2.rotation.z -= dt * 0.016;
      }
    },
    dispose() {
      window.removeEventListener('pointermove', onMove);
      triggers.forEach((tr) => tr && tr.kill());
      master.kill(); mtl.kill(); dollyTween.kill(); driftTween.kill();
      try { splashVideo.pause(); splashVideo.removeAttribute('src'); splashVideo.load(); } catch { /* noop */ }
      if (heroEauEl) heroEauEl.style.filter = ''; // pas de flou résiduel après teardown
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
