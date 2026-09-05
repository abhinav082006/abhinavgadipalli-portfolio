/* =========================================================
   Glitter Wrap — replaces the earlier rising-ember effect.
   A starfield of small white dots warping outward from the
   center (classic "hyperspace tunnel"): each star has a depth
   (z) that shrinks every frame, so its screen position — star
   projected as (x/z, y/z) around the center — flies outward
   and grows as it approaches, then respawns near the center
   once it flies off-screen. Ported from the pasted component's
   spec/reference recording; kept plain white per request
   rather than the site's gold accent.

   Config mirrors the original component's props (particleCount /
   density / starSize / focalDepth / turbulence / brightness /
   glitterIntensity / trailAmount / reverse / speed / color1-3),
   tuned down slightly from the component's hero-scale defaults
   since this sits behind readable dial/panel text.
   ========================================================= */
(function () {
  "use strict";

  // .glitter-wrap-bg (not the more generic .particles-bg, which is also used
  // by the unrelated photo-particle effect on the Contact section) — each
  // matching container gets its own independent instance below.
  var containers = document.querySelectorAll(".glitter-wrap-bg");
  if (!containers.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CONFIG = {
    particleCount: 260,   // reference used up to 1000; this is a background layer, not the centerpiece
    density: 90,          // how far from center stars spawn (spread of the tunnel)
    starSize: 16,         // size of a star at its closest point
    focalDepth: 8,        // perspective strength — higher flings stars outward faster
    turbulence: 0,        // sinusoidal wobble, 0 = straight radial paths (matches the reference)
    brightness: 70,       // overall opacity %, dimmed since this sits behind text
    glitterIntensity: 3,  // frequency/strength of random sparkle flashes
    // NOTE: this canvas is meant to stay transparent, so trails are done by
    // painting a translucent black rect instead of clearing each frame —
    // that's cheap and looks right at low values, but never fully clears,
    // so it will gradually darken toward opaque black if left running for
    // a long time at higher values. Kept at 0 (matches the reference
    // recording, which shows crisp dots with no visible streaking).
    trailAmount: 0,
    reverse: false,       // false = outward (matches the reference), true = pulls inward
    speed: 4.5,           // how fast stars warp through the tunnel
    colors: ["#FFFFFF", "#FFFFFF", "#FFFFFF"] // plain white — "keep it white, it looks good"
  };

  // Each matching container (Experience, Projects, ...) gets its own fully
  // independent canvas/star-field/animation-loop instance, so they never
  // share state and one section being off-screen doesn't affect another.
  containers.forEach(function (container, instanceIndex) {
    initGlitterWrap(container, instanceIndex);
  });

  function initGlitterWrap(container, instanceIndex) {
  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  // tiny seeded PRNG (mulberry32) so the spawn layout is stable across
  // reloads — offset per instance so multiple sections don't spawn stars
  // in visually identical patterns
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260527 + instanceIndex * 104729);

  var dpr = 1, w = 0, h = 0, cx = 0, cy = 0, stars = [];
  var MAX_Z = 40; // depth a freshly-spawned star starts at (furthest away)
  var MIN_Z = 0.35; // depth at which a star is considered "arrived" and respawns

  function spawnStar(star, randomizeZ) {
    var densityPx = (CONFIG.density / 100) * Math.max(w, h) * 0.55;
    star.x = (rand() * 2 - 1) * densityPx;
    star.y = (rand() * 2 - 1) * densityPx;
    star.z = randomizeZ ? MIN_Z + rand() * (MAX_Z - MIN_Z) : MAX_Z;
    star.color = CONFIG.colors[(rand() * CONFIG.colors.length) | 0];
    star.wobblePhaseX = rand() * Math.PI * 2;
    star.wobblePhaseY = rand() * Math.PI * 2;
    star.px = null; star.py = null; // previous screen position, for trail streaks
  }

  function buildStars() {
    stars = [];
    for (var i = 0; i < CONFIG.particleCount; i++) {
      var star = {};
      spawnStar(star, true); // scattered depths so the field looks populated immediately
      stars.push(star);
    }
  }

  function resize() {
    var rect = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    cx = w / 2; cy = h / 2;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function step(dt, elapsed) {
    // trails: instead of a full clear, paint a translucent black rect so
    // previous frames fade out gradually rather than vanishing instantly
    if (CONFIG.trailAmount > 0) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0," + Math.max(0.08, 1 - CONFIG.trailAmount / 100) + ")";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.globalCompositeOperation = "lighter";

    var zSpeed = CONFIG.speed * (CONFIG.reverse ? -1 : 1);
    var brightnessMul = CONFIG.brightness / 100;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (!reduceMotion) s.z -= zSpeed * dt;

      // respawn once a star arrives (outward) or recedes out of range (inward)
      if (s.z <= MIN_Z || s.z > MAX_Z) { spawnStar(s, false); continue; }

      var depthT = 1 - s.z / MAX_Z; // 0 = just spawned/far, 1 = arrived/close
      var wobbleAmp = CONFIG.turbulence * depthT * 0.6;
      var wobX = wobbleAmp ? Math.sin(elapsed * 1.6 + s.wobblePhaseX) * wobbleAmp : 0;
      var wobY = wobbleAmp ? Math.cos(elapsed * 1.3 + s.wobblePhaseY) * wobbleAmp : 0;

      var sx = cx + ((s.x + wobX) / s.z) * CONFIG.focalDepth;
      var sy = cy + ((s.y + wobY) / s.z) * CONFIG.focalDepth;
      var size = Math.max(0.35, (CONFIG.starSize / 22) * depthT + 0.4);
      var alpha = Math.min(1, (0.35 + depthT * 0.75)) * brightnessMul;

      // occasional brighter sparkle flash — "glitter"
      var isGlitter = CONFIG.glitterIntensity > 0 && rand() < CONFIG.glitterIntensity * 0.0007;
      var drawSize = isGlitter ? size * 2.2 : size;
      var drawAlpha = isGlitter ? Math.min(1, alpha * 1.8) : alpha;

      ctx.fillStyle = s.color;
      ctx.globalAlpha = drawAlpha;

      // short motion streak from the previous position to this one
      if (CONFIG.trailAmount > 0 && s.px !== null) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = drawSize * 0.6;
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(sx, sy, drawSize, 0, Math.PI * 2);
      ctx.fill();

      if (isGlitter) {
        // small four-point sparkle cross for the flash
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(sx - drawSize * 2.4, sy); ctx.lineTo(sx + drawSize * 2.4, sy);
        ctx.moveTo(sx, sy - drawSize * 2.4); ctx.lineTo(sx, sy + drawSize * 2.4);
        ctx.stroke();
      }

      s.px = sx; s.py = sy;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  var lastTime = null, rafId = null, running = false, elapsed = 0;

  function frame(now) {
    if (!running) return;
    if (lastTime === null) lastTime = now;
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;
    step(dt, elapsed);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = null;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  resize();
  step(0, 0); // static warm-up frame — visible immediately, and permanent under reduced motion

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(container);
  } else {
    window.addEventListener("resize", resize);
  }

  // pause the loop while the section is off-screen — this is a background
  // flourish, not worth spending frames on when nobody can see it
  if (!reduceMotion) {
    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) start(); else stop();
          });
        },
        { threshold: 0.01 }
      ).observe(container);
    } else {
      start();
    }
  }
  } // end initGlitterWrap
})();