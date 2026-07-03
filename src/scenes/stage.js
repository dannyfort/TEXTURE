/**
 * Le plateau : un seul canvas plein écran fixé derrière le DOM,
 * un seul renderer, plusieurs scènes activées/coupées par le scroll.
 * Aucun rendu quand aucune scène n'est active.
 */
import { WebGLRenderer } from 'three';
import { gsap } from '../lib/motion.js';

export function createStage(canvas) {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    // MSAA : le fond « Océan → Galaxie » ajoute de la vraie géométrie (surface
    // d'eau, coraux, rochers) dont les bords profitent du lissage.
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.autoClear = false;

  const scenes = new Set();
  let width = window.innerWidth;
  let height = window.innerHeight;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height, false);
    scenes.forEach((s) => s.resize?.(width, height));
  };
  resize();
  window.addEventListener('resize', resize);

  // Une seule horloge pour tout le site : le ticker GSAP (déjà la convention)
  const frame = (time) => {
    let any = false;
    scenes.forEach((s) => { if (s.active) any = true; });
    if (!any) return; // rien à l'écran → zéro travail GPU

    renderer.clear();
    let first = true;
    scenes.forEach((s) => {
      if (!s.active) return;
      // deux scènes actives en transition : chacune repart d'un depth propre
      if (!first) renderer.clearDepth();
      first = false;
      s.update?.(time);
      renderer.render(s.scene, s.camera);
    });
  };
  gsap.ticker.add(frame);

  // Perte de contexte (mobile) : on coupe proprement, le DOM prend le relais.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    gsap.ticker.remove(frame);
    canvas.style.display = 'none';
  });

  return {
    renderer,
    size: () => ({ width, height }),
    /** Enregistre une scène { scene, camera, active, update?, resize?, setActive? }. */
    register(entry) {
      scenes.add(entry);
      entry.resize?.(width, height);
      return entry;
    },
  };
}

/** Position du pointeur partagée entre scènes (−0.5 … 0.5, centre écran). */
export const pointer = window.__cgPointer ?? { x: 0, y: 0, raw: 0.5 };
if (!window.__cgPointer) {
  // garde anti-HMR : un seul écouteur quel que soit le nombre de rechargements
  window.__cgPointer = pointer;
  window.addEventListener('pointermove', (e) => {
    pointer.raw = e.clientX / window.innerWidth;
    pointer.x = pointer.raw - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
}
