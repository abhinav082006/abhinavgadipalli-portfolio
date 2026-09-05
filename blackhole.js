/* =========================================================
   Black Hole — ported from Originkit's React/Framer component
   (BlackHole.tsx) to plain canvas 2D, no React/Framer runtime.

   Same physics as the original: particles orbit a central "void"
   on a tilted disk, speeding up near the core (v ~ 1/sqrt(r)),
   sorted front-to-back each frame for real 3D occlusion behind
   the event horizon, drawn onto two stacked canvases (background
   particles / the void sphere / foreground particles) with a
   destination-out fade pass for the comet-trail look.

   Themed for this site: the reference used a white/rainbow-ish
   particle mix on pure black. Retinted here to the same warm
   espresso/caramel/amber palette already used by the hero tornado
   (Vortex.js) — #F2A65A, #E8C9A0, #D3A376, #C9915B, #B98356 — so
   the About panel's disk reads as part of the same site, not a
   dropped-in reference screenshot.
   ========================================================= */
(function () {
  const container = document.getElementById('about-blackhole');
  if (!container) return;

  const canvas = document.createElement('canvas');
  const fgCanvas = document.createElement('canvas');
  fgCanvas.style.pointerEvents = 'none';
  container.appendChild(canvas);
  container.appendChild(fgCanvas);

  const ctx = canvas.getContext('2d');
  const fgCtx = fgCanvas.getContext('2d');
  if (!ctx || !fgCtx) return;

  const reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  /* ============================================================ theme config */
  const PERSPECTIVE = 1300;
  const cfg = {
    voidColor: '#0B0705',      // matches the section-2 backdrop — the core reads as a true void
    colors: ['#F2A65A', '#E8C9A0', '#D3A376', '#C9915B', '#B98356'],
    outerRadiusPct: 92,        // % of the size basis the disk's outer edge reaches — fills the box without spilling past it
    tilt: 24,                  // degrees — inclination of the disk
    tiltSideway: 158,          // degrees — roll, gives the elliptical "viewed at an angle" look
    orbitSpeed: 4,
    pullSpeed: 0.6,            // slow inward drift so the disk feels like it's actively feeding the core
    trailAlpha: 0.045,         // low = long glowing comet trails
    particleSize: 1.1,         // fine dust, not chunky dots
    // container (.about-blackhole) is a bounded box positioned entirely by
    // CSS per breakpoint, so the void just sits centered-ish within it —
    // no separate mobile math needed here
    voidXPct: 50,
    voidYPct: 48,
  };

  /* ============================================================ state */
  let w = 1, h = 1, dpr = 1;
  let voidRadius = 40, outerRad = 200, voidCx = 0, voidCy = 0;
  let particles = [];
  let raf = 0;

  function particleCountFor(width, height) {
    const area = width * height;
    // fine dust: more, smaller particles per unit area than a chunky look would use
    return Math.max(360, Math.min(1600, Math.round(area / 480)));
  }

  function initParticles(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const radius = voidRadius + Math.pow(Math.random(), 2) * (outerRad - voidRadius);
      pts.push({
        angle: Math.random() * Math.PI * 2,
        radius,
        height: (Math.random() - 0.5) * 16,
        speedOffset: 0.75 + Math.random() * 0.5,
        colorIdx: Math.floor(Math.random() * cfg.colors.length),
      });
    }
    particles = pts;
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }

  function layout() {
    const rect = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    fgCanvas.width = w * dpr;
    fgCanvas.height = h * dpr;
    fgCanvas.style.width = w + 'px';
    fgCanvas.style.height = h + 'px';

    const sizeBasis = Math.min(w, h);
    voidRadius = Math.max(24, sizeBasis * 0.12);
    outerRad = voidRadius + (cfg.outerRadiusPct / 100) * (sizeBasis / 2 - voidRadius);
    voidCx = w * cfg.voidXPct / 100;
    voidCy = h * cfg.voidYPct / 100;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fgCtx.setTransform(1, 0, 0, 1, 0, 0);
    fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);

    initParticles(particleCountFor(w, h));
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(layout).observe(container);
  } else {
    window.addEventListener('resize', layout);
  }
  layout();

  const voidRgb = hexToRgb(cfg.voidColor);

  function drawVoidSphere() {
    const edgeR = Math.min(255, voidRgb.r + 14);
    const edgeG = Math.min(255, voidRgb.g + 14);
    const edgeB = Math.min(255, voidRgb.b + 14);

    const sphereGrad = ctx.createRadialGradient(
      voidCx - voidRadius * 0.25, voidCy - voidRadius * 0.3, voidRadius * 0.05,
      voidCx, voidCy, voidRadius
    );
    sphereGrad.addColorStop(0, `rgb(${voidRgb.r + 6}, ${voidRgb.g + 6}, ${voidRgb.b + 6})`);
    sphereGrad.addColorStop(0.65, `rgb(${voidRgb.r}, ${voidRgb.g}, ${voidRgb.b})`);
    sphereGrad.addColorStop(0.92, `rgb(${edgeR}, ${edgeG}, ${edgeB})`);
    sphereGrad.addColorStop(1, `rgb(${edgeR}, ${edgeG}, ${edgeB})`);

    ctx.globalAlpha = 1;
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(voidCx, voidCy, voidRadius, 0, Math.PI * 2);
    ctx.fill();

    // warm amber rim light — ties the event horizon back to the site's caramel palette
    const rimGrad = ctx.createRadialGradient(
      voidCx, voidCy, voidRadius * 0.86,
      voidCx, voidCy, voidRadius * 1.05
    );
    rimGrad.addColorStop(0, 'rgba(242,166,90,0)');
    rimGrad.addColorStop(0.6, 'rgba(242,166,90,0.08)');
    rimGrad.addColorStop(0.85, 'rgba(232,201,160,0.16)');
    rimGrad.addColorStop(1, 'rgba(232,201,160,0)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(voidCx, voidCy, voidRadius * 1.05, 0, Math.PI * 2);
    ctx.fill();
  }

  function step(dt) {
    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const tiltSidewayRad = (cfg.tiltSideway * Math.PI) / 180;

    const bg = [];
    const fg = [];

    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const speedFactor = Math.sqrt(voidRadius / Math.max(pt.radius, 10));
      const localOrbitSpeed = cfg.orbitSpeed * speedFactor * pt.speedOffset;
      const localPullSpeed = cfg.pullSpeed * speedFactor * pt.speedOffset;

      pt.angle += localOrbitSpeed * 0.012 * dt;
      pt.radius -= localPullSpeed * dt;

      if (pt.radius < voidRadius) {
        pt.radius = voidRadius + 0.7 * (outerRad - voidRadius) + Math.random() * 0.3 * (outerRad - voidRadius);
        pt.angle = Math.random() * Math.PI * 2;
        pt.height = (Math.random() - 0.5) * 16;
        continue;
      }

      const cosA = Math.cos(pt.angle);
      const sinA = Math.sin(pt.angle);
      const xBase = pt.radius * cosA;
      const yBase = pt.height;
      const zBase = pt.radius * sinA;

      const x1 = xBase;
      const y1 = yBase * Math.cos(tiltRad) + zBase * Math.sin(tiltRad);
      const z1 = -yBase * Math.sin(tiltRad) + zBase * Math.cos(tiltRad);

      const x3d = x1 * Math.cos(tiltSidewayRad) - y1 * Math.sin(tiltSidewayRad);
      const y3d = x1 * Math.sin(tiltSidewayRad) + y1 * Math.cos(tiltSidewayRad);
      const z3d = z1;

      const scale = PERSPECTIVE / (PERSPECTIVE + z3d);
      const px = voidCx + x3d * scale;
      const py = voidCy + y3d * scale;

      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

      const size = Math.max(0.3, cfg.particleSize * scale);
      const alpha = Math.max(0.35, 1 - ((z3d + outerRad) / (2 * outerRad)) * 0.45);
      const color = cfg.colors[pt.colorIdx % cfg.colors.length];
      const p = { x: px, y: py, size, alpha, z: z3d, color };

      if (z3d >= 0) bg.push(p); else fg.push(p);
    }

    bg.sort((a, b) => b.z - a.z);
    fg.sort((a, b) => b.z - a.z);
    return { bg, fg };
  }

  function paintParticles(context, list) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      context.globalAlpha = p.alpha;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function renderFrame(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    fgCtx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${cfg.trailAlpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    fgCtx.globalCompositeOperation = 'destination-out';
    fgCtx.fillStyle = `rgba(0,0,0,${cfg.trailAlpha})`;
    fgCtx.fillRect(0, 0, w, h);
    fgCtx.globalCompositeOperation = 'source-over';

    const { bg, fg } = step(dt);
    paintParticles(ctx, bg);
    drawVoidSphere();
    paintParticles(fgCtx, fg);
  }

  // Reduced motion: draw a single settled frame instead of looping rAF forever.
  if (reducedMotionQuery && reducedMotionQuery.matches) {
    for (let i = 0; i < 40; i++) renderFrame(1);
    return;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 16.667, 3);
    last = now;
    renderFrame(dt);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  if (reducedMotionQuery) {
    reducedMotionQuery.addEventListener('change', (e) => {
      if (e.matches) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
  }

  window.addEventListener('beforeunload', () => cancelAnimationFrame(raf));
})();
