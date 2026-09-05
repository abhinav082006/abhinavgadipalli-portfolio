/* =========================================================
   Skills "Gallery Tunnel" — ported from Originkit's hero-03
   (components/originkit/ui/hero-03/gallery-tunnel.tsx, a React +
   Three.js component) to plain Three.js + vanilla JS, no React
   runtime.

   Same underlying engine as the original: an infinite Three.js
   tunnel of recycling "rings," each ring's floor/ceiling/wall slots
   randomly filled with a flat color panel or an image-textured
   panel, camera flying forward continuously (accelerates on hold).

   Reshaped from the original's single-content tunnel into ONE
   continuous tunnel divided into depth "zones" — Languages, then
   Web Technologies, then Interests, then Tools & Platforms, then it
   loops. Which zone a given ring belongs to is derived from that
   ring's world-Z position, so as the camera flies deeper the walls
   naturally shift from one category's icons to the next. A floating
   signpost label announces each zone as you cross into it, and a
   row of "jump chips" lets you skip straight to a category instead
   of waiting for the flythrough to reach it.

   Icons: 8 are official brand SVGs (devicon) for real named techs;
   5 are hand-drawn concept icons (no real logo exists for "Software
   Dev" etc.), tinted to the site's palette so they read as
   intentionally different from the brand marks, not missing ones.
   Colors/lines retinted from the original's cream/tan theme to this
   site's dark ink + espresso/caramel/amber family.
   ========================================================= */
