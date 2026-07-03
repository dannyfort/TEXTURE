/**
 * Scène 03 : derrière la méthode, des cadres de storyboard filaires
 * dérivent en profondeur — le film en train de se décider, plan par plan.
 */
import {
  Scene, PerspectiveCamera, PlaneGeometry, EdgesGeometry,
  LineSegments, LineBasicMaterial, Group, Color,
} from 'three';

const CADRES = [
  // [x, y, z, échelle, vitesse de dérive]
  [-6.2, 2.4, -7, 1.5, 0.7],
  [5.4, 3.1, -10, 2.1, 0.45],
  [-3.8, -2.6, -12, 2.6, 0.3],
  [7.2, -1.8, -6, 1.2, 0.85],
  [1.6, 4.2, -14, 3.0, 0.25],
  [-8.4, 0.6, -9, 1.8, 0.55],
  [3.2, -4.0, -8, 1.4, 0.65],
];

export function createCadres() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 40);
  camera.position.set(0, 0, 6);

  const group = new Group();
  scene.add(group);

  const base = new PlaneGeometry(1.78, 1); // 16:9
  const items = CADRES.map(([x, y, z, scale, drift], i) => {
    const edges = new EdgesGeometry(base); // une géométrie par cadre : dispose sans ambiguïté
    const material = new LineBasicMaterial({
      color: new Color('#e7c98a'),
      transparent: true,
      opacity: 0.3 + (i % 3) * 0.1,
    });
    const frame = new LineSegments(edges, material);
    frame.position.set(x, y, z);
    frame.scale.setScalar(scale);
    group.add(frame);
    return { frame, edges, baseY: y, drift, phase: i * 1.7 };
  });
  base.dispose();

  let progress = 0;

  return {
    scene,
    camera,
    active: false,
    setActive(on) { this.active = on; },
    setProgress(p) { progress = p; },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(t) {
      items.forEach(({ frame, baseY, drift, phase }) => {
        frame.position.y = baseY + Math.sin(t * 0.2 * drift + phase) * 0.5;
        frame.rotation.z = Math.sin(t * 0.13 * drift + phase) * 0.05;
      });
      // Travelling vertical : la caméra descend le long du storyboard
      // (les cadres montent à l'image), avec un léger panoramique de suivi.
      const cibleY = (0.5 - progress) * 10;
      const cibleX = Math.sin(progress * Math.PI) * 3.2; // courbe, pas un rail droit
      const cibleZ = 6 - Math.sin(progress * Math.PI) * 2.5; // on s'enfonce entre les cadres
      camera.position.y += (cibleY - camera.position.y) * 0.08;
      camera.position.x += (cibleX - camera.position.x) * 0.08;
      camera.position.z += (cibleZ - camera.position.z) * 0.08;
      camera.lookAt(cibleX * 0.4, cibleY * 0.5, -9);
    },
    dispose() {
      items.forEach(({ frame, edges }) => {
        edges.dispose();
        frame.material.dispose();
      });
    },
  };
}
