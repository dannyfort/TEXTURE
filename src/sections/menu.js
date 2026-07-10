import { gsap, ScrollSmoother, prefersReducedMotion } from '../lib/motion.js';

/**
 * MENU PANORAMA — hamburger discret, cinématique, disponible dès l'amorce.
 *
 * Le bouton (deux traits de pellicule, coin haut droit, AU-DESSUS du loader
 * et de l'ident, sous les barres letterbox) ouvre un écran « index des
 * scènes » : chaque chapitre du film, numéroté et timecodé, en accès direct
 * pour qui connaît déjà le site.
 *
 * Choisir une scène pendant l'intro SAUTE l'intro (équivalent du bouton
 * « PASSER → » de l'ident) puis glisse jusqu'à la section via ScrollSmoother
 * — le voyage garde son inertie de dolly. Sans smoother (mouvement réduit) :
 * scrollIntoView natif.
 */

/* L'intro se saute d'elle-même : on clique « PASSER → » dès que l'ident
   écoute (pendant l'amorce 3-2-1 il n'écoute pas encore — on insiste),
   et on résout quand l'overlay est démonté (classe est-fini). */
const sauterIntro = () => new Promise((resolu) => {
  const ident = document.getElementById('ident');
  if (!ident || ident.classList.contains('est-fini')) {
    resolu();
    return;
  }
  const tic = setInterval(() => {
    if (ident.classList.contains('est-fini')) {
      clearInterval(tic);
      resolu();
    } else {
      ident.querySelector('.ident-passer')?.click();
    }
  }, 130);
});

const allerVers = async (selecteur) => {
  await sauterIntro();
  const cible = document.querySelector(selecteur);
  if (!cible) return;
  const smoother = ScrollSmoother.get();
  if (!smoother) {
    cible.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    return;
  }
  /* main.js relâche le smoother juste après l'ident : on attend qu'il roule.
     Puis deux frames de battement — les refresh tardifs (polices, métadonnées
     vidéo) se posent avant le calcul de l'offset de la cible. */
  const partir = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      smoother.scrollTo(cible, !prefersReducedMotion, 'top top');
    }));
  };
  if (!smoother.paused()) {
    partir();
    return;
  }
  const tic = setInterval(() => {
    if (!smoother.paused()) {
      clearInterval(tic);
      partir();
    }
  }, 90);
  setTimeout(() => clearInterval(tic), 6000); // garde-fou : jamais de poll infini
};

export function initMenu() {
  const bouton = document.getElementById('menuBouton');
  const panneau = document.getElementById('menuPanorama');
  if (!bouton || !panneau) return;

  const liens = [...panneau.querySelectorAll('.menu-lien')];
  const decor = [
    panneau.querySelector('.menu-sur'),
    panneau.querySelector('.menu-pied'),
  ].filter(Boolean);
  let ouvert = false;

  const ouvrir = () => {
    ouvert = true;
    bouton.classList.add('est-ouvert');
    bouton.setAttribute('aria-expanded', 'true');
    bouton.setAttribute('aria-label', 'Fermer le menu');
    panneau.classList.add('est-ouvert');
    panneau.setAttribute('aria-hidden', 'false');
    if (!prefersReducedMotion) {
      gsap.killTweensOf([panneau, ...liens, ...decor]);
      gsap.fromTo(panneau, { opacity: 0 }, { opacity: 1, duration: 0.38, ease: 'power2.out' });
      gsap.fromTo(liens, { opacity: 0, y: 26 }, {
        opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.05, delay: 0.08,
      });
      gsap.fromTo(decor, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.28 });
    }
    liens[0]?.focus({ preventScroll: true });
  };

  const fermer = () => {
    if (!ouvert) return;
    ouvert = false;
    bouton.classList.remove('est-ouvert');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.setAttribute('aria-label', 'Ouvrir le menu');
    /* le focus quitte le panneau AVANT qu'il ne soit caché (a11y) */
    if (panneau.contains(document.activeElement)) bouton.focus({ preventScroll: true });
    const finir = () => {
      panneau.classList.remove('est-ouvert');
      panneau.setAttribute('aria-hidden', 'true');
    };
    if (prefersReducedMotion) {
      finir();
      return;
    }
    gsap.killTweensOf([panneau, ...liens, ...decor]);
    gsap.to(panneau, {
      opacity: 0, duration: 0.26, ease: 'power2.in',
      onComplete: () => {
        gsap.set([panneau, ...liens, ...decor], { clearProps: 'opacity,transform' });
        finir();
      },
    });
  };

  bouton.addEventListener('click', () => (ouvert ? fermer() : ouvrir()));

  /* clic sur le fond (hors liens) = fermer */
  panneau.addEventListener('click', (e) => {
    if (e.target === panneau) fermer();
  });

  /* Échap ferme le menu — et n'atteint pas l'ident derrière (son écouteur
     Échap « PASSER » est enregistré après le nôtre : stopImmediatePropagation
     évite de sauter l'intro en voulant juste refermer le menu). */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !ouvert) return;
    e.stopImmediatePropagation();
    fermer();
  });

  liens.forEach((lien) => {
    lien.addEventListener('click', (e) => {
      const sel = lien.getAttribute('href');
      if (!sel || !sel.startsWith('#')) return; // mailto & co : natif
      e.preventDefault();
      fermer();
      allerVers(sel);
    });
  });
}
