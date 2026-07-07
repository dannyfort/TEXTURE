import { gsap, EASE } from '../lib/motion.js';

/**
 * Amorce 35 mm : compte à rebours 3-2-1 puis ouverture.
 * Renvoie une promesse résolue quand l'écran est dégagé.
 */
export function playLoader({ skip = false } = {}) {
  const loader = document.getElementById('loader');
  const count = document.getElementById('loaderCount');
  const sweep = document.getElementById('loaderSweep');

  if (!loader || skip) {
    loader?.classList.add('est-fini');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      // Pas de fondu de sortie, pas de masquage ici : le loader reste OPAQUE
      // jusqu'à ce que l'ident le recouvre (playIdent le masque ensuite).
      // Sinon le hero (eau) transparaît le temps du fondu, entre l'amorce et
      // la 1ère frame de la vidéo. On veut une COUPE FRANCHE « 1 » → image.
      onComplete: resolve,
    });

    [3, 2, 1].forEach((n) => {
      tl.set(count, { textContent: n })
        .fromTo(count, { opacity: 0.35, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.12, ease: EASE.sortie })
        .fromTo(sweep, { rotation: 0 }, { rotation: 360, duration: 0.52 }, '<');
    });

    tl.to({}, { duration: 0.24 }); // bref maintien sur « 1 » avant la coupe
  });
}
