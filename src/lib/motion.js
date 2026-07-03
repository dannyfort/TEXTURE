import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin);

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isDesktop = window.matchMedia('(min-width: 760px)').matches;

export const EASE = {
  sortie: 'expo.out',
  cinema: 'power3.inOut',
};

/** Découpe un élément en mots accessibles (aria conservé sur le parent). */
export function splitWords(el) {
  el.setAttribute('aria-label', el.textContent.trim());
  const split = new SplitText(el, { type: 'words', wordsClass: 'mot' });
  split.words.forEach((w) => w.setAttribute('aria-hidden', 'true'));
  return split.words;
}

export { gsap, ScrollTrigger, ScrollSmoother, SplitText };
