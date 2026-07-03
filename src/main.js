import {
  gsap, ScrollTrigger, ScrollSmoother, prefersReducedMotion,
} from './lib/motion.js';
import { playLoader } from './sections/loader.js';
import { initHud } from './sections/hud.js';
import { initReel } from './sections/reel.js';
import { initMethode } from './sections/methode.js';
import { freezeFrame } from './lib/video-scrub.js';

const isDesktop = window.matchMedia('(min-width: 760px)').matches;

async function start() {
  // ----- Mouvement réduit : tout visible, zéro animation, zéro WebGL -----
  // Le voyage « Océan → Galaxie » est purement décoratif : on l'omet, le CSS
  // (media reduce) remet à plat les sections hautes (manifeste, transitions).
  if (prefersReducedMotion) {
    document.getElementById('loader')?.classList.add('est-fini');
    document.getElementById('stage')?.remove();
    document.querySelectorAll('.cadre-video').forEach((v) => freezeFrame(v));
    initHud();
    return;
  }

  // ----- Expérience complète -----
  const smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 2.4, // inertie lourde : une dolly, pas une molette
    smoothTouch: false,
  });

  smoother.paused(true);
  window.scrollTo(0, 0);

  // Sections DOM — créées dans l'ordre de la page (refresh order).
  // ⚠ LA BOBINE et LA MÉTHODE gardent leur comportement d'origine :
  // initReel(profondeur) et initMethode() sont inchangés.
  const reelTween = initReel({ mode: isDesktop ? 'profondeur' : 'vertical' });
  initMethode();
  initHud();
  // Hero, manifeste et révélations (œil/tarifs/générique) sont animés par la
  // scène galaxie.js elle-même (timeline maîtresse + data-reveal).

  // Les scènes 3D — un seul canvas fixe derrière le DOM, import différé.
  // On attend leur création AVANT le premier refresh (l'amorce masque le
  // chargement) : sinon le refresh du .then peut croiser celui du loader
  // et désaligner les triggers selon la vitesse du réseau.
  const stageCanvas = document.getElementById('stage');
  const scenesPretes = (stageCanvas && window.WebGLRenderingContext)
    ? import('./scenes/index.js')
      .then(({ initScenes }) => initScenes({ canvas: stageCanvas, reelTween, isDesktop }))
      .catch(() => { stageCanvas.remove(); /* le site vit très bien sans WebGL */ })
    : Promise.resolve(stageCanvas?.remove());

  await Promise.all([playLoader(), scenesPretes]);
  smoother.paused(false);
  ScrollTrigger.refresh();

  // Les polices et métadonnées vidéo arrivent après le premier refresh et
  // changent les hauteurs : sans nouveau refresh, ScrollSmoother garde un
  // maximum de scroll périmé et la fin de page devient inatteignable.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  if (document.readyState === 'complete') {
    ScrollTrigger.refresh();
  } else {
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
