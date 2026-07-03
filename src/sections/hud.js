import { ScrollTrigger } from '../lib/motion.js';

const DUREE_FILM = 144; // un « film » de 2 min 24 — clin d'œil 24 i/s
const FPS = 24;

function formatTC(progress) {
  const totalFrames = Math.round(progress * DUREE_FILM * FPS);
  const f = totalFrames % FPS;
  const s = Math.floor(totalFrames / FPS) % 60;
  const m = Math.floor(totalFrames / (FPS * 60)) % 60;
  const h = Math.floor(totalFrames / (FPS * 3600));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function initHud() {
  const tcEl = document.getElementById('hudTimecode');
  const sceneEl = document.getElementById('hudScene');

  if (tcEl) {
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => { tcEl.textContent = formatTC(self.progress); },
    });
  }

  if (sceneEl) {
    document.querySelectorAll('[data-scene]').forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle(self) {
          if (self.isActive) sceneEl.textContent = section.dataset.scene;
        },
      });
    });
  }
}