(function () {
  "use strict";

  /* ============================================================ skill data */
  var ICON_BASE = "assets/icons/";

  var CATEGORY_ORDER = ["languages", "web", "interests", "tools"];

  var SKILL_ICONS = {
    languages: [
      { src: ICON_BASE + "python.svg", label: "Python" },
      { src: ICON_BASE + "java.svg", label: "Java" },
      { src: ICON_BASE + "c.svg", label: "C" },
      { src: ICON_BASE + "sql.svg", label: "SQL" }
    ],
    web: [
      { src: ICON_BASE + "html5.svg", label: "HTML5" },
      { src: ICON_BASE + "css3.svg", label: "CSS3" },
      { src: ICON_BASE + "javascript.svg", label: "JavaScript" }
    ],
    interests: [
      { src: ICON_BASE + "software-dev.svg", label: "Software Dev" },
      { src: ICON_BASE + "web-dev.svg", label: "Web Development" },
      { src: ICON_BASE + "ai-tools.svg", label: "AI Tools" }
    ],
    tools: [
      { src: ICON_BASE + "github.svg", label: "GitHub", plate: true },
      { src: ICON_BASE + "rest-api.svg", label: "REST APIs" },
      { src: ICON_BASE + "chrome.svg", label: "Chrome Ext APIs" }
    ]
  };

  var CATEGORY_LABELS = {
    languages: "Languages",
    web: "Web Technologies",
    interests: "Interests",
    tools: "Tools & Platforms"
  };

  /* ============================================================ icon → card texture baking */
  // Every icon is baked once onto a small canvas card (dark panel, thin
  // amber border, the icon centered, its name underneath) and cached by
  // src so it's decoded only once no matter how many rings reuse it.
  var textureCache = new Map();

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bakeIconCard(src, label, plate) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var size = 512;
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext("2d");

        roundRectPath(ctx, 6, 6, size - 12, size - 12, 30);
        var grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, "#1c120a");
        grad.addColorStop(1, "#0c0705");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(232,201,160,0.4)";
        ctx.stroke();

        var pad = size * 0.16;
        var labelH = label ? size * 0.16 : 0;
        var iconSize = size - pad * 2 - labelH;
        var ix = (size - iconSize) / 2;
        var iy = pad;

        if (plate) {
          var inset = iconSize * 0.1;
          roundRectPath(ctx, ix - inset, iy - inset, iconSize + inset * 2, iconSize + inset * 2, 20);
          ctx.fillStyle = "rgba(251,243,231,0.94)";
          ctx.fill();
        }

        // all source icons use a square 0 0 128 128 viewBox, so a
        // straight square draw keeps every card's icon the same scale
        ctx.drawImage(img, ix, iy, iconSize, iconSize);

        if (label) {
          ctx.font = "600 34px Inter, Arial, sans-serif";
          ctx.fillStyle = "#F2D9B8";
          ctx.textAlign = "center";
          ctx.fillText(label, size / 2, size - pad * 0.42, size - pad * 1.4);
        }

        resolve(canvas);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function getIconTexture(item) {
    if (textureCache.has(item.src)) return textureCache.get(item.src);
    var p = bakeIconCard(item.src, item.label, item.plate).then(function (canvas) {
      if (!canvas) return null;
      var tex = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    });
    textureCache.set(item.src, p);
    return p;
  }

  /* ============================================================ tunnel engine (ported + zoned) */
  var TUNNEL_WIDTH = 2;
  var TUNNEL_HEIGHT = 1.8;
  var SEGMENT_DEPTH = 1;
  var NUM_SEGMENTS = 18;
  var LINE_RADIUS = 0.003;
  var SCROLL_TO_Z = 0.05;
  var CAMERA_CHASE = 0.1;
  var FADE_IN = 0.6;
  var ZONE_LENGTH = 200; // scrollPos units per category stretch — must clear
                         // the visible tunnel depth (NUM_SEGMENTS*SEGMENT_DEPTH
                         // = 18 world units = 18/SCROLL_TO_Z = 360 scrollPos
                         // units) or multiple categories render at once

  function createZonedTunnel(container, options) {
    var opts = Object.assign(
      {
        background: "#0B0705",
        lineColor: "#B98356",
        lineOpacity: 38,
        colorPalette: ["#1c110a", "#241408", "#150d07"],
        grid: 4,
        speed: 60,
        boost: 170,
        fade: 96,
        onZoneChange: null // (categoryKey, index) => void
      },
      options || {}
    );

    var canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    container.appendChild(canvas);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.background);

    var FOG_FAR = NUM_SEGMENTS * SEGMENT_DEPTH * 0.95;
    var fogNear = Math.min(FOG_FAR * (1 - Math.min(100, Math.max(0, opts.fade)) / 100), FOG_FAR - 0.01);
    scene.fog = new THREE.Fog(new THREE.Color(opts.background), fogNear, FOG_FAR);

    var camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
    camera.position.set(0, 0, 0);

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var lineMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.lineColor),
      transparent: true,
      opacity: Math.min(100, Math.max(0, opts.lineOpacity)) / 100
    });

    var colorMats = opts.colorPalette.map(function (hex) {
      return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), side: THREE.DoubleSide });
    });

    // per-category material lists, filled in as textures finish baking
    var catMats = {};
    CATEGORY_ORDER.forEach(function (key) { catMats[key] = []; });
    var catMatIndex = {};
    CATEGORY_ORDER.forEach(function (key) { catMatIndex[key] = 0; });

    var fading = [];
    var colorIndex = 0;
    var populateIndex = 0;
    var scrollPos = 0.001; // nudge off exactly 0 so zone-index math is unambiguous
    var raf = 0;
    var last = 0;
    var pressed = false;
    var alive = true;
    var paused = false;
    var externalPaused = false;   // section off-screen
    var pinPaused = false;        // holding on an announced category name
    var staticModePaused = false; // visitor manually switched to the static view
    var pinTimer = 0;
    var lastZoneIndex = null;

    function recomputePaused() {
      var wasPaused = paused;
      paused = externalPaused || pinPaused || staticModePaused;
      if (wasPaused && !paused) last = 0; // resuming — avoid a big dt spike
    }

    var hw = TUNNEL_WIDTH / 2;
    var hh = TUNNEL_HEIGHT / 2;
    var cols = Math.max(1, Math.round(opts.grid));
    var rows = Math.max(1, Math.round(opts.grid));
    var colW = TUNNEL_WIDTH / cols;
    var rowH = TUNNEL_HEIGHT / rows;

    var geoFloor = new THREE.PlaneGeometry(colW, SEGMENT_DEPTH);
    var geoWall = new THREE.PlaneGeometry(SEGMENT_DEPTH, rowH);
    var geoTubeZ = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -SEGMENT_DEPTH)),
      1, LINE_RADIUS, 8
    );
    var geoTubeX = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(TUNNEL_WIDTH, 0, 0)),
      1, LINE_RADIUS, 8
    );
    var geoTubeY = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, TUNNEL_HEIGHT, 0)),
      1, LINE_RADIUS, 8
    );

    function tube(geo, x, y, z) {
      var m = new THREE.Mesh(geo, lineMaterial);
      m.position.set(x, y, z || 0);
      return m;
    }

    var SLOTS = [];
    (function buildSlots() {
      var z = -SEGMENT_DEPTH / 2;
      var i, x, y;
      for (i = 0; i < cols; i++) {
        x = -hw + i * colW + colW / 2;
        SLOTS.push({ geo: geoFloor, pos: new THREE.Vector3(x, -hh, z), rot: new THREE.Euler(-Math.PI / 2, 0, 0) });
        SLOTS.push({ geo: geoFloor, pos: new THREE.Vector3(x, hh, z), rot: new THREE.Euler(Math.PI / 2, 0, 0) });
      }
      for (i = 0; i < rows; i++) {
        y = -hh + i * rowH + rowH / 2;
        SLOTS.push({ geo: geoWall, pos: new THREE.Vector3(-hw, y, z), rot: new THREE.Euler(0, Math.PI / 2, 0) });
        SLOTS.push({ geo: geoWall, pos: new THREE.Vector3(hw, y, z), rot: new THREE.Euler(0, -Math.PI / 2, 0) });
      }
    })();

    // -- zone helpers ---------------------------------------------------
    function zoneIndexAt(z) {
      var segScrollPos = -z / SCROLL_TO_Z;
      return Math.floor(segScrollPos / ZONE_LENGTH);
    }
    function categoryForZone(zoneIndex) {
      var n = CATEGORY_ORDER.length;
      var idx = ((zoneIndex % n) + n) % n;
      return CATEGORY_ORDER[idx];
    }
    function categoryForSegment(seg) {
      return categoryForZone(zoneIndexAt(seg.position.z));
    }

    function populate(group) {
      var takesSlabs = populateIndex % 2 === 0;
      populateIndex++;
      var cat = categoryForSegment(group);
      var mats = catMats[cat];
      var slabs = group.userData.slabs;
      for (var i = 0; i < slabs.length; i++) {
        var slab = slabs[i];
        if (!takesSlabs) {
          slab.visible = false;
          continue;
        }
        var showImage = mats && mats.length > 0 && Math.random() < 0.72;
        if (showImage) {
          slab.visible = true;
          slab.material = mats[catMatIndex[cat] % mats.length];
          catMatIndex[cat]++;
        } else if (colorMats.length > 0 && Math.random() > 0.35) {
          slab.visible = true;
          slab.material = colorMats[colorIndex % colorMats.length];
          colorIndex++;
        } else {
          slab.visible = false;
        }
      }
    }

    function createSegment(z) {
      var group = new THREE.Group();
      group.position.z = z;
      var i, x, y;
      for (i = 0; i <= cols; i++) {
        x = -hw + i * colW;
        group.add(tube(geoTubeZ, x, -hh));
        group.add(tube(geoTubeZ, x, hh));
      }
      for (i = 1; i < rows; i++) {
        y = -hh + i * rowH;
        group.add(tube(geoTubeZ, -hw, y));
        group.add(tube(geoTubeZ, hw, y));
      }
      group.add(tube(geoTubeX, -hw, -hh));
      group.add(tube(geoTubeX, -hw, hh));
      group.add(tube(geoTubeY, -hw, -hh));
      group.add(tube(geoTubeY, hw, -hh));

      var slabs = SLOTS.map(function (slot) {
        var m = new THREE.Mesh(slot.geo, colorMats[0] || lineMaterial);
        m.position.copy(slot.pos);
        m.rotation.copy(slot.rot);
        m.visible = false;
        group.add(m);
        return m;
      });
      group.userData.slabs = slabs;
      populate(group);
      return group;
    }

    var segments = [];
    for (var s = 0; s < NUM_SEGMENTS; s++) {
      var g = createSegment(-s * SEGMENT_DEPTH);
      scene.add(g);
      segments.push(g);
    }

    function resize() {
      var w = Math.max(1, container.clientWidth);
      var h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    var ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // -- floating category signs: real objects living in the tunnel's 3D
    // space (not a DOM overlay) — one per category, positioned at the
    // start of its stretch, floating in the middle of the passage like a
    // big sign or vehicle. As the camera travels, perspective naturally
    // makes them grow larger approaching and they fade out once passed;
    // each one then jumps a full lap ahead to represent its NEXT
    // upcoming occurrence, so there are always exactly 4 signs cycling
    // forever, matching the 4 zones.
    var ZONE_LENGTH_WORLD = ZONE_LENGTH * SCROLL_TO_Z;
    var LAP_WORLD = CATEGORY_ORDER.length * ZONE_LENGTH_WORLD;
    var SIGN_RECYCLE_BUFFER = 2;

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function bakeSignTexture(text) {
      var w = 1024, h = 300;
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      var r = 44;

      // frosted glass panel: lighter translucent fill (not a flat dark
      // card) so the tunnel genuinely shows through behind the text
      roundRectPath(ctx, 8, 8, w - 16, h - 16, r);
      ctx.save();
      ctx.clip();
      var grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,241,222,0.16)");
      grad.addColorStop(0.5, "rgba(60,42,26,0.28)");
      grad.addColorStop(1, "rgba(10,6,4,0.36)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // diagonal glossy highlight streak, like light catching glass
      var gloss = ctx.createLinearGradient(0, 0, w * 0.6, h);
      gloss.addColorStop(0, "rgba(255,255,255,0.22)");
      gloss.addColorStop(0.25, "rgba(255,255,255,0.06)");
      gloss.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.fillRect(0, 0, w, h);

      // soft top-edge rim light
      var rim = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      rim.addColorStop(0, "rgba(255,255,255,0.3)");
      rim.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rim;
      ctx.fillRect(0, 0, w, h * 0.4);
      ctx.restore();

      // glowing amber border, softly blurred rather than a hard line
      ctx.save();
      ctx.shadowColor = "rgba(242,197,140,0.55)";
      ctx.shadowBlur = 18;
      roundRectPath(ctx, 8, 8, w - 16, h - 16, r);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(255,244,228,0.75)";
      ctx.stroke();
      ctx.restore();

      ctx.font = "italic 600 104px Fraunces, Georgia, serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 22;
      ctx.fillText(text, w / 2, h / 2 + 6);
      return c;
    }

    var signMeshes = CATEGORY_ORDER.map(function (cat, i) {
      var canvas = bakeSignTexture(CATEGORY_LABELS[cat]);
      var tex = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
      });
      var geo = new THREE.PlaneGeometry(1.7, 1.7 * (300 / 1024));
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, -(i * ZONE_LENGTH_WORLD));
      mesh.userData.category = cat;
      mesh.renderOrder = 2;
      scene.add(mesh);
      return mesh;
    });

    // re-bake once the real webfont is confirmed loaded, so signs don't
    // stay stuck with whatever fallback serif was available at first paint
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!alive) return;
        signMeshes.forEach(function (mesh) {
          var canvas = bakeSignTexture(CATEGORY_LABELS[mesh.userData.category]);
          mesh.material.map.dispose();
          var tex = new THREE.CanvasTexture(canvas);
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          mesh.material.map = tex;
          mesh.material.needsUpdate = true;
        });
      });
    }

    function updateSigns() {
      var camZ = camera.position.z;
      for (var i = 0; i < signMeshes.length; i++) {
        var mesh = signMeshes[i];
        if (camZ < mesh.position.z - SIGN_RECYCLE_BUFFER) {
          mesh.position.z -= LAP_WORLD;
        }
        var d = camZ - mesh.position.z; // > 0 still ahead, < 0 already passed
        var farT = clamp01((16 - d) / (16 - 9));           // fades IN 16 -> 9 units out
        var nearT = clamp01((d - -1.2) / (2.2 - -1.2));    // fades OUT 2.2 -> -1.2 units (i.e. just after passing)
        mesh.material.opacity = Math.max(0, Math.min(farT, nearT));
      }
    }

    // bake every icon across every category up front; as each category's
    // set finishes, live rings currently in that zone get a fresh shuffle
    CATEGORY_ORDER.forEach(function (cat) {
      var items = SKILL_ICONS[cat] || [];
      Promise.all(items.map(getIconTexture)).then(function (textures) {
        if (!alive) return;
        var mats = [];
        for (var i = 0; i < textures.length; i++) {
          var tex = textures[i];
          if (!tex) continue;
          var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide });
          fading.push(mat);
          mats.push(mat);
        }
        catMats[cat] = mats;
        for (var j = 0; j < segments.length; j++) {
          if (categoryForSegment(segments[j]) === cat) populate(segments[j]);
        }
      });
    });

    function checkZoneChange() {
      var zi = zoneIndexAt(camera.position.z);
      if (zi !== lastZoneIndex) {
        lastZoneIndex = zi;
        if (typeof opts.onZoneChange === "function") {
          opts.onZoneChange(categoryForZone(zi), zi);
        }
      }
    }
    checkZoneChange(); // fire once immediately so a label shows right away

    /* ======================================================== "Tunnel Wrap"
       A cylindrical shell of glowing white star-point sprites wrapped
       around the outside of the existing tunnel walls, so the existing
       tunnel reads as flying *through* it rather than the wrap being its
       own separate thing. Purely additive to this scene/camera/render
       loop below — nothing about the tunnel itself (segments, signs,
       chips, fog, camera flight) is touched.

       Simplifications versus the reference spec, for a vanilla-JS/no-
       build-step site: plain soft-glow dots instead of the 0/1 glyph
       atlas (matches the reference recording, which reads as a starfield
       rather than visible digits); additive blending stands in for the
       five-mip UnrealBloom pass (no postprocessing composer is wired up
       here); displacement/recycling run on the CPU each frame instead of
       in a vertex shader (cheap at this particle count). */
    var WRAP_COUNT = 2600;        // total star sprites in the wrap
    var WRAP_R_MIN = 1.55;        // just outside the tunnel's own walls (hw=1, hh=0.9)
    var WRAP_R_MAX = 4.4;         // out to roughly where the camera's FOV edge sits
    var WRAP_DEPTH = 60;          // world-Z span of the recycling field around the camera
    var WRAP_BEHIND = 4;          // how far behind the camera a point may drift before recycling forward
    var WRAP_MAX_DISPLACE = 2.3;  // world units the far edge of the field can swing toward the pointer
    var WRAP_STEER_EASE = 0.05;   // per-frame-at-60fps ease toward the pointer target

    function bakeStarTexture() {
      // a crisp, mostly-solid small dot (not a big soft glow orb) — matches
      // the flat filled-circle look used for the stars in GlitterWrap.js
      var size = 32;
      var c = document.createElement("canvas");
      c.width = size; c.height = size;
      var gx = c.getContext("2d");
      var cx = size / 2, cy = size / 2, r = size / 2;
      var grad = gx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.78, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)"); // just enough falloff to anti-alias the edge
      gx.fillStyle = grad;
      gx.fillRect(0, 0, size, size);
      var tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }

    // twinkle constants — same values as GlitterWrap.js, so the wrap's
    // stars flicker the same way the Experience/Projects starfields do
    var TWINKLE_CHANCE_PER_SEC = 0.35;
    var TWINKLE_DURATION = 0.55;

    function buildWrapField(tex, count) {
      var radius = new Float32Array(count);
      var angle = new Float32Array(count);
      var baseZ = new Float32Array(count);
      var baseBright = new Float32Array(count);
      var twinkleT = new Float32Array(count);   // <0 = not currently twinkling
      var twinkleAt = new Float32Array(count);  // seconds until next eligible to twinkle
      var colors = new Float32Array(count * 3);
      var i;
      for (i = 0; i < count; i++) {
        radius[i] = WRAP_R_MIN + Math.random() * (WRAP_R_MAX - WRAP_R_MIN);
        angle[i] = Math.random() * Math.PI * 2;
        baseZ[i] = camera.position.z + WRAP_BEHIND - Math.random() * WRAP_DEPTH;
        // per-star brightness variance — most dim, a few brighter — same
        // idea as GlitterWrap's randomized baseAlpha per star
        // resting brightness sits low, on purpose — leaves plenty of
        // headroom for the twinkle flash (which pushes toward 1.0) to
        // read as a clear pop rather than a subtle wobble
        var b = 0.12 + Math.random() * 0.33;
        baseBright[i] = b;
        twinkleT[i] = -1;
        twinkleAt[i] = Math.random() * 4;
        colors[i * 3] = b; colors[i * 3 + 1] = b; colors[i * 3 + 2] = b;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      var mat = new THREE.PointsMaterial({
        map: tex,
        vertexColors: true,
        size: 0.045,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.NormalBlending,
        fog: true
      });
      var points = new THREE.Points(geo, mat);
      scene.add(points);
      return {
        points: points, tex: tex, geo: geo, mat: mat,
        radius: radius, angle: angle, baseZ: baseZ, count: count,
        baseBright: baseBright, twinkleT: twinkleT, twinkleAt: twinkleAt
      };
    }

    var wrapFields = [
      buildWrapField(bakeStarTexture(), WRAP_COUNT)
    ];

    // pointer steering: eases toward the pointer while it's over the
    // tunnel, and — since nothing here resets the target on pointer-leave
    // — simply holds at its last eased position once the pointer leaves,
    // rather than springing back to center
    var wrapSteerTargetX = 0, wrapSteerTargetY = 0;
    var wrapSteerX = 0, wrapSteerY = 0;
    function onWrapPointerMove(e) {
      var rect = container.getBoundingClientRect();
      wrapSteerTargetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      wrapSteerTargetY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    container.addEventListener("pointermove", onWrapPointerMove);

    function updateWrap(dt) {
      var ease = 1 - Math.pow(1 - WRAP_STEER_EASE, dt * 60);
      wrapSteerX += (wrapSteerTargetX - wrapSteerX) * ease;
      wrapSteerY += (wrapSteerTargetY - wrapSteerY) * ease;

      var camZ = camera.position.z;
      for (var f = 0; f < wrapFields.length; f++) {
        var field = wrapFields[f];
        var pos = field.geo.attributes.position.array;
        var col = field.geo.attributes.color.array;
        for (var i = 0; i < field.count; i++) {
          if (field.baseZ[i] > camZ + WRAP_BEHIND) field.baseZ[i] -= WRAP_DEPTH;
          var depth = camZ - field.baseZ[i]; // >0, grows with distance ahead of the camera
          var t = Math.max(0, Math.min(1, depth / WRAP_DEPTH));
          var factor = t * t; // far end swings, near end barely moves
          var dispX = wrapSteerX * factor * WRAP_MAX_DISPLACE;
          var dispY = -wrapSteerY * factor * WRAP_MAX_DISPLACE;
          pos[i * 3] = Math.cos(field.angle[i]) * field.radius[i] + dispX;
          pos[i * 3 + 1] = Math.sin(field.angle[i]) * field.radius[i] + dispY;
          pos[i * 3 + 2] = field.baseZ[i];

          // twinkle — same per-star flash logic as GlitterWrap.js's stars
          var bright = field.baseBright[i];
          if (field.twinkleT[i] >= 0) {
            field.twinkleT[i] += dt;
            if (field.twinkleT[i] >= TWINKLE_DURATION) {
              field.twinkleT[i] = -1;
              field.twinkleAt[i] = 1 + Math.random() * 2.5;
            } else {
              var p = field.twinkleT[i] / TWINKLE_DURATION;
              var boost = Math.sin(p * Math.PI); // 0 -> 1 -> 0
              bright = Math.min(1, bright + boost * (1 - bright));
            }
          } else {
            field.twinkleAt[i] -= dt;
            if (field.twinkleAt[i] <= 0 && Math.random() < TWINKLE_CHANCE_PER_SEC * dt * 30) {
              field.twinkleT[i] = 0;
            }
          }
          col[i * 3] = bright; col[i * 3 + 1] = bright; col[i * 3 + 2] = bright;
        }
        field.geo.attributes.position.needsUpdate = true;
        field.geo.attributes.color.needsUpdate = true;
      }

      // a slight camera roll toward the steer direction, same idea as the
      // reference — applied after the tunnel's own position/fly-through
      // logic below has already run, so it never interferes with it
      camera.rotation.z = -wrapSteerX * 0.05;
    }

    function animate(now) {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      if (paused) {
        last = 0;
        return;
      }
      var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;

      var boosting = pressed;
      var speedUnits = Math.max(0, opts.speed) / 100;
      var boostUnits = Math.max(0, opts.boost) / 10;
      scrollPos += boosting ? boostUnits : speedUnits;

      var want = -SCROLL_TO_Z * scrollPos;
      var chaseFactor = 1 - Math.pow(1 - CAMERA_CHASE, dt * 60);
      camera.position.z += chaseFactor * (want - camera.position.z);

      var span = NUM_SEGMENTS * SEGMENT_DEPTH;
      var z = camera.position.z;
      var i, seg, min, max;
      for (i = 0; i < segments.length; i++) {
        seg = segments[i];
        if (seg.position.z > z + SEGMENT_DEPTH) {
          min = 0;
          for (var a = 0; a < segments.length; a++) min = Math.min(min, segments[a].position.z);
          seg.position.z = min - SEGMENT_DEPTH;
          populate(seg);
        } else if (seg.position.z < z - span - SEGMENT_DEPTH) {
          max = -999999;
          for (var b = 0; b < segments.length; b++) max = Math.max(max, segments[b].position.z);
          seg.position.z = max + SEGMENT_DEPTH;
          populate(seg);
        }
      }

      checkZoneChange();
      updateSigns();

      for (i = fading.length - 1; i >= 0; i--) {
        var m = fading[i];
        m.opacity = Math.min(1, m.opacity + dt / FADE_IN);
        if (m.opacity >= 1) fading.splice(i, 1);
      }

      updateWrap(dt);

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(animate);

    function onDown() { pressed = true; }
    function onUp() { pressed = false; }
    function onLeave() { pressed = false; }
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);

    return {
      // jump forward to the next upcoming stretch of `categoryKey`
      // (never backward — the tunnel only flies one direction). The
      // tunnel freezes on an up-close, full-opacity announcement of the
      // category name first, then resumes flying a beat later — instead
      // of silently swapping content while still moving.
      jumpToCategory: function (categoryKey) {
        var n = CATEGORY_ORDER.length;
        var targetIdx = CATEGORY_ORDER.indexOf(categoryKey);
        if (targetIdx === -1) return;
        var curZone = zoneIndexAt(camera.position.z);
        var curCat = ((curZone % n) + n) % n;
        var delta = (targetIdx - curCat + n) % n;
        if (delta === 0) delta = n; // already there — jump ahead a full lap instead of stalling
        var targetZone = curZone + delta;
        scrollPos = targetZone * ZONE_LENGTH + ZONE_LENGTH * 0.18;
        camera.position.z = -SCROLL_TO_Z * scrollPos; // instant — a jump-chip is a shortcut, not a slow catch-up
        // rings only get REcolored by the per-frame recycle loop once it
        // actually runs — since we're about to freeze on an announcement
        // frame before that ever happens, also reposition them here so
        // the frozen frame shows a properly surrounded tunnel, not empty
        // space with just the sign floating in it
        for (var j = 0; j < segments.length; j++) {
          segments[j].position.z = camera.position.z - j * SEGMENT_DEPTH;
          populate(segments[j]);
        }
        checkZoneChange();

        var sign = null;
        for (var k = 0; k < signMeshes.length; k++) {
          if (signMeshes[k].userData.category === categoryKey) { sign = signMeshes[k]; break; }
        }
        if (sign) {
          sign.position.z = camera.position.z - 4; // pin it a comfortable, fully-legible distance ahead
          sign.material.opacity = 1;
        }

        pinPaused = true;
        recomputePaused();
        renderer.render(scene, camera); // paint the frozen announcement frame now — the loop won't render while paused

        clearTimeout(pinTimer);
        pinTimer = setTimeout(function () {
          pinPaused = false;
          recomputePaused();
        }, 1100);
      },
      setPaused: function (v) {
        externalPaused = !!v;
        recomputePaused();
      },
      setStaticMode: function (v) {
        staticModePaused = !!v;
        recomputePaused();
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(pinTimer);
        ro.disconnect();
        container.removeEventListener("pointerdown", onDown);
        container.removeEventListener("pointerleave", onLeave);
        container.removeEventListener("pointermove", onWrapPointerMove);
        window.removeEventListener("pointerup", onUp);
        geoFloor.dispose();
        geoWall.dispose();
        geoTubeZ.dispose();
        geoTubeX.dispose();
        geoTubeY.dispose();
        colorMats.forEach(function (m) { m.dispose(); });
        lineMaterial.dispose();
        signMeshes.forEach(function (mesh) {
          mesh.geometry.dispose();
          if (mesh.material.map) mesh.material.map.dispose();
          mesh.material.dispose();
        });
        wrapFields.forEach(function (f) {
          f.geo.dispose();
          f.mat.dispose();
          f.tex.dispose();
        });
        renderer.dispose();
        canvas.remove();
      }
    };
  }

  /* ============================================================ wiring: signpost + jump-chips */
  function supportsWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  function showFallback() {
    var stage = document.getElementById("tunnel-stage");
    var fallback = document.getElementById("skills-fallback");
    var toTunnelBtn = document.getElementById("static-show-tunnel");
    if (stage) stage.hidden = true;
    if (fallback) fallback.hidden = false;
    if (toTunnelBtn) toTunnelBtn.hidden = true; // no working tunnel to switch back to
  }

  function init() {
    var stage = document.getElementById("tunnel-stage");
    if (!stage) return;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof THREE === "undefined" || !supportsWebGL() || reduceMotion) {
      showFallback();
      return;
    }

    var ambientContainer = document.getElementById("tunnel-canvas-ambient");
    var introEl = document.getElementById("tunnel-intro");
    var chips = document.querySelectorAll(".tunnel-chip");
    var fallback = document.getElementById("skills-fallback");
    var toStaticBtn = document.getElementById("tunnel-show-static");
    var toTunnelBtn = document.getElementById("static-show-tunnel");

    function onZoneChange(cat) {
      chips.forEach(function (chip) {
        chip.classList.toggle("is-active", chip.getAttribute("data-category") === cat);
      });
    }

    var tunnel;
    try {
      tunnel = createZonedTunnel(ambientContainer, {
        grid: 4,
        fade: 96,
        onZoneChange: onZoneChange
      });
    } catch (e) {
      showFallback();
      return;
    }

    if (toStaticBtn) {
      toStaticBtn.addEventListener("click", function () {
        toStaticBtn.blur(); // avoid the browser's focus-fixup scroll jump when its container gets hidden
        stage.hidden = true;
        if (fallback) fallback.hidden = false;
        tunnel.setStaticMode(true);
      });
    }
    if (toTunnelBtn) {
      toTunnelBtn.addEventListener("click", function () {
        toTunnelBtn.blur();
        if (fallback) fallback.hidden = true;
        stage.hidden = false;
        tunnel.setStaticMode(false);
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        tunnel.jumpToCategory(chip.getAttribute("data-category"));
      });
    });

    // Intro sequence: the tunnel runs the whole time, but the title
    // card sits solidly over it whenever you arrive at the section,
    // holds briefly, then fades away to reveal the tunnel already in
    // motion underneath. Replays every time you scroll back in (not
    // just the first time ever).
    var introTimer = 0;
    function playIntro() {
      if (!introEl) return;
      clearTimeout(introTimer);
      // snap back to fully visible instantly (no fade-in) so it's
      // already there the moment you arrive — only the disappearance
      // is animated
      introEl.style.transition = "none";
      introEl.classList.remove("is-hidden");
      void introEl.offsetWidth; // force reflow so the transition removal actually applies
      introEl.style.transition = "";
      introTimer = setTimeout(function () {
        introEl.classList.add("is-hidden");
      }, 1700);
    }

    // pause rendering while the section is off-screen (perf, and avoids
    // zones silently cycling past while nobody can see them)
    if (typeof IntersectionObserver !== "undefined") {
      var introShown = false;
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            tunnel.setPaused(!entry.isIntersecting);
            if (entry.isIntersecting && !introShown) {
              introShown = true;
              playIntro();
            } else if (!entry.isIntersecting) {
              introShown = false; // ready to replay next time you arrive
            }
          });
        },
        { threshold: 0.5 }
      );
      io.observe(stage);
    } else {
      // no IntersectionObserver support — just show it after a beat
      playIntro();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();