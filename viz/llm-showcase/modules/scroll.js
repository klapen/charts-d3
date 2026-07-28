// GSAP ScrollTrigger helpers: enter-once chart builds, [data-reveal] headline
// reveals, and the fixed progress rail. Honors prefers-reduced-motion by
// rendering everything in its final state immediately.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Run fn once when el enters the viewport (or immediately under reduced motion).
export function onEnter(el, fn) {
  if (REDUCED) { fn(); return; }
  ScrollTrigger.create({ trigger: el, start: 'top 65%', once: true, onEnter: fn });
}

export function initScrollUi() {
  if (!REDUCED) {
    document.querySelectorAll('[data-reveal]').forEach(el => {
      gsap.fromTo(el, { y: 28, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 80%', once: true },
      });
    });
  }

  const rail = document.getElementById('rail');
  document.querySelectorAll('[id^="section-"]').forEach(sec => {
    const dot = document.createElement('button');
    dot.className = 'rail-dot';
    dot.setAttribute('aria-label', `Go to ${sec.id.replace('section-', '')}`);
    dot.addEventListener('click', () =>
      sec.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }));
    rail.appendChild(dot);
    if (!REDUCED) {
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: self => dot.classList.toggle('on', self.isActive),
      });
    }
  });

  // Trigger offsets are computed synchronously here, but the Three.js canvas
  // sizes itself post-mount and the web font settles later — both shift layout
  // height. Recompute once everything has loaded so triggers stay aligned.
  if (!REDUCED) window.addEventListener('load', () => ScrollTrigger.refresh());
}
