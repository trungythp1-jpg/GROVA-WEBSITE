# GROVA Website — GSAP animation conventions

Animation implementation references the official GSAP skills repository:
https://github.com/greensock/gsap-skills

Relevant skill topics:
- `gsap-core`: timelines, easing, stagger, responsive motion
- `gsap-scrolltrigger`: scroll-triggered section reveals
- `gsap-performance`: prefer transform/opacity and avoid expensive layout animation

## Current implementation
- GSAP and ScrollTrigger are loaded from a public CDN in `index.html`.
- `script.js` uses a short hero intro timeline, one-time reveal animations, a staggered card entrance, and a restrained desktop hover response.
- Animations are progressive enhancement: the page remains readable when the CDN is unavailable.
- Motion is disabled when the user has enabled `prefers-reduced-motion: reduce`.
- Keep mobile motion subtle and avoid scroll pinning or heavy parallax unless there is a clear UX reason.

## Editing rules
1. Keep the site in plain HTML/CSS/JS for GitHub Pages; do not introduce a build step just for animation.
2. Prefer opacity and transforms; avoid animating layout-heavy properties.
3. Use ScrollTrigger with `once: true` for entrance reveals.
4. Test menu behavior, iPad/mobile scrolling, and the page with JavaScript disabled.
5. Do not animate away essential content before GSAP loads.
