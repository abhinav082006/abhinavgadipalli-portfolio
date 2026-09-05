// ---------- Scroll reveal ----------
const obs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 90);
      obs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ---------- Nav scrolled shadow ----------
const nav = document.getElementById('nav');
const links = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

function setActiveNav(id) {
  links.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + id);
  });
  // hero, about, skills, projects, experience + contact have dark backgrounds — swap the nav to match
  nav.classList.toggle('nav-dark', id === 'hero' || id === 'about' || id === 'skills' || id === 'projects' || id === 'experience' || id === 'contact');
}

// ---------- ASCII Reveal (ported from Originkit's React component) ----------
// Renders the hero photo as ASCII art; hovering reveals the real photo
// through a soft, trailing circular "torch" that follows the pointer.
(function initAsciiReveal() {
  const canvas = document.getElementById('ascii-canvas');
  const img = document.getElementById('hero-photo');
  if (!canvas || !img) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ---- options (tuned for the ~200x250 frame) ----
  const fit = 'cover';
  const focusY = 50;
  const columns = 58;          // denser — was 38, now the photo isn't visible underneath so the ASCII carries the whole image
  const ramp = ' .:-=+*#%@';
  const invert = false;
  const contrast = 100;
  const inkColor = '#E8C9A0';  // warm caramel, matching the tornado's palette (was dark ink on the old light card)
  const revealSize = 28;       // scaled down from 34
  const revealSoftness = 8;

  const contrastAt = (value) => 0.5 + (value / 100) * 2;
  const clampFocus = (value) => Math.min(100, Math.max(0, value));

  function placeRect(imgW, imgH, boxW, boxH) {
    const scale = fit === 'contain'
      ? Math.min(boxW / imgW, boxH / imgH)
      : Math.max(boxW / imgW, boxH / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const f = fit === 'cover' ? clampFocus(focusY) / 100 : 0.5;
    return { dx: (boxW - dw) / 2, dy: (boxH - dh) * f, dw, dh };
  }

  const punch = contrastAt(contrast);
  let off = null;
  let sampler = null;
  const revealLayer = document.createElement('canvas');
  const maskLayer = document.createElement('canvas');
  let coverRect = { dx: 0, dy: 0, dw: 0, dh: 0 };
  let raf = 0;
  let alive = true;

  const BLOB_COUNT = 5;
  let blobs = Array.from({ length: BLOB_COUNT }, () => ({ x: 0, y: 0 }));
  let seeded = false;
  const pointer = { x: -9999, y: -9999, inside: false };

  function getSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 200;
    const h = canvas.clientHeight || 250;
    return { w, h, dpr };
  }

  function buildAscii() {
    if (!img.naturalWidth) return;
    const { w, h, dpr } = getSize();
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));

    const cols = Math.max(8, Math.round(columns));
    const cellW = (w * dpr) / cols;
    const fontPx = cellW * 1.7;
    const cellH = fontPx;
    const rows = Math.max(1, Math.floor((h * dpr) / cellH));

    if (!sampler) sampler = document.createElement('canvas');
    sampler.width = cols;
    sampler.height = rows;
    const sctx = sampler.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;

    const place = placeRect(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height);
    sctx.clearRect(0, 0, cols, rows);
    sctx.drawImage(img, place.dx / cellW, place.dy / cellH, place.dw / cellW, place.dh / cellH);

    let data;
    try {
      data = sctx.getImageData(0, 0, cols, rows).data;
    } catch (e) {
      return;
    }

    if (!off) off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, off.width, off.height);
    octx.font = 'bold ' + fontPx.toFixed(2) + 'px ui-monospace, monospace';
    octx.textBaseline = 'top';
    octx.fillStyle = inkColor;

    const last = ramp.length - 1;
    const ALPHA_THRESHOLD = 64; // pixels more transparent than this always render as empty
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const aa = data[i + 3];
        if (aa < ALPHA_THRESHOLD) continue; // transparent — skip regardless of RGB
        const rr = data[i], gg = data[i + 1], bb = data[i + 2];
        let lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255;
        lum = (lum - 0.5) * punch + 0.5;
        if (invert) lum = 1 - lum;
        lum = lum < 0 ? 0 : lum > 1 ? 1 : lum;
        const ch = ramp[Math.round(lum * last)];
        if (ch === ' ') continue;
        octx.fillText(ch, c * cellW, r * cellH);
      }
    }

    coverRect = place;
  }

  function ensureLayer(layer) {
    if (layer.width !== canvas.width || layer.height !== canvas.height) {
      layer.width = canvas.width;
      layer.height = canvas.height;
    }
    return layer;
  }

  function updateBlobs() {
    const { dpr } = getSize();
    const tx = pointer.x * dpr;
    const ty = pointer.y * dpr;
    if (!seeded) {
      blobs.forEach(b => { b.x = tx; b.y = ty; });
      seeded = true;
      return;
    }
    blobs[0].x += (tx - blobs[0].x) * 0.35;
    blobs[0].y += (ty - blobs[0].y) * 0.35;
    for (let i = 1; i < blobs.length; i++) {
      blobs[i].x += (blobs[i - 1].x - blobs[i].x) * 0.35;
      blobs[i].y += (blobs[i - 1].y - blobs[i].y) * 0.35;
    }
  }

  function paint() {
    if (!off) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0);

    if (!pointer.inside) return;

    const { dpr } = getSize();
    const photo = ensureLayer(revealLayer);
    const pctx = photo.getContext('2d');
    const mask = ensureLayer(maskLayer);
    const mctx = mask.getContext('2d');
    if (!pctx || !mctx) return;

    pctx.globalCompositeOperation = 'source-over';
    pctx.clearRect(0, 0, photo.width, photo.height);
    pctx.drawImage(img, coverRect.dx, coverRect.dy, coverRect.dw, coverRect.dh);

    mctx.clearRect(0, 0, mask.width, mask.height);
    mctx.save();
    mctx.filter = `blur(${(revealSoftness * dpr).toFixed(1)}px)`;
    mctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < blobs.length; i++) {
      const t = blobs.length <= 1 ? 0 : i / (blobs.length - 1);
      const radius = revealSize * dpr * (1 - t * 0.5);
      mctx.beginPath();
      mctx.arc(blobs[i].x, blobs[i].y, radius, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.restore();

    pctx.globalCompositeOperation = 'destination-in';
    pctx.drawImage(mask, 0, 0);
    pctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(photo, 0, 0);
  }

  function loop() {
    if (!alive) return;
    updateBlobs();
    paint();
    raf = requestAnimationFrame(loop);
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointer.x = x;
    pointer.y = y;
    pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  }
  function onLeave() {
    pointer.inside = false;
    seeded = false;
  }

  function start() {
    buildAscii();
    paint();
    raf = requestAnimationFrame(loop);
  }

  if (img.complete && img.naturalWidth) {
    start();
  } else {
    img.addEventListener('load', start, { once: true });
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { buildAscii(); paint(); }).observe(canvas);
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
})();

