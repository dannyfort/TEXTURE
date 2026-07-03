import { gsap, ScrollTrigger } from './motion.js';

const FRAME = 1 / 24; // quantification 24 i/s — évite de spammer currentTime

/**
 * Pilote la lecture d'une vidéo par le scroll (scrub).
 * Fallback : si le fichier manque, le cadre passe en mode « sans-video ».
 */
export function scrubVideo(video, triggerVars) {
  if (!video) return;

  video.addEventListener('error', () => {
    video.closest('.cadre-ecran')?.classList.add('sans-video');
    video.remove();
  }, { once: true });

  const state = { duration: 0, lastT: -1 };

  const ready = () => { state.duration = video.duration || 0; };
  if (video.readyState >= 1) ready();
  else video.addEventListener('loadedmetadata', ready, { once: true });

  ScrollTrigger.create({
    ...triggerVars,
    onUpdate(self) {
      if (!state.duration || video.readyState < 2) return;
      const t = Math.round((self.progress * state.duration) / FRAME) * FRAME;
      if (Math.abs(t - state.lastT) < FRAME / 2) return;
      state.lastT = t;
      video.currentTime = Math.min(t, state.duration - FRAME);
    },
  });
}

/** Mobile / fallback : lecture en boucle quand le cadre est visible. */
export function playInView(video, triggerVars = {}) {
  if (!video) return;

  video.addEventListener('error', () => {
    video.closest('.cadre-ecran')?.classList.add('sans-video');
    video.remove();
  }, { once: true });

  // pas de loop natif si la vidéo enchaîne plusieurs fichiers (data-suite) :
  // c'est l'événement 'ended' qui fait tourner la playlist
  video.loop = !video.dataset.suite;

  ScrollTrigger.create({
    trigger: video,
    start: 'top 85%',
    end: 'bottom 15%',
    ...triggerVars,
    onToggle(self) {
      if (self.isActive) video.play().catch(() => {});
      else video.pause();
    },
  });
}

/** Enchaîne plusieurs fichiers sur le même <video> : à la fin d'un clip,
 *  on passe au suivant, puis on reboucle. Lecture continue, jamais figée. */
export function chainerSources(video, suivantes = []) {
  if (!video || !suivantes.length) return;
  const sources = [video.src, ...suivantes];
  let index = 0;
  video.addEventListener('ended', () => {
    index = (index + 1) % sources.length;
    video.src = sources[index];
    video.play().catch(() => {});
  });
}

/** Mouvement réduit : on fige une image parlante. */
export function freezeFrame(video, atSeconds = 1.2) {
  if (!video) return;
  const fix = () => {
    try { video.currentTime = Math.min(atSeconds, (video.duration || atSeconds) - 0.05); } catch { /* noop */ }
  };
  if (video.readyState >= 1) fix();
  else video.addEventListener('loadedmetadata', fix, { once: true });
}

export { gsap, ScrollTrigger };
