import { gsap } from '../lib/motion.js';

/**
 * Ident « le mot est la matière » : TEXTURE verrouillé plein cadre,
 * le montage vit dans les contreformes, puis plongée à travers le E
 * final vers la surface océan du site.
 *
 * Chemin nominal : le film rendu (public/video/texture-ident.mp4,
 * matières générées + typo masquée en compo). Secours : la timeline
 * DOM/GSAP ci-dessous (matières procédurales CSS), si la vidéo ne
 * peut pas démarrer à temps.
 *
 * Même contrat que playLoader : promesse résolue quand l'écran est
 * dégagé. Clic / Échap / « PASSER » : sortie immédiate.
 * Dev (secours DOM) : timeline exposée sur window.__identTl.
 */

const ABSTRAITES = ['m-nacre', 'm-ferro', 'm-encre'];
const ORGANIQUES = ['m-fleur', 'm-soie', 'm-grenat', 'm-fleur', 'm-soie', 'm-grenat', 'm-fleur'];
const COURSE = ['m-asphalte', 'm-peau', 'm-asphalte', 'm-asphalte', 'm-iris', 'm-peau', 'm-asphalte'];
const MATIERES = [
  'm-vide', 'm-eau', 'm-nacre', 'm-ferro', 'm-encre', 'm-fleur', 'm-soie',
  'm-grenat', 'm-asphalte', 'm-peau', 'm-iris', 'm-feu', 'm-mer',
];

function poseMatiere(lettre, matiere) {
  lettre.classList.remove(...MATIERES);
  lettre.classList.add(matiere);
}

