/**
 * Câblage scroll ↔ 3D. ScrollTrigger pilote, les scènes obéissent.
 *
 * Le fond « Océan → Galaxie » (galaxie.js) est enregistré EN PREMIER : il peint
 * l'arrière-plan (couleur de clear + brouillard) et reste actif toute la page.
 * Par-dessus, deux scènes préservées à l'identique s'activent sur leur section :
 *  · reel-lumiere.js — les écrans-vidéo flottants de LA BOBINE ;
 *  · cadres.js       — le storyboard flottant de LA MÉTHODE.
 */
import { ScrollTrigger } from '../lib/motion.js';
import { REEL_PAS } from '../sections/reel.js';
import { createStage } from './stage.js';
import { createGalaxie } from './galaxie.js';
import { createReelLumiere } from './reel-lumiere.js';
import { createCadres } from './cadres.js';

export function initScenes({ canvas, reelTween, isDesktop }) {
  const stage = createStage(canvas);

  const lier = (entry, vars) => {
    stage.register(entry);
    ScrollTrigger.create({
      ...vars,
      onToggle: (self) => entry.setActive(self.isActive),
      onUpdate: (self) => entry.setProgress?.(self.progress),
    });
    return entry;
  };

  // 00 · LE FOND : océan → plongée → sous l'eau → galaxie. Toujours actif,
  // il possède sa propre timeline maîtresse scrubée (surface → sortie) et le
  // travelling avant dans la galaxie. Enregistré avant tout : le reste se
  // dessine par-dessus (clearDepth du plateau).
  stage.register(createGalaxie({ renderer: stage.renderer, isDesktop }));

  // 02 · LA BOBINE — écrans-vidéo suspendus, travelling scrubé. PRÉSERVÉ.
  // (le DOM cache les <video>, la scène en fait des textures d'écrans 3D)
  if (isDesktop && reelTween) {
    const videos = Array.from(document.querySelectorAll('.cadre-video'));
    if (videos.length) {
      const salle = stage.register(createReelLumiere(videos));
      // 'bottom top' ignorerait le spacer du pin → on couvre explicitement
      // entrée + durée du travelling (REEL_PAS partagé avec reel.js) + sortie.
      ScrollTrigger.create({
        trigger: '.reel',
        start: 'top bottom',
        end: () => `+=${(videos.length + 1) * window.innerHeight * REEL_PAS + window.innerHeight * 2}`,
        invalidateOnRefresh: true,
        onToggle: (self) => salle.setActive(self.isActive),
        // la progression vient du travelling lui-même (pin + scrub existants)
        onUpdate: () => salle.setProgress(reelTween.scrollTrigger?.progress ?? 0),
      });
    }
  }

  // 03 · LA MÉTHODE — storyboard filaire dérivant en profondeur. PRÉSERVÉ.
  lier(createCadres(), {
    trigger: '.methode',
    start: 'top bottom',
    end: 'bottom top',
  });

  return stage;
}
