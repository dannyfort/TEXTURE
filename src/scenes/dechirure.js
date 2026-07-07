/**
 * DÉCHIRURE — transition de sortie de l'ident, rendue en WebGL.
 *
 * L'écran se perce en plusieurs points depuis les bords, comme un papier qui
 * brûle : les trous s'ouvrent (bruit fbm biaisé vers les côtés), leurs lisières
 * rougeoient (braise) et ondulent (distorsion de chaleur), et l'eau du hero
 * apparaît derrière. `render(progress)` est piloté par le scrub du scroll —
 * progress 1 = l'image de l'ident est entièrement consumée.
 *
 * Autonome : son propre renderer sur un canvas dédié dans l'overlay ident
 * (vie courte — créé au premier scroll, disposé à la fin de l'intro).
 */
import * as THREE from 'three';

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uProgress;
  uniform float uTime;
  uniform vec2 uCoverA;
  uniform vec2 uCoverB;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int k = 0; k < 5; k++) { v += a * vnoise(p); p = p * 2.17 + vec2(13.7, 7.3); a *= 0.5; }
    return v;
  }
  vec2 cover(vec2 uv, vec2 s) { return (uv - 0.5) * s + 0.5; }

  void main() {
    vec2 uv = vUv;

    // Champ de combustion : bruit organique + amorces sur les bords
    // (les trous naissent sur les côtés, le centre — le mot — tient le plus longtemps).
    float n = fbm(uv * vec2(3.1, 2.4) + vec2(uTime * 0.045, -uTime * 0.03));
    float dBord = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float champ = n * 0.68 + smoothstep(0.42, 0.0, dBord) * 0.42;

    // Seuil qui descend avec le scroll : t > 0 = zone consumée. Calibré (champ
    // mesuré ∈ [0.20, 0.94]) pour que RIEN ne soit ouvert à progress 0 (1.035 >
    // champ max) et que l'eau soit PLEINE seulement vers progress ~0.95 (avant :
    // ~0.70, d'où un long « eau sans logo »). La combustion finit donc quasiment
    // quand l'ident se dissout → plus de temps mort avant l'apparition du logo.
    float t = champ - (1.035 - uProgress * 0.90);

    float ouvert = smoothstep(0.0, 0.045, t);
    float lisiere = smoothstep(0.085, 0.0, abs(t));
    float charbon = smoothstep(0.14, 0.0, -t) * (1.0 - ouvert);

    // Chaleur : l'image de l'ident ondule près de la lisière.
    vec2 dis = (vec2(vnoise(uv * 24.0 + uTime * 0.7), vnoise(uv * 24.0 - uTime * 0.6)) - 0.5)
      * (lisiere * 0.028 + charbon * 0.012);

    vec3 colA = texture2D(uTexA, cover(uv + dis, uCoverA)).rgb;
    vec3 colB = texture2D(uTexB, cover(uv, uCoverB)).rgb;

    // Papier carbonisé sur le pourtour, braise sur la lisière vive.
    colA *= 1.0 - charbon * 0.75;
    vec3 braise = mix(vec3(1.0, 0.42, 0.1), vec3(0.38, 0.88, 0.85), 0.22)
      * lisiere * (1.15 + 0.5 * vnoise(uv * 60.0 + uTime * 2.0));

    vec3 col = mix(colA, colB, ouvert) + braise * (1.0 - ouvert * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function createDechirure({ canvas, videoA, videoB }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const texA = new THREE.VideoTexture(videoA);
  const texB = new THREE.VideoTexture(videoB);
  texA.colorSpace = THREE.SRGBColorSpace;
  texB.colorSpace = THREE.SRGBColorSpace;

  const uniforms = {
    uTexA: { value: texA },
    uTexB: { value: texB },
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uCoverA: { value: new THREE.Vector2(1, 1) },
    uCoverB: { value: new THREE.Vector2(1, 1) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);

  // innerWidth peut être 0 (onglet caché, pré-rendu) : on retombe sur le
  // documentElement puis sur une taille sûre.
  const tailleEcran = () => {
    const w = window.innerWidth || document.documentElement.clientWidth || 1280;
    const h = window.innerHeight || document.documentElement.clientHeight || 720;
    return [Math.max(w, 2), Math.max(h, 2)];
  };

  const coverScale = (video, out, sa) => {
    const va = (video.videoWidth || 16) / (video.videoHeight || 9);
    if (sa > va) out.set(1, va / sa);
    else out.set(sa / va, 1);
  };

  return {
    resize(largeur, hauteur) {
      const [w, h] = (largeur && hauteur) ? [largeur, hauteur] : tailleEcran();
      // updateStyle=false : on NE touche PAS au style inline du canvas — c'est
      // le CSS (inset:0 / width:height:100%) qui gère la taille d'affichage
      // plein écran ; ici on ne fixe que la résolution du buffer de rendu.
      renderer.setSize(w, h, false);
      coverScale(videoA, uniforms.uCoverA.value, w / h);
      coverScale(videoB, uniforms.uCoverB.value, w / h);
    },
    render(progress, dt = 0.016) {
      uniforms.uProgress.value = progress;
      uniforms.uTime.value += dt;
      // Upload forcé : three ne rafraîchit les VideoTextures que via
      // requestVideoFrameCallback, jamais déclenché si la vidéo est en pause
      // (ident terminé, onglet en arrière-plan…).
      if (videoA.readyState >= 2) texA.needsUpdate = true;
      if (videoB.readyState >= 2) texB.needsUpdate = true;
      renderer.render(scene, camera);
    },
    dispose() {
      texA.dispose();
      texB.dispose();
      quad.geometry.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
