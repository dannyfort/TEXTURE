import { gsap, EASE, prefersReducedMotion, isDesktop } from '../lib/motion.js';

const RAYON_BOBINE = 26;

/** Section épinglée : les cards-photogrammes défilent horizontalement avec le
 *  scroll, la bobine tourne en cadence et le fil de pellicule se déroule. */
export function initMethode() {
  // la tête de section glisse en place avec le scroll
  gsap.fromTo('.methode-tete', { opacity: 0, y: 40 }, {
    opacity: 1,
    y: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.methode-tete', start: 'top 92%', end: 'top 55%', scrub: 0.5 },
  });

  if (prefersReducedMotion || !isDesktop) {
    initEtapesVerticales();
    return;
  }

  const liste = document.querySelector('.methode-liste');
  const defile = document.querySelector('.methode-defile');
  const etapes = gsap.utils.toArray('.etape');

  // x qui amène la card i au centre du cadre de défilement
  const centreSur = (etape) =>
    defile.offsetWidth / 2 - (etape.offsetLeft + etape.offsetWidth / 2);
  const course = () => centreSur(etapes[0]) - centreSur(etapes[etapes.length - 1]);

  // état de départ : la première card en pleine lumière, les autres en retrait
  gsap.set(liste, { x: () => centreSur(etapes[0]) });
  gsap.set(etapes[0], { scale: 1.04, transformOrigin: 'center center' });
  gsap.set(etapes.slice(1), { scale: 0.86, opacity: 0.22, transformOrigin: 'center center' });

  const defilement = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.methode',
      start: 'top top',
      // un écran de scroll par card : chaque étape a son moment
      end: () => `+=${etapes.length * window.innerHeight * 0.8}`,
      pin: true,
      scrub: 0.6,
      snap: { snapTo: 1 / (etapes.length - 1), duration: 0.35, ease: EASE.cinema },
      invalidateOnRefresh: true,
    },
  });

  // chaque segment : la bande glisse, la card sortante s'éteint, l'entrante s'allume
  etapes.slice(1).forEach((etape, i) => {
    defilement
      .to(liste, { x: () => centreSur(etape), duration: 1 })
      .to(etapes[i], { scale: 0.86, opacity: 0.22, duration: 1 }, '<')
      .to(etape, { scale: 1.04, opacity: 1, duration: 1 }, '<');
  });

  // la bobine tourne et le fil se déroule sur toute la traversée
  defilement
    .to('.methode-bobine', {
      rotation: () => (course() / (2 * Math.PI * RAYON_BOBINE)) * 360,
      transformOrigin: 'center center',
      duration: defilement.duration(),
    }, 0)
    .to('.methode-pellicule-fill', { scaleX: 1, duration: defilement.duration() }, 0);

  // ponctuation par card : l'illustration se dessine, le jalon clignote —
  // quand la card entre dans le cadre du défilement horizontal
  etapes.forEach((etape) => {
    animeVisuel(etape, {
      trigger: etape,
      containerAnimation: defilement,
      start: 'left 70%',
      toggleActions: 'play none none reverse',
    });

    const jalon = etape.querySelector('.etape-jalon');
    if (jalon) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: etape,
          containerAnimation: defilement,
          start: 'left 65%',
          toggleActions: 'play none none reverse',
        },
      });
      tl.fromTo(jalon, { opacity: 0 }, {
        opacity: 1, duration: 0.18, repeat: 3, yoyo: true, ease: EASE.sortie,
      }).set(jalon, { opacity: 1 });
    }
  });
}

/** Repli mobile / reduced-motion : révélation verticale simple, réversible. */
function initEtapesVerticales() {
  gsap.utils.toArray('.etape').forEach((etape, i) => {
    gsap.fromTo(etape, { opacity: 0, y: 56 }, {
      opacity: 1,
      y: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: etape,
        start: `top ${94 - i * 2}%`,
        end: `top ${56 - i * 2}%`,
        scrub: 0.5,
      },
    });

    animeVisuel(etape, {
      trigger: etape,
      start: 'top 60%',
      toggleActions: 'play none none reverse',
    });
  });
}

/** L'illustration de l'étape se dessine trait par trait ; sur S.04 le bras
 *  du clap claque en plus. */
function animeVisuel(etape, scrollTrigger) {
  const traits = etape.querySelectorAll('.etape-visuel path, .etape-visuel rect, .etape-visuel circle');
  if (!traits.length) return;

  const tl = gsap.timeline({ scrollTrigger });
  tl.fromTo(traits, { drawSVG: 0 }, {
    drawSVG: '100%',
    duration: 0.9,
    ease: EASE.sortie,
    stagger: 0.025,
  });

  const bras = etape.querySelector('.etape-clap-bras');
  if (bras) {
    tl.fromTo(bras, { rotation: -18 }, { rotation: 0, duration: 0.45, ease: 'back.out(2.5)' }, 0.4);
  }
}
