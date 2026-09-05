/* =========================================================
   Liquid Vortex — a WebGL shader that spins fractal noise
   around a centre point, shearing it into spiralling smoke
   filaments that wind up while the pointer is over the frame.

   Self-initializes on every <canvas class="liquid-vortex-bg">
   on the page (same pattern as GlitterWrap.js) so it can be
   dropped into multiple sections independently. Config is read
   per-canvas from data-* attributes, mirroring the documented
   props table (smoke/deep/ember/swirl/turbulence/detail/density/
   contrast/emberAmount/hoverBoost/sizePercent/speed).

   Technique:
   - Six-octave value noise, each octave rotated by a fixed
     angle so the grid never lines up into a plaid, with the
     tail octaves faded in by weight so raising "detail" adds
     texture gradually instead of popping.
   - Two rounds of domain warping (noise fed back into the
     sampling coordinate of the next noise call) — this is what
     pulls round blobs into long drawn-out filaments instead of
     cloud-like puffs.
   - A rotation angle that grows as 1/r toward the centre, so
     inner rings spin faster than outer ones and shear the whole
     field into a spiral.
   - A gaussian radial falloff keeps the result a soft-edged
     column instead of filling the canvas corner to corner.
   - The animation clock only advances while the pointer is over
     the canvas, eased in/out over ~1s via a smoothed "activity"
     value — so speed ramps up and down smoothly rather than
     snapping, and the framing/scale never changes, only how
     fast it turns.
   - Renders to a transparent canvas capped at devicePixelRatio
     1.5, resizes off a ResizeObserver, and simply draws nothing
     (rather than throwing) if WebGL isn't available.
   ========================================================= */