// ---------- 3D tilt on pointer move (buttons + hero photo) ----------
if (typeof gsap !== 'undefined') {
  const tiltTargets = document.querySelectorAll('.btn, .proj-link, .nav-resume, .hero-frame');

  tiltTargets.forEach(el => {
    const isPhoto = el.classList.contains('hero-frame');
    const maxTilt = isPhoto ? 14 : 10;
    const lift = isPhoto ? -6 : -3;
    const baseZ = isPhoto ? 2.5 : 0; // preserves the photo's existing signature tilt at rest

    gsap.set(el, { transformPerspective: 600, rotationZ: baseZ });

    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3' });
    const ty = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    const rz = isPhoto ? gsap.quickTo(el, 'rotationZ', { duration: 0.5, ease: 'power3' }) : null;

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      rx(gsap.utils.interpolate(maxTilt, -maxTilt, py));
      ry(gsap.utils.interpolate(-maxTilt, maxTilt, px));
      ty(lift);
      if (rz) rz(0); // straightens on hover, same as the old CSS :hover behavior
    });

    el.addEventListener('pointerleave', () => {
      rx(0); ry(0); ty(0);
      if (rz) rz(baseZ);
    });
  });
}

// ---------- Pinned panels with overscroll ----------
// Wait for full page load AND web fonts, THEN wait two animation frames —
// 'load'/fonts.ready firing doesn't guarantee the browser has actually run
// a layout pass yet, which is why offsetHeight/clientHeight were measuring
// as 0 even though the CSS itself was correct.
Promise.all([
  new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  }),
  document.fonts ? document.fonts.ready : Promise.resolve()
]).then(() => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
})).then(() => {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const allSections = gsap.utils.toArray('.section');

  // Nav active-link highlighting — driven by ScrollTrigger itself (accounts
  // for pinning correctly), instead of the old offsetTop math which broke
  // once panels started using custom pin/margin logic.
  allSections.forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      onToggle: self => { if (self.isActive) setActiveNav(section.id); }
    });
  });

  const panels = allSections.slice();
  panels.pop(); // last panel (Contact) is excluded entirely — see CSS: it flows naturally instead of being pinned

  panels.forEach((panel) => {
    const innerpanel = panel.querySelector('.section-inner');

    // The Experience panel doesn't fake-scroll its content up like the
    // others — its head (title) stays completely still, and the pinned
    // scroll distance instead steps the rotating dial through each
    // entry. Once the dial has stepped through everything, this same
    // ScrollTrigger flows straight into the normal scale/fade exit
    // below, so the section releases and the page moves on.
    const dialArc = panel.querySelector('#exp-dial');
    if (dialArc) {
      const stepCount = Math.max(1, document.querySelectorAll('#timeline-fallback .tl-item').length - 1);
      const windowHeight = panel.clientHeight;
      // scroll distance dedicated to stepping through the dial —
      // per-step distance is a fraction of a viewport, so it reads as
      // deliberate scroll-driven steps rather than a huge dead zone
      const dialScrollDistance = stepCount * windowHeight * 0.55;
      // the pin's total scroll range must also reserve one normal
      // viewport-worth of scroll for the scale/fade exit tween below —
      // omitting it here was the bug: the exit tween got squeezed into
      // (and started firing during) the tail of the dial-stepping phase,
      // which read as the section already moving before the dial was done
      const dialRatio = dialScrollDistance / (dialScrollDistance + windowHeight);

      // Reserve that extra distance as real, scrollable document height.
      // With pinSpacing:false nothing does this automatically — the other
      // panels only get away without it when fakeScrollRatio is 0, because
      // a plain 100vh section already naturally consumes exactly one
      // viewport-height of scroll on its own. Any *extra* pin duration
      // beyond that (like dialScrollDistance here) has to be added as
      // margin-bottom or there's nowhere for that scroll to "land" —
      // which is why the next section was sliding over the top on its own
      // natural schedule regardless of whether the dial had finished.
      panel.style.marginBottom = dialScrollDistance + 'px';

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: panel,
          start: 'bottom bottom',
          end: () => `+=${dialScrollDistance + windowHeight}`,
          pin: true,
          pinSpacing: false,
          scrub: 1
        }
      });

      const dialState = { step: 0 };
      tl.to(dialState, {
        step: stepCount,
        duration: 1 / (1 - dialRatio) - 1,
        ease: 'none',
        onUpdate: () => {
          if (window.ExpDial) window.ExpDial.goToIndex(Math.round(dialState.step));
        }
      });

      tl.fromTo(panel, { scale: 1, opacity: 1 }, { scale: 0.7, opacity: 0.5, duration: 0.9 })
        .to(panel, { opacity: 0, duration: 0.1 });

      return;
    }

    // small safety buffer so a slightly-taller-than-measured panel
    // (e.g. from font metric rounding) still gets fully fake-scrolled
    const panelHeight = innerpanel.offsetHeight + 48;
    // use the panel's own clipped height (100vh - nav height), not the raw
    // window height — otherwise overflow gets under-detected by ~nav-height
    // and tall sections skip straight to the fade-out with no fake-scroll
    const windowHeight = panel.clientHeight;
    const difference = panelHeight - windowHeight;

    // portion of the scroll distance used for "fake scrolling" through
    // content taller than one viewport, before the scale/fade transition starts
    const fakeScrollRatio = difference > 0 ? (difference / (difference + windowHeight)) : 0;

    if (fakeScrollRatio) {
      panel.style.marginBottom = panelHeight * fakeScrollRatio + 'px';
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: panel,
        start: 'bottom bottom',
        end: () => fakeScrollRatio ? `+=${innerpanel.offsetHeight + 48}` : 'bottom top',
        pin: true,
        pinSpacing: false,
        scrub: 1 // smoothed/lagged instead of 1:1 with raw scroll — less "twitchy"
      }
    });

    if (fakeScrollRatio) {
      tl.to(innerpanel, {
        yPercent: -100,
        y: windowHeight,
        duration: 1 / (1 - fakeScrollRatio) - 1,
        ease: 'none'
      });
    }

    tl.fromTo(panel, { scale: 1, opacity: 1 }, { scale: 0.7, opacity: 0.5, duration: 0.9 })
      .to(panel, { opacity: 0, duration: 0.1 });
  });

  // ---------- Split-text line reveal (autoSplit) ----------
  // Runs after the pin/margin setup above so trigger positions are
  // calculated against the final, settled document layout.
  if (typeof SplitText !== 'undefined') {
    gsap.registerPlugin(SplitText);
    gsap.set('.split', { opacity: 1 });

    document.querySelectorAll('.split').forEach(text => {
      SplitText.create(text, {
        type: 'words,lines',
        mask: 'lines',
        linesClass: 'line',
        autoSplit: true,
        onSplit: (instance) => {
          return gsap.from(instance.lines, {
            yPercent: 120,
            stagger: 0.1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: text,
              start: 'top 85%',
              toggleActions: 'play none none reverse' // play on enter, undo on scroll back past it — replays correctly on repeat visits, unlike scrub inside a pinned/transformed parent
            }
          });
        }
      });
    });
  } else {
    // SplitText failed to load (e.g. offline) — don't leave text invisible
    gsap.set('.split', { opacity: 1 });
  }

  ScrollTrigger.refresh();
});
