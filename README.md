# Gadipalli Abhinav — Portfolio

A single-page, Dune-inspired portfolio site built around six full-viewport
panels, each with its own generative background — a swirling WebGL vortex,
a shader black hole, a flythrough skill tunnel, a magnetic project
carousel, a rotating experience dial, and a starfield that runs underneath
all of it.

**Live site:** [abhinavgadipalli.vercel.app](https://abhinavgadipalli.vercel.app)

---

## Overview

The site is a single `index.html` with pinned, full-height sections
(`.section`) that the visitor scrolls through: **Hero → About → Skills →
Projects → Experience → Contact**. Every section pairs real, accessible
HTML content with an optional generative visual layer — canvases and
WebGL shaders that render on top, but never replace, a plain-HTML
fallback. If WebGL isn't available or the visitor has `prefers-reduced-motion`
set, the fallback is what's shown instead.

## Tech Stack

- **Plain HTML / CSS / vanilla JS** — no framework, no build step
- **Three.js** (r160, via CDN) — Skills tunnel flythrough
- **WebGL (raw, no library)** — Liquid Vortex shader (Hero + Contact) and
  the About section's black hole shader
- **Canvas 2D** — Glitter Wrap starfield, ASCII-photo hero effect
- **GSAP 3 + ScrollTrigger + SplitText** (via CDN) — scroll-reveal and
  split-text line animations
- **Google Fonts** — Fraunces (display/serif) and Inter (body/UI)
- **Font Awesome 6** (via CDN) — icons throughout
- Deployed on **Vercel**

## Section-by-section

### Hero
Full-bleed **Liquid Vortex** shader tornado behind a framed portrait that
renders as a live ASCII-art effect on a canvas, with a Glitter Wrap
starfield layered behind the vortex so stars show through its gaps. Badge,
name, role line, description, and two CTAs (View Projects / Download
Resume) sit on top, animated in on load.

### About
A bounded **black hole** shader (WebGL) rendered in a frame on the right,
with a Glitter Wrap starfield as the base layer behind it, an ambient
glow, and a scrim gradient to keep the copy on the left legible. Includes
an education card (B.Tech CSE, IIIT Kottayam, 2024–2028).

### Skills
A full-bleed **Three.js flythrough tunnel** — category labels (Languages,
Web Technologies, Interests, Tools & Platforms) render as objects that fly
toward the camera and fade past, with jump-chips to skip straight to a
category and a hint to hold for speed. Falls back to a static, accessible
tag grid (`#skills-fallback`) under reduced motion or without WebGL.

### Projects
A **magnetic dock-style carousel** (`proj-carousel`) — project "bars"
magnify as the cursor nears and expand into a modal on click — built by JS
from a plain accessible list (`#projects-fallback`), which stays the
source of truth for each project's title, description, tags, and links so
they can never drift out of sync. Featured: **Trackezz**, **QR Studio**,
**CapDetector**, **FunPetals**.

### Experience
A **rotating dial** (semicircle bleeding off the left edge, numbered by
month/year like a clock face) that advances as you scroll, showing
B.Tech coursework and the InAmigos Foundation web development internship.
Falls back to a plain vertical timeline (`#timeline-fallback`).

### Contact
The same **Liquid Vortex** shader as the Hero, full-bleed and shifted
toward the right via the shader's own offset uniform (no clipping
container), with the Glitter Wrap starfield behind it. Social links
(Email, LinkedIn, GitHub, Phone) and the "Send a Message" CTA use a glass
treatment — transparent fill, light border, backdrop blur — matching the
Hero's Download Resume button. A dark, blurred glass footer closes out
the page.

## Custom touches

- **Astronaut-themed cursor set** (`astronaut-cursor.cur` /
  `astronaut-pointer.cur`) used site-wide via `cursor: url(...)`, with a
  system-cursor fallback if the files fail to load
- **Scroll-snap panels** with a dark page background (matching the
  section backgrounds) so panel transitions don't flash light
- **Accessibility-first fallbacks**: every generative visual (tunnel,
  carousel, dial, vortex, black hole) has a plain, fully-navigable HTML
  equivalent that's what actually holds the real content — the visual
  layer is decoration on top, not a replacement

## File structure

```
index.html                 — page structure & content (single source of truth)
style.css                  — all styling, palette, layout, responsive rules
script.js                  — nav, scroll-reveal, GSAP SplitText wiring
vortex.js                  — Liquid Vortex WebGL shader (legacy hero-only version)
liquid-vortex.js           — Liquid Vortex component, self-inits on .liquid-vortex-bg
blackhole.js               — About section's black hole WebGL shader
tunnel.js                  — Skills section Three.js flythrough tunnel
projects-carousel.js       — Projects magnetic dock carousel + modal
experience-dial.js         — Experience rotating dial
GlitterWrap.js             — starfield background, self-inits on .glitter-wrap-bg
astronaut-cursor.cur       — default cursor artwork
astronaut-pointer.cur      — pointer/hover cursor artwork
myphoto.png                — hero portrait source image
resume.pdf                 — downloadable resume
```

## Running locally

No build step — just serve the folder statically:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:<port>` in a browser.

## Deployment

Deployed as a static site on **Vercel** — push to the connected repo and
Vercel builds/publishes automatically; no framework config needed since
there's no build step.

## Credits

- Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces) &
  [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- Icons: [Font Awesome 6](https://fontawesome.com/)
- Animation: [GSAP](https://gsap.com/) (ScrollTrigger, SplitText)
- 3D: [Three.js](https://threejs.org/)

---

Designed & built by **Gadipalli Abhinav** · 2026
