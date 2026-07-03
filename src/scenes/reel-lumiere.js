/**
 * Scène 02 : la salle de projection — version travelling.
 * Les trois films sont de vrais écrans 3D suspendus dans le noir, espacés
 * en profondeur le long d'un rail courbe. La caméra fait UN long travelling
 * continu, scrubé par le scroll : approche, passage devant chaque écran,
 * puis plongée vers le suivant. L'image vit uniquement dans le cadre ; poussière.
 * Les textures sont les <video> du DOM (scrubées par la timeline de section).
 */
import {
  Scene, PerspectiveCamera, PlaneGeometry, Mesh, ShaderMaterial, MeshBasicMaterial,
  VideoTexture, TextureLoader, LinearFilter, SRGBColorSpace, AdditiveBlending,
  CatmullRomCurve3, Vector3, EdgesGeometry, LineSegments, LineBasicMaterial,
  Color, BufferGeometry, BufferAttribute, Points, PointsMaterial, Box3,
} from 'three';

const ECRAN_W = 12;
const ECRAN_H = 6.75;
const PAS = 24;                      // profondeur entre deux écrans
const DERIVE = [-4.5, 4.8, -4.2];    // le rail serpente : gauche, droite, gauche

// Objets 3D posés à côté d'un écran (le produit du film) — par index de plan.
// Chargés en différé à l'activation de la scène ; le site vit sans.
const PRODUITS = [];

// Logos de marque flottant au-dessus de leur écran — la texture est le logo
// sombre sur fond clair : le shader le découpe par luminance et le teinte,
// comme une enseigne lumineuse dans le noir de la salle.
const LOGOS = [
  { ecran: 0, src: '/assets/img/logo-candia.png', largeur: 5.2, teinte: '#3f7fd6' },
  { ecran: 1, src: '/assets/img/logo-xpeng.png', largeur: 7.5, teinte: '#e8e3d8' },
];

const logoFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uTeinte;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float lum = dot(texture2D(uTex, vUv).rgb, vec3(0.299, 0.587, 0.114));
    float masque = smoothstep(0.88, 0.5, lum); // sombre = logo, clair = rien
    gl_FragColor = vec4(uTeinte, masque * uOpacity);
  }