(function () {
  "use strict";

  var canvases = document.querySelectorAll(".liquid-vortex-bg");
  if (!canvases.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var VERTEX_SRC =
    "attribute vec2 aPos;" +
    "varying vec2 vUv;" +
    "void main(){" +
    "  vUv = aPos * 0.5 + 0.5;" +
    "  gl_Position = vec4(aPos, 0.0, 1.0);" +
    "}";

  var FRAGMENT_SRC =
    "precision highp float;" +
    "varying vec2 vUv;" +
    "uniform vec2 uResolution;" +
    "uniform float uTime;" +
    "uniform float uSwirl;" +
    "uniform float uTurbulence;" +
    "uniform float uDetail;" +
    "uniform float uDensity;" +
    "uniform float uContrast;" +
    "uniform float uEmberAmount;" +
    "uniform float uSizePercent;" +
    "uniform vec3 uSmoke;" +
    "uniform vec3 uDeep;" +
    "uniform vec3 uEmber;" +

    "float hash(vec2 p){" +
    "  p = fract(p * vec2(123.34, 456.21));" +
    "  p += dot(p, p + 45.32);" +
    "  return fract(p.x * p.y);" +
    "}" +

    "float valueNoise(vec2 p){" +
    "  vec2 i = floor(p);" +
    "  vec2 f = fract(p);" +
    "  float a = hash(i);" +
    "  float b = hash(i + vec2(1.0, 0.0));" +
    "  float c = hash(i + vec2(0.0, 1.0));" +
    "  float d = hash(i + vec2(1.0, 1.0));" +
    "  vec2 u = f * f * (3.0 - 2.0 * f);" +
    "  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;" +
    "}" +

    "mat2 rot(float a){" +
    "  float s = sin(a), c = cos(a);" +
    "  return mat2(c, -s, s, c);" +
    "}" +

    /* six octaves, each rotated so the sample grid never lines up;
       tail octaves faded in by weight (driven by uDetail) so raising
       detail adds fine strands gradually instead of popping in */
    "float fbm(vec2 p){" +
    "  float total = 0.0;" +
    "  float amp = 0.5;" +
    "  float freq = 1.0;" +
    "  for (int i = 0; i < 6; i++){" +
    "    float fi = float(i);" +
    "    p = rot(0.5 + fi * 0.35) * p;" +
    "    float weight = clamp((uDetail / 40.0) - fi * 0.12 + 0.55, 0.0, 1.0);" +
    "    total += valueNoise(p * freq) * amp * weight;" +
    "    freq *= 2.02;" +
    "    amp *= 0.55;" +
    "  }" +
    "  return total;" +
    "}" +

    "void main(){" +
    "  vec2 uv = vUv - 0.5;" +
    "  uv.x *= uResolution.x / max(uResolution.y, 1.0);" +

    "  float zoom = 100.0 / max(uSizePercent, 1.0);" +
    "  uv *= zoom;" +

    "  float r = length(uv);" +

    /* rotation angle grows toward the centre -> inner rings spin
       faster, shearing anything crossing the field into a spiral */
    "  float swirlAmt = (uSwirl * 0.16) / (r * 2.0 + 0.15);" +
    "  float ang = swirlAmt + uTime * 0.12;" +
    "  uv = rot(ang) * uv;" +

    /* two rounds of domain warping — noise feeding the next noise's
       sample coordinate is what turns round blobs into filaments */
    "  float turb = uTurbulence / 20.0;" +
    "  vec2 p = uv * 2.0 + vec2(uTime * 0.05, -uTime * 0.035);" +
    "  float n1 = fbm(p);" +
    "  vec2 p2 = p + n1 * turb * 1.4;" +
    "  float n2 = fbm(p2);" +
    "  vec2 p3 = p + n2 * turb * 1.4;" +
    "  float n3 = fbm(p3);" +

    "  float density = clamp(n3 * (uDensity / 4.0), 0.0, 1.0);" +

    /* contrast: high values clear the thin haze and keep only the
       solid smoke, sharpening its edges */
    "  float c = uContrast / 20.0;" +
    "  density = pow(density, mix(1.0, 2.6, clamp(c - 1.0, 0.0, 1.0)));" +
    "  density = smoothstep(mix(0.0, 0.35, clamp(c * 0.3, 0.0, 1.0)), 1.0, density);" +

    /* gaussian radial falloff keeps this a column with soft edges
       rather than filling the rectangle corner to corner */
    "  float sigma = 0.55;" +
    "  float falloff = exp(-(r * r) / (2.0 * sigma * sigma));" +
    "  density *= falloff;" +

    "  vec3 col = mix(uDeep, uSmoke, density);" +

    /* ember glow in the hottest, most sheared part near the middle */
    "  float emberGlow = (uEmberAmount / 40.0) * exp(-r * r * 6.0) * (0.5 + 0.5 * n2);" +
    "  col += uEmber * emberGlow;" +

    "  float alpha = clamp(density + emberGlow, 0.0, 1.0);" +
    "  gl_FragColor = vec4(col, alpha);" +
    "}";

  function hexToRgb01(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#FFF700");
    if (!m) return [1, 0.97, 0];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  }

  function compileShader(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  canvases.forEach(function (canvas) {
    initVortex(canvas);
  });

  function initVortex(canvas) {
    var gl = null;
    try {
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false }) ||
           canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false });
    } catch (e) {
      gl = null;
    }
    // draw nothing rather than throwing if WebGL is missing
    if (!gl) return;

    var vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) return;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    var quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uniforms = {};
    ["uResolution", "uTime", "uSwirl", "uTurbulence", "uDetail", "uDensity",
     "uContrast", "uEmberAmount", "uSizePercent", "uSmoke", "uDeep", "uEmber"]
      .forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });

    var ds = canvas.dataset;
    var cfg = {
      smoke: hexToRgb01(ds.smoke || "#FFF700"),
      deep: hexToRgb01(ds.deep || "#FFF700"),
      ember: hexToRgb01(ds.ember || "#FFF700"),
      swirl: parseFloat(ds.swirl) || 10,
      turbulence: parseFloat(ds.turbulence) || 20,
      detail: parseFloat(ds.detail) || 20,
      density: parseFloat(ds.density) || 4,
      contrast: parseFloat(ds.contrast) || 20,
      emberAmount: parseFloat(ds.emberAmount) || 0,
      hoverBoost: parseFloat(ds.hoverBoost) || 20,
      sizePercent: parseFloat(ds.sizePercent) || 100,
      speed: parseFloat(ds.speed) || 1
    };

    gl.uniform1f(uniforms.uSwirl, cfg.swirl);
    gl.uniform1f(uniforms.uTurbulence, cfg.turbulence);
    gl.uniform1f(uniforms.uDetail, cfg.detail);
    gl.uniform1f(uniforms.uDensity, cfg.density);
    gl.uniform1f(uniforms.uContrast, cfg.contrast);
    gl.uniform1f(uniforms.uEmberAmount, cfg.emberAmount);
    gl.uniform1f(uniforms.uSizePercent, cfg.sizePercent);
    gl.uniform3f(uniforms.uSmoke, cfg.smoke[0], cfg.smoke[1], cfg.smoke[2]);
    gl.uniform3f(uniforms.uDeep, cfg.deep[0], cfg.deep[1], cfg.deep[2]);
    gl.uniform3f(uniforms.uEmber, cfg.ember[0], cfg.ember[1], cfg.ember[2]);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var dpr = 1, w = 0, h = 0;
    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, Math.round(rect.width * dpr));
      h = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uniforms.uResolution, w, h);
    }

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resize).observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }
    resize();

    // Idle: constant rotation at the base speed. Hover: speeds up,
    // eased in/out over ~1s (rather than snapping) via a smoothed
    // speed multiplier — the shader never actually stops turning.
    var hovering = false;
    canvas.addEventListener("pointerenter", function () { hovering = true; });
    canvas.addEventListener("pointerleave", function () { hovering = false; });

    var speedMul = 1; // current eased multiplier (1 = idle, >1 = hover boost)
    var time = 0;
    var lastNow = null;
    var running = true;
    var rafId = null;

    function frame(now) {
      if (!running) return;
      if (lastNow === null) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      if (!reduceMotion) {
        var targetMul = hovering ? 1 + (cfg.hoverBoost / 10) : 1;
        // ease toward the target over roughly a second
        speedMul += (targetMul - speedMul) * Math.min(1, dt * 1.4);

        time += dt * cfg.speed * 0.35 * speedMul;

        gl.uniform1f(uniforms.uTime, time);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      rafId = requestAnimationFrame(frame);
    }

    // static warm-up frame so the shader is visible immediately, even
    // at rest / under reduced motion, before any hover occurs
    gl.uniform1f(uniforms.uTime, 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!reduceMotion) {
      if (typeof IntersectionObserver !== "undefined") {
        new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                if (!rafId) { lastNow = null; rafId = requestAnimationFrame(frame); }
              } else if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
              }
            });
          },
          { threshold: 0.01 }
        ).observe(canvas);
      } else {
        rafId = requestAnimationFrame(frame);
      }
    }
  }
})();