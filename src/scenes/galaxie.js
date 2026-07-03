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
const VITESSE_OCEAN = 0.45;
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

  // ---------- SCÈNE A : océan (vu du dessus) ----------
  const oceanUni = {
    uTime: { value: 0 },
    uAmp: { value: 1.0 },
    uDeep: { value: new THREE.Color('#0a2e36') },
    uCrest: { value: new THREE.Color('#8fd0d6') },
    uFoam: { value: new THREE.Color('#eef6f8') },
    uGlint: { value: new THREE.Color('#dff6f8') },
  };
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUni,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      uniform float uTime; uniform float uAmp;
      varying vec3 vP; varying float vH;
      float wave(vec2 p, vec2 d, float f, float s, float a){ return sin(dot(p,d)*f + uTime*s)*a; }
      void main(){
        vec3 pos = position;
        float h = 0.0;
        h += wave(pos.xy, vec2(0.7,0.7), 0.045, 0.5, 2.6);
        h += wave(pos.xy, vec2(-0.4,0.9), 0.08, 0.38, 1.5);
        h += wave(pos.xy, vec2(1.0,-0.2), 0.16, 0.65, 0.7);
        h += wave(pos.xy, vec2(-0.8,-0.6), 0.32, 0.9, 0.32);
        h += wave(pos.xy, vec2(0.3,-1.0), 0.55, 1.2, 0.14);
        pos.z += h * uAmp;
        vH = h; vP = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uCrest; uniform vec3 uFoam; uniform vec3 uGlint;
      varying vec3 vP; varying float vH;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0; float a = 0.5;
        for(int k=0;k<4;k++){ v += a*vnoise(p); p = p*2.13 + vec2(17.3, 9.1); a *= 0.5; }
        return v;
      }
      void main(){
        float t = smoothstep(-3.2, 3.2, vH);
        vec3 col = mix(uDeep, uCrest, pow(t, 1.7));
        vec2 q = vP.xy * 0.055;
        float flow = fbm(q + vec2(uTime*0.05, -uTime*0.03));
        float vein = fbm(q*2.4 + vec2(flow*1.8) + vec2(-uTime*0.04, uTime*0.06));
        float fil = 1.0 - abs(vein*2.0 - 1.0);
        fil = smoothstep(0.78, 0.97, fil);
        float crestMask = smoothstep(0.6, 0.95, t);
        float plaque = smoothstep(0.45, 0.75, flow);
        col = mix(col, uFoam, fil * crestMask * plaque * 0.5);
        float glint = exp(-abs(vP.x)*0.045) * (0.35 + 0.65*fbm(vP.xy*0.12 + vec2(0.0, uTime*0.08)));
        col += uGlint * glint * 0.14 * (0.4 + 0.6*t);
        float sp = hash(floor(vP.xy*1.6) + floor(uTime*1.5));
        col += uGlint * step(0.997, sp) * 0.45;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 220, 220), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  scene.add(ocean);

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

  const disposables = [oceanMat, ocean.geometry, floor.geometry, floor.material, texRound, texAnam, texGlow];

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
  const atmo = { mixUnder: 0, mixSpace: 0, galaxy: 0, amp: 1 };
  const dolly = { z: 0 };

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
    .to(atmo, { amp: 1.45, duration: 14 }, 0)
    // plongée
    .to(cam, { y: -6, duration: 8, ease: 'power2.in' }, 14)
    .to(cam, { y: -96, rx: -0.06, duration: 9, ease: 'power2.out' }, 22)
    .to(cam, { z: 26, duration: 9 }, 22)
    .to(atmo, { mixUnder: 1, duration: 6, ease: 'power1.in' }, 17)
    .to('#heroInner', { opacity: 0, scale: 1.16, duration: 6, ease: 'power1.in' }, 14)
    .to('#heroScroll', { opacity: 0, duration: 3 }, 14)
    .to('#flash', { opacity: 0.95, duration: 1.6, ease: 'power2.in' }, 20.4)
    .to('#flash', { opacity: 0, duration: 3.2, ease: 'power2.out' }, 22.2)
    // dérive sous-marine pendant le manifeste — RACCOURCIE (24 au lieu de 50) :
    // le texte est lu, on ne s'attarde plus dans le vide avant de remonter
    .to(cam, { z: -34, x: 8, ry: 0.16, duration: 24 }, 31)
    // ascension — déclenchée bien plus tôt (55 au lieu de 81) : elle enchaîne
    // presque directement sur la dernière ligne du manifeste
    .to(cam, { y: -20, rx: 0.42, duration: 7, ease: 'power3.in' }, 55)
    .to(cam, { y: 640, duration: 8, ease: 'power2.in' }, 62)
    .to(cam, { y: 900, rx: 0, ry: 0, x: 0, z: 0, duration: 4, ease: 'power2.out' }, 70)
    .to(atmo, { mixUnder: 0, duration: 5 }, 62)
    .to(atmo, { mixSpace: 1, galaxy: 1, duration: 9 }, 63)
    .to('#flash', { opacity: 0.9, duration: 1.4, ease: 'power2.in' }, 63)
    .to('#flash', { opacity: 0, duration: 3.5, ease: 'power2.out' }, 64.6);
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
  let waterT = 0;
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
    },
    update() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = (performance.now() - startT) / 1000;

      // vitesse de l'eau (ralentie)
      waterT += dt * VITESSE_OCEAN;
      oceanUni.uTime.value = waterT;
      oceanUni.uAmp.value = atmo.amp;

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

      // visibilités par zone
      ocean.visible = cam.y < 420;
      uw.visible = cam.y < 60;
      gal.visible = atmo.galaxy > 0.01;

      // particules sous-marines : dérive + réaction à la vitesse de scroll
      const y = window.scrollY;
      smoothVel += ((Math.min(Math.abs(lastY !== undefined ? y - lastY : 0), 120) / 120) - smoothVel) * 0.08;
      lastY = y;
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
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