`;

const spillVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function createReelLumiere(videos) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(52, 1, 0.1, 140);
  camera.position.set(0, 0.8, 16);

  const tungstene = new Color('#e7c98a');
  const n = videos.length;

  const ecrans = videos.map((video, i) => {
    const texture = new VideoTexture(video);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;

    const x = DERIVE[i % DERIVE.length];
    const z = -i * PAS;
    const rotY = x > 0 ? -0.22 : 0.22; // chaque écran s'ouvre vers le rail

    // l'écran net : un vrai écran de cinéma suspendu dans le noir
    const ecranGeo = new PlaneGeometry(ECRAN_W, ECRAN_H);
    const ecranMat = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 });
    const ecran = new Mesh(ecranGeo, ecranMat);
    ecran.position.set(x, 0.8, z);
    ecran.rotation.y = rotY;
    ecran.visible = false; // il n'existe pas tant qu'il n'a pas tourné dans le champ
    scene.add(ecran);

    // liseré tungstène : le cadre de l'écran
    const bordBase = new PlaneGeometry(ECRAN_W + 0.3, ECRAN_H + 0.3);
    const bordGeo = new EdgesGeometry(bordBase);
    bordBase.dispose();
    const bord = new LineSegments(
      bordGeo,
      new LineBasicMaterial({ color: tungstene, transparent: true, opacity: 0 }),
    );
    bord.position.copy(ecran.position);
    bord.rotation.copy(ecran.rotation);
    bord.visible = false;
    scene.add(bord);

    // l'image du film reste strictement dans le cadre : pas de halo mural
    // ni de reflet au sol (la vidéo ne déborde jamais de l'écran)
    return {
      ecran, bord, rotY,
      ecranMat, bordMat: bord.material,
      geos: [ecranGeo, bordGeo],
      pos: ecran.position.clone(),
    };
  });

  // Poussière le long du couloir : c'est elle qui rend le travelling lisible
  const DUST = 320;
  const positions = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = 18 - Math.random() * (n * PAS + 30);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(positions, 3));
  // opacité 0 au départ : la poussière n'habite le couloir qu'une fois le
  // travelling engagé (sinon elle se superpose à la galaxie pendant l'approche)
  const dustMat = new PointsMaterial({
    color: tungstene, size: 0.07, transparent: true, opacity: 0, depthWrite: false,
  });
  scene.add(new Points(dustGeo, dustMat));

  // Le rail : un point d'approche décalé devant chaque écran, puis le noir
  const rail = new CatmullRomCurve3([
    new Vector3(0, 0.8, 16),
    ...ecrans.map(({ pos }) => new Vector3(pos.x * 0.28, 0.9, pos.z + 10.5)),
    new Vector3(0, 0.5, -(n - 1) * PAS - 14), // on s'enfonce vers « votre film »
  ]);

  // ---- Logos de marque : enseignes lumineuses au-dessus des écrans ----
  const chargeurTex = new TextureLoader();
  const logos = LOGOS.filter(({ ecran: idx }) => ecrans[idx]).map(({
    ecran: idx, src, largeur, teinte,
  }) => {
    const e = ecrans[idx];
    const tex = chargeurTex.load(src, (t2) => {
      // la géométrie suit le ratio réel de l'image une fois connue
      const ratio = t2.image.height / t2.image.width;
      logo.scale.set(largeur, largeur * ratio, 1);
    });
    tex.colorSpace = SRGBColorSpace;

    const geo = new PlaneGeometry(1, 1);
    const mat = new ShaderMaterial({
      vertexShader: spillVertex,
      fragmentShader: logoFragment,
      uniforms: {
        uTex: { value: tex },
        uTeinte: { value: new Color(teinte) },
        uOpacity: { value: 0 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const logo = new Mesh(geo, mat);
    logo.position.set(e.pos.x, 0.8 + ECRAN_H / 2 + 1.7, e.pos.z); // au-dessus de l'écran
    logo.rotation.set(0, e.pos.x > 0 ? -0.22 : 0.22, 0); // même ouverture que l'écran
    logo.visible = false;
    scene.add(logo);
    return { logo, mat, geo, tex, idx, baseY: logo.position.y };
  });

  // ---- Produits 3D : le packshot flotte à côté de son écran ----
  // Scan photogrammétrique = lumière cuite dans la texture → MeshBasicMaterial
  // (la scène n'a aucune lampe, un matériau standard rendrait noir).
  const produits = [];
  let produitsCharges = false;
  const chargerProduits = async () => {
    produitsCharges = true;
    try {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      await Promise.all(PRODUITS.map(async ({ ecran: idx, src, hauteur }) => {
        const e = ecrans[idx];
        if (!e) return;
        const { scene: objet } = await loader.loadAsync(src);

        // matériaux : on bascule tout en basic (texture telle quelle) + fondu
        objet.traverse((m) => {
          if (!m.isMesh) return;
          const basic = new MeshBasicMaterial({ map: m.material.map, transparent: true, opacity: 0 });
          m.material.dispose();
          m.material = basic;
        });

        // échelle : la brique fait `hauteur` unités de haut, centrée sur son pivot
        const boite = new Box3().setFromObject(objet);
        const echelle = hauteur / Math.max(1e-4, boite.max.y - boite.min.y);
        objet.scale.setScalar(echelle);
        objet.position.set(
          e.pos.x + ECRAN_W * 0.68,            // à côté de l'écran, vers le rail
          -hauteur / 2,
          e.pos.z + 5,                          // un peu devant : la caméra le frôle
        );
        objet.visible = false;
        scene.add(objet);
        produits.push({ objet, idx, base: objet.position.y });
      }));
    } catch { /* fichier absent ou WebGL fragile : la salle vit sans packshot */ }
  };

  let progress = 0;
  const visee = new Vector3(0, 0.8, 0);     // point regardé, amorti
  const fondNoir = new Vector3();           // cible de fin, pré-allouée (zéro GC)

  return {
    scene,
    camera,
    active: false,
    setActive(on) {
      this.active = on;
      if (on && !produitsCharges) chargerProduits();
    },
    setProgress(p) { progress = p; },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(t) {
      // tp ∈ [0, n+1] : une unité par écran + l'unité finale (carton CTA)
      const tp = progress * (n + 1);

      // les enseignes : chaque logo s'allume avec son écran et ondule à peine
      logos.forEach((l) => {
        const presence = Math.max(0, 1 - Math.abs(tp - (l.idx + 0.5)) / 0.8);
        const o = presence * presence;
        l.logo.visible = o > 0.02;
        if (!l.logo.visible) return;
        l.mat.uniforms.uOpacity.value = o * 0.95;
        l.logo.position.y = l.baseY + Math.sin(t * 0.6 + l.idx * 2.1) * 0.16;
      });

      // le packshot : présent quand la caméra longe son écran, il tourne
      // avec le scroll et respire — entrée/sortie en fondu + montée
      produits.forEach((p) => {
        const presence = Math.max(0, 1 - Math.abs(tp - (p.idx + 0.5)) / 0.75);
        const o = presence * presence;
        p.objet.visible = o > 0.02;
        if (!p.objet.visible) return;
        p.objet.traverse((m) => { if (m.isMesh) m.material.opacity = o; });
        // un tour complet sur la tenue du plan, piloté par le scroll
        p.objet.rotation.y = (tp - (p.idx + 0.5)) * 2.2 + t * 0.12;
        p.objet.position.y = p.base + (1 - o) * -1.4 + Math.sin(t * 0.8 + p.idx) * 0.18;
      });

      // la poussière du couloir n'apparaît qu'une fois le travelling engagé
      dustMat.opacity = 0.55 * Math.min(1, Math.max(0, (tp - 0.02) / 0.25));

      // ARRIVÉE CINÉMATIQUE : un écran n'existe pas avant son moment. Il
      // surgit alors du vide galactique en pivotant sur lui-même — téléviseur
      // qui se retourne dans l'espace — puis se pose sur son emplacement du
      // rail. Tout est indexé sur tp : scrubé, donc réversible au scroll.
      ecrans.forEach((e, i) => {
        // fenêtre d'arrivée : l'écran 0 dès l'engagement du travelling, les
        // suivants pendant la bascule de regard qui les amène dans le cadre
        const debut = i === 0 ? 0.03 : i - 0.55;
        const fin = i === 0 ? 0.42 : i - 0.1;
        let a = Math.min(1, Math.max(0, (tp - debut) / (fin - debut)));
        a = a * a * (3 - 2 * a); // décélère en se posant

        e.ecran.visible = a > 0.001;
        e.bord.visible = e.ecran.visible;
        if (!e.ecran.visible) return;

        const presence = Math.max(0, 1 - Math.abs(tp - (i + 0.5)) / 0.85);
        const o = presence * presence;
        const spin = 1 - a;

        if (spin > 0) {
          const cote = e.pos.x > 0 ? 1 : -1;
          e.ecran.position.set(
            e.pos.x + spin * spin * 6 * cote, // déboîté vers son côté du rail
            e.pos.y + spin * 2.6,             // descend en se posant
            e.pos.z - spin * 9,               // depuis plus loin dans le vide
          );
          e.ecran.rotation.set(
            spin * 0.16,
            e.rotY + spin * 2.9,              // presque dos tourné → face caméra
            spin * (-0.22 + Math.sin(t * 1.1 + i) * 0.08), // flottement organique
          );
        } else {
          e.ecran.position.copy(e.pos);       // posé : géométrie d'origine exacte
          e.ecran.rotation.set(0, e.rotY, 0);
        }
        e.bord.position.copy(e.ecran.position);
        e.bord.rotation.copy(e.ecran.rotation);

        // l'image s'allume en finissant de se retourner ; une fois posé,
        // présence d'origine (net et lumineux quand la caméra le longe)
        e.ecranMat.opacity = a * (0.18 + o * 0.82);
        // le cadre : halo d'origine + surbrillance pendant la manœuvre, pour
        // lire la rotation même quand l'image est encore de dos
        e.bordMat.opacity = Math.max(o * 0.6, a * (1 - a) * 4 * 0.5);
      });

      // LE travelling : la caméra suit le rail, amortie comme une vraie dolly
      const cible = rail.getPoint(Math.min(1, Math.max(0, progress)));
      camera.position.x += (cible.x - camera.position.x) * 0.07;
      camera.position.y += (cible.y - camera.position.y) * 0.07;
      camera.position.z += (cible.z - camera.position.z) * 0.09;

      // le regard : accroché à l'écran courant, puis bascule vers le suivant
      const idx = Math.min(n - 1, Math.max(0, Math.floor(tp)));
      const local = tp - idx;
      const courant = ecrans[idx].pos;
      const prochain = idx < n - 1
        ? ecrans[idx + 1].pos
        : fondNoir.set(0, 0.4, courant.z - 30); // après le dernier : le noir du fond
      const a = Math.min(1, Math.max(0, (local - 0.72) / 0.28));
      const bascule = a * a * (3 - 2 * a);
      visee.x += (courant.x + (prochain.x - courant.x) * bascule - visee.x) * 0.06;
      visee.y += (courant.y + (prochain.y - courant.y) * bascule - visee.y) * 0.06;
      visee.z += (courant.z + (prochain.z - courant.z) * bascule - visee.z) * 0.06;
      camera.lookAt(visee);
    },
    dispose() {
      dustGeo.dispose();
      dustMat.dispose();
      logos.forEach((l) => { l.geo.dispose(); l.mat.dispose(); l.tex.dispose(); });
      produits.forEach((p) => p.objet.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.dispose();
        m.material.map?.dispose();
        m.material.dispose();
      }));
      ecrans.forEach((e) => {
        e.geos.forEach((g) => g.dispose());
        e.ecranMat.map?.dispose();
        e.ecranMat.dispose();
        e.bordMat.dispose();
      });
    },
  };
}