export function playIdent({ skip = false } = {}) {
  const ident = document.getElementById('ident');
  const loader = document.getElementById('loader');

  if (!ident || skip) {
    loader?.classList.add('est-fini');
    ident?.classList.add('est-fini');
    return Promise.resolve();
  }

  // L'ident partage le z du loader mais est plus bas dans le DOM → il le
  // recouvre dès qu'il devient actif. On masque alors le loader SANS fondu :
  // aucune frame du hero (eau) n'apparaît entre l'amorce et la vidéo.
  ident.classList.add('est-actif');
  loader?.classList.add('est-fini');

  const video = document.getElementById('identVideo');
  const hud = ident.querySelector('.ident-hud');
  const passer = ident.querySelector('.ident-passer');

  const canvasDechirure = document.getElementById('identDechirure');

  return new Promise((resolve) => {
    let fini = false;
    let tl = null;
    let etireTl = null;
    let lisseur = null;
    let idleTimer = null;
    let dernierTouchY = null;

    // Démontage commun (timelines, écouteurs, WebGL de la déchirure). Séparé du
    // fondu de sortie pour dérouler la dissolution AVANT de couper l'overlay.
    const nettoyer = () => {
      tl?.kill();
      etireTl?.kill();
      lisseur?.kill();
      clearTimeout(idleTimer);
      video?.pause();
      if (rendu) gsap.ticker.remove(rendu);
      window.removeEventListener('resize', surResize);
      dechirure?.dispose();
      passer?.removeEventListener('click', terminer);
      window.removeEventListener('keydown', surTouche);
      window.removeEventListener('wheel', surScrollIntro);
      window.removeEventListener('touchmove', surScrollIntro);
      delete window.__identTl;
    };

    // Sortie de l'ident. Le hero (wordmark + UI) est DÉJÀ composé et visible
    // sous l'overlay opaque (la timeline maîtresse le laisse à opacité 1 au
    // scroll 0) : plus besoin de le « faire apparaître » après coup. On DISSOUT
    // simplement l'ident par-dessus — la déchirure montre déjà l'eau du hero (le
    // shader échantillonne #heroEau), donc seul le wordmark émerge, sans temps
    // mort ni fondu tardif. C'est le correctif du « bug de latence » : le logo
    // est prêt pendant que le papier brûle, révélé d'un fondu court.
    const terminer = () => {
      if (fini) return;
      fini = true;
      // Garantit l'état visible du hero sous l'overlay (efface tout résidu qui
      // l'aurait masqué) — aucune animation depuis l'invisible.
      gsap.set('#heroInner, #heroInner > *, #heroScroll', { clearProps: 'opacity,transform,filter' });
      gsap.to(ident, {
        opacity: 0, duration: 0.42, ease: 'power2.inOut',
        onComplete: () => {
          ident.classList.add('est-fini');
          gsap.set(ident, { clearProps: 'opacity' });
          nettoyer();
          resolve();
        },
      });
    };
    const surTouche = (e) => { if (e.key === 'Escape') terminer(); };
    // Skip volontaire : uniquement le bouton « PASSER → », pas un clic écran.
    passer?.addEventListener('click', terminer);
    window.addEventListener('keydown', surTouche);

    /* ---- Sortie au scroll : déchirure WebGL scrubbée ----
       L'écran se perce en plusieurs points depuis les bords, comme un papier
       qui brûle (bruit fbm + lisière de braise, scenes/dechirure.js), et
       révèle l'eau du hero derrière. Plus on scrolle, plus l'image de l'ident
       est consumée ; à 100 % c'est l'équivalent d'un skip : TEXTURE et l'UI
       reviennent en GSAP par-dessus l'eau. Le shader échantillonne DIRECTEMENT
       la vidéo #heroEau → aucun raccord à faire à la révélation. */
    const scrub = { cible: 0, courant: 0 };
    let dechirure = null;
    let rendu = null;
    const surResize = () => dechirure?.resize();

    // Pendant que le papier brûle, on prépare le hero DERRIÈRE la déchirure
    // (canvas opaque) : police du wordmark chargée + mise en page forcée, pour
    // que sa révélation à la fin de la combustion soit réellement instantanée
    // (aucun swap de police ni reflow tardif au moment du fondu de sortie).
    const prechaufferHero = () => {
      try { document.fonts?.load('900 10rem "Archivo"'); } catch { /* noop */ }
      const inner = document.getElementById('heroInner');
      const scroll = document.getElementById('heroScroll');
      void (inner && inner.offsetHeight); // lit → force le calcul de layout maintenant
      void (scroll && scroll.offsetHeight);
    };

    const construireEtire = async () => {
      ident.classList.add('est-etire');
      const eau = document.getElementById('heroEau');
      eau?.play().catch(() => {});
      prechaufferHero();
      try {
        const { createDechirure } = await import('../scenes/dechirure.js');
        dechirure = createDechirure({ canvas: canvasDechirure, videoA: video, videoB: eau });
        dechirure.resize();
        window.addEventListener('resize', surResize);
      } catch {
        terminer(); // pas de WebGL : on saute simplement au hero
        return;
      }
      etireTl = gsap.timeline({ paused: true, onComplete: terminer });
      etireTl.to({}, { duration: 1 }); // porteur de progression (scrub 0 → 1)
      rendu = () => dechirure.render(scrub.courant, gsap.ticker.deltaRatio() / 60);
      gsap.ticker.add(rendu);
    };

    const pousserVers = (cible, duree, ease) => {
      lisseur?.kill();
      lisseur = gsap.to(scrub, {
        courant: cible, duration: duree, ease,
        onUpdate: () => etireTl && etireTl.progress(scrub.courant),
      });
    };

    let etireLance = false;
    const surScrollIntro = (e) => {
      if (fini) return;
      let delta = 0;
      if (e.type === 'wheel') {
        delta = e.deltaY;
      } else {
        const y = e.touches?.[0]?.clientY;
        if (y != null) {
          delta = dernierTouchY == null ? 0 : dernierTouchY - y;
          dernierTouchY = y;
        }
      }
      if (!etireLance) {
        if (delta <= 0) return; // seul le scroll vers le bas déclenche
        etireLance = true;
        construireEtire();
      }
      // Remplissage volontairement lent : la déchirure se mérite au scroll,
      // et reste réversible (remonter referme les trous).
      scrub.cible = Math.min(1, Math.max(0, scrub.cible + delta / 2600));
      pousserVers(scrub.cible, 0.35, 'power2.out');
      // Passé la moitié, l'inertie finit le travail après une courte pause.
      clearTimeout(idleTimer);
      if (scrub.cible > 0.5) {
        idleTimer = setTimeout(() => { scrub.cible = 1; pousserVers(1, 0.8, 'power2.inOut'); }, 600);
      }
    };
    window.addEventListener('wheel', surScrollIntro, { passive: true });
    window.addEventListener('touchmove', surScrollIntro, { passive: true });

    /* ---- Chemin nominal : le film rendu ---- */
    const lanceVideo = () => new Promise((ok, ko) => {
      if (!video) { ko(new Error('pas de vidéo')); return; }
      const abandon = setTimeout(() => ko(new Error('démarrage trop lent')), 1600);
      video.addEventListener('error', () => { clearTimeout(abandon); ko(new Error('erreur vidéo')); }, { once: true });
      video.addEventListener('playing', () => { clearTimeout(abandon); ok(); }, { once: true });
      video.addEventListener('ended', terminer, { once: true }); // fin du film → même dissolution que la déchirure
      // Fichier préchargé (preload=auto, readyState 4) : on affiche la 1ère
      // frame immédiatement puis on lance la lecture — coupe directe sur
      // l'image, sans passage à vide sur le fond de l'ident.
      try { video.currentTime = 0; } catch { /* pas encore prêt : ignoré */ }
      ident.classList.add('est-video');
      video.play().catch((e) => { clearTimeout(abandon); ko(e); });
    });

    /* ---- Secours : timeline DOM (matières procédurales CSS) ---- */
    const lanceTimeline = () => {
      const goo = ident.querySelector('.ident-goo');
      const mot = ident.querySelector('.ident-mot');
      const lettres = [...ident.querySelectorAll('.ident-lettre')];
      const fondu = ident.querySelector('.ident-fondu');

      const drips = lettres.map(() => {
        const d = document.createElement('div');
        d.className = 'ident-drip';
        goo.appendChild(d);
        return d;
      });
      const placeDrips = () => {
        lettres.forEach((l, i) => {
          drips[i].style.left = `${l.offsetLeft + l.offsetWidth * (0.3 + Math.random() * 0.4)}px`;
        });
      };

      tl = gsap.timeline({ onComplete: terminer });
      window.__identTl = tl;

      /* BEAT 1 · EAU — l'eau monte dans les lettres */
      tl.from(hud, { opacity: 0, duration: 0.4 }, 0);
      tl.call(() => lettres.forEach((l) => poseMatiere(l, 'm-eau')), null, 0.12);
      tl.to(lettres, {
        '--niveau': '-8%', duration: 0.85, ease: 'power2.inOut', stagger: 0.055,
      }, 0.18);

      /* BEAT 2 · SLOT-MACHINE ABSTRAITE — mitraillette */
      for (let t = 1.2; t < 2.35; t += 0.085) {
        tl.call(() => {
          const l = lettres[(Math.random() * lettres.length) | 0];
          poseMatiere(l, ABSTRAITES[(Math.random() * ABSTRAITES.length) | 0]);
        }, null, t);
      }

      /* BEAT 3 · ORGANIQUE — la matière se calme */
      lettres.forEach((l, i) => {
        tl.call(() => poseMatiere(l, ORGANIQUES[i]), null, 2.4 + i * 0.07);
      });
      tl.to(mot, { scale: 1.03, duration: 0.9, ease: 'sine.inOut' }, 2.45)
        .to(mot, { scale: 1, duration: 0.5, ease: 'sine.inOut' }, 3.35);

      /* BEAT 4 · COURSE — asphalte, peau, l'iris dans le U */
      lettres.forEach((l, i) => {
        tl.call(() => poseMatiere(l, COURSE[i]), null, 3.42 + i * 0.03);
      });
      tl.to(mot, { skewX: -8, duration: 0.14, ease: 'power3.out' }, 3.45)
        .to(mot, { x: '+=6', duration: 0.05, yoyo: true, repeat: 7, ease: 'none' }, 3.5)
        .to(mot, { skewX: 0, x: 0, duration: 0.3, ease: 'power2.inOut' }, 4.1);

      /* BEAT 5 · FEU — tout brûle, les fûts coulent */
      tl.call(() => {
        lettres.forEach((l) => poseMatiere(l, 'm-feu'));
        placeDrips();
        goo.classList.add('est-goo');
      }, null, 4.42);
      tl.to(drips, {
        height: () => gsap.utils.random(60, 140),
        duration: 0.8, ease: 'power2.in', stagger: 0.05,
      }, 4.55);

      /* BEAT 6 · MER + PLONGÉE — on entre dans le E */
      tl.call(() => {
        lettres.forEach((l) => poseMatiere(l, 'm-mer'));
        goo.classList.remove('est-goo');
      }, null, 5.3);
      tl.to(drips, { height: 0, opacity: 0, duration: 0.25 }, 5.3);
      tl.add(() => {
        const e = lettres[lettres.length - 1];
        const cx = ((e.offsetLeft + e.offsetWidth * 0.46) / mot.offsetWidth) * 100;
        gsap.set(mot, { transformOrigin: `${cx}% 52%` });
      }, 5.55);
      tl.to(mot, { scale: 26, duration: 1.05, ease: 'power3.in' }, 5.65);
      tl.to(hud, { opacity: 0, duration: 0.3 }, 5.75);
      tl.to(fondu, { opacity: 1, duration: 0.55, ease: 'power2.in' }, 6.15);
      tl.to(ident, { opacity: 0, duration: 0.45, ease: 'power1.inOut' }, 6.7);
    };

    lanceVideo().catch(() => {
      if (fini) return;
      ident.classList.remove('est-video'); // la vidéo n'a pas démarré
      lanceTimeline();
    });
  });
}
