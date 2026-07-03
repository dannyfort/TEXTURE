import { gsap, EASE } from '../lib/motion.js';
import { playInView, freezeFrame, chainerSources } from '../lib/video-scrub.js';

const FRAME = 1 / 24; // quantification 24 i/s

/** Écrans de scroll par plan du travelling — importé par scenes/index.js
 *  pour que la fenêtre d'activation 3D reste synchrone avec la timeline. */
export const REEL_PAS = 4.2; // ↑ = travelling plus lent, vrai temps de focus par plan

/** Bobine « salle » (desktop) : les écrans vivent dans la scène 3D — le DOM
 *  cache les <video> (sources de texture) et ne garde que les fiches texte,
 *  qui apparaissent en surimpression quand la caméra longe leur écran.
 *  Une unité de timeline par film + une unité finale pour le carton CTA. */
export function initReel({ mode = 'profondeur' } = {}) {
  const piste = document.getElementById('reelPiste');
  if (!piste) return undefined;
  const videos = gsap.utils.toArray('.cadre-video');

  // Certains films (data-lecture="auto") se lisent en temps réel plutôt
  // qu'au scrub — avec enchaînement de plusieurs fichiers (data-suite).
  videos.forEach((video) => {
    const suite = video.dataset.suite;
    if (suite) chainerSources(video, suite.split(','));
  });

  if (mode === 'profondeur') {
    document.querySelector('.reel')?.classList.add('reel--salle');
    // les écrans DOM ne sont plus que des sources de texture : on les sort
    // de l'arbre d'accessibilité (les fiches portent le contenu)
    document.querySelectorAll('.reel--salle .cadre-ecran').forEach((f) => f.setAttribute('aria-hidden', 'true'));
    const fiches = gsap.utils.toArray('.cadre-fiche');
    const fin = document.querySelector('.cadre--fin');
    const n = videos.length;

    // état vidéo : scrub manuel par segment de timeline — sauf pour les
    // films en lecture réelle (data-lecture="auto"), qu'on joue/pause
    // selon que la caméra est sur leur écran.
    const etats = videos.map((video) => {
      video.addEventListener('error', () => {
        video.closest('.cadre-ecran')?.classList.add('sans-video');
        video.remove();
      }, { once: true });
      const s = {
        video, duration: 0, lastT: -1, auto: video.dataset.lecture === 'auto', joue: false,
      };
      const ready = () => { s.duration = video.duration || 0; };
      if (video.readyState >= 1) ready();
      else video.addEventListener('loadedmetadata', ready, { once: true });
      return s;
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.reel',
        pin: true,
        start: 'top top',
        // REEL_PAS écrans de scroll par plan : le travelling a la place de respirer
        end: () => `+=${(n + 1) * window.innerHeight * REEL_PAS}`,
        scrub: 1.7, // dolly lourde : le travelling traîne légèrement derrière le geste
        invalidateOnRefresh: true,
        onUpdate(self) {
          // chaque film se lit sur la fenêtre 15–85 % de son unité de travelling
          const tp = self.progress * (n + 1);
          etats.forEach((s, i) => {
            if (!s.video.isConnected) return;
            if (s.auto) {
              // lecture réelle : on joue tant que la caméra longe cet écran
              const actif = tp > i - 0.1 && tp < i + 1.1;
              if (actif && !s.joue) { s.joue = true; s.video.play().catch(() => {}); }
              if (!actif && s.joue) { s.joue = false; s.video.pause(); }
              return;
            }
            if (!s.duration || s.video.readyState < 2) return;
            const local = Math.min(1, Math.max(0, (tp - i - 0.15) / 0.7));
            const t = Math.round((local * s.duration) / FRAME) * FRAME;
            if (Math.abs(t - s.lastT) < FRAME / 2) return;
            s.lastT = t;
            s.video.currentTime = Math.min(t, s.duration - FRAME);
          });
        },
      },
    });

    // Fiches : pendant la tenue du plan, le carton se dévoile ligne par
    // ligne (tag → nom → description), et la colonne méta tombe en cascade
    // à droite de l'écran. Sortie groupée juste avant le plan suivant.
    fiches.forEach((fiche, i) => {
      const lignes = gsap.utils.toArray(fiche.children);
      gsap.set(fiche, { opacity: 0 });
      gsap.set(lignes, { opacity: 0, y: 26 });
      tl.set(fiche, { opacity: 1 }, i + 0.18)
        .to(lignes, {
          opacity: 1, y: 0, duration: 0.14, stagger: 0.07, ease: EASE.sortie,
        }, i + 0.2)
        .to(fiche, { opacity: 0, y: -18, duration: 0.12, ease: 'power2.in' }, i + 0.86)
        .set(fiche, { y: 0 }, i + 0.99);
    });

    gsap.utils.toArray('.cadre-meta').forEach((meta, i) => {
      const lignes = gsap.utils.toArray(meta.children);
      gsap.set(lignes, { opacity: 0, x: 28 });
      tl.to(lignes, {
        opacity: 1, x: 0, duration: 0.12, stagger: 0.06, ease: EASE.sortie,
      }, i + 0.26)
        .to(lignes, { opacity: 0, x: 16, duration: 0.1, ease: 'power2.in' }, i + 0.86);
    });

    // Carton final : émerge du noir au bout du rail, et reste
    if (fin) {
      gsap.set(fin, { opacity: 0, scale: 0.92 });
      tl.to(fin, { opacity: 1, scale: 1, duration: 0.35, ease: EASE.sortie }, n + 0.3);
    }

    return tl; // la scène 3D « salle de projection » se cale dessus
  }

  if (mode === 'vertical') {
    videos.forEach((video) => playInView(video));
    gsap.utils.toArray('.cadre').forEach((cadre) => {
      gsap.fromTo(cadre, { opacity: 0, y: 36 }, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: EASE.sortie,
        scrollTrigger: { trigger: cadre, start: 'top 82%' },
      });
    });
    return undefined;
  }

  // mode 'static' — mouvement réduit
  videos.forEach((video) => freezeFrame(video));
  return undefined;
}
