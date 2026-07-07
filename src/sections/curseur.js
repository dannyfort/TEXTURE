import { gsap } from '../lib/motion.js';

/**
 * Curseur lumière — sur tout le site.
 *
 * La souris devient un point de lumière (cœur vif + halo très subtil),
 * même vocabulaire que le spéculaire du bump du logo : le visiteur PORTE
 * la lumière qui révèle les matières. Le curseur natif est masqué.
 *
 * Le point suit le pointeur instantanément (précision), le halo traîne
 * d'une courte inertie (vie). Desktop pointer fine uniquement.
 */
export function initCurseur() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.documentElement.classList.add('a-curseur-lumiere');

  const racine = document.createElement('div');
  racine.className = 'curseur-lumiere';
  racine.setAttribute('aria-hidden', 'true');
  racine.innerHTML = '<span class="curseur-halo"></span><span class="curseur-point"></span>';
  document.body.appendChild(racine);

  const point = racine.querySelector('.curseur-point');
  const halo = racine.querySelector('.curseur-halo');

  const cible = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const traine = { x: cible.x, y: cible.y };

  window.addEventListener('pointermove', (e) => {
    cible.x = e.clientX;
    cible.y = e.clientY;
    point.style.transform = `translate3d(${cible.x}px, ${cible.y}px, 0)`;
    racine.classList.add('est-visible');
  }, { passive: true });

  // La lumière s'éteint quand le pointeur quitte la fenêtre.
  document.documentElement.addEventListener('mouseleave', () => {
    racine.classList.remove('est-visible');
  });
  document.documentElement.addEventListener('mouseenter', () => {
    racine.classList.add('est-visible');
  });

  // Halo : courte inertie derrière le point.
  gsap.ticker.add(() => {
    const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);
    const suivi = 1 - Math.exp(-18 * dt);
    traine.x += (cible.x - traine.x) * suivi;
    traine.y += (cible.y - traine.y) * suivi;
    halo.style.transform = `translate3d(${traine.x}px, ${traine.y}px, 0)`;
  });
}
