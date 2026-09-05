/* =========================================================
   Education & Experience — rotating dial

   A semicircle of month/year labels bleeding off the left edge of
   the section, like a clock face. The page's main ScrollTrigger pin
   (script.js) holds the whole section still while it drives which
   entry is "active" (aligned with the fixed marker on the right of
   the arc) via window.ExpDial.goToIndex(); once the last entry is
   reached, that same pin releases and the page continues scrolling
   normally. The active entry's full details show in the panel
   beside it, and the dial gives a small mechanical "shake" each
   time it steps to a new entry.

   Data (dates, titles, descriptions, orgs) is read from the
   accessible .timeline list already in the page — nothing is
   retyped here, so the dial can never drift out of sync with it.
   That list is also the reduced-motion / no-JS fallback.
   ========================================================= */
(function () {
  "use strict";

  // Radius of the clock circle, as a multiple of the arc container's
  // height — bigger radius = a shallower, more "realistic big clock"
  // curve instead of a tight little arc.
  var RADIUS_RATIO = 1.65;
  // px kept clear between a label's right edge and the fixed marker
  // dot, so the dot never sits on top of a letter regardless of
  // whether the label reads "2024" or "May 2026".
  var MARKER_GAP = 16;
  // desired vertical spacing (px) between adjacent items' centers —
  // the angular step is derived from this and the radius, instead of
  // being a fixed degree value, so spacing stays consistent even as
  // the radius (or the number of entries) changes.
  var ITEM_SPACING_PX = 128;

  function readItems() {
    var rows = document.querySelectorAll("#timeline-fallback .tl-item");
    var items = [];
    rows.forEach(function (row) {
      items.push({
        label: row.getAttribute("data-label") || "",
        date: row.querySelector(".tl-date") ? row.querySelector(".tl-date").textContent : "",
        title: row.querySelector(".tl-title") ? row.querySelector(".tl-title").textContent : "",
        org: row.querySelector(".tl-org") ? row.querySelector(".tl-org").textContent : "",
        desc: row.querySelector(".tl-desc") ? row.querySelector(".tl-desc").textContent : ""
      });
    });
    return items;
  }

  function init() {
    var dial = document.getElementById("exp-dial");
    var arc = document.getElementById("exp-arc");
    var panel = document.getElementById("exp-panel");
    var fallback = document.getElementById("timeline-fallback");
    if (!dial || !arc || !panel || !fallback) return;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // leave the plain timeline showing

    var items = readItems();
    if (items.length < 1) return;

    var circleEl = document.createElement("div");
    circleEl.className = "exp-arc-circle";
    arc.appendChild(circleEl);

    var activeIndex = 0;
    var numberEls = items.map(function (item, i) {
      var el = document.createElement("div");
      el.className = "exp-arc-number";
      el.textContent = item.label;
      el.addEventListener("click", function () { goTo(i, true); });
      arc.appendChild(el);
      return el;
    });

    var tickEls = items.map(function () {
      var el = document.createElement("div");
      el.className = "exp-arc-tick";
      arc.appendChild(el);
      return el;
    });

    var marker = document.createElement("div");
    marker.className = "exp-arc-marker";
    arc.appendChild(marker);

    function layout() {
      var w = arc.clientWidth;
      var h = arc.clientHeight;
      var R = h * RADIUS_RATIO; // big radius = gentle, realistic clock curve
      // the right edge every label lines up against — constant regardless
      // of R, so growing the radius only flattens the curve, it never
      // pushes labels closer to (or further from) the fixed marker
      var labelEdgeX = w - MARKER_GAP - 30;
      var cx = labelEdgeX - R;
      var cy = h / 2;

      // angular step derived from the radius so adjacent items keep a
      // consistent vertical gap on screen no matter how big R gets
      var angleStepDeg = (Math.asin(Math.min(0.9, ITEM_SPACING_PX / R)) * 180) / Math.PI;
      var fadeRangeDeg = angleStepDeg * 4;

      circleEl.style.left = (cx - R) + "px";
      circleEl.style.top = (cy - R) + "px";
      circleEl.style.width = R * 2 + "px";
      circleEl.style.height = R * 2 + "px";

      numberEls.forEach(function (el, i) {
        var angleDeg = (i - activeIndex) * angleStepDeg;
        var rad = (angleDeg * Math.PI) / 180;
        // x is where this item's point sits ON THE CIRCLE; every label is
        // then right-anchored (see CSS translate(-100%,-50%)) so its
        // trailing edge sits at that point and it grows *leftward*,
        // away from the marker, as the month/year text gets longer —
        // this is what keeps the dot from ever landing on a letter.
        var x = cx + R * Math.cos(rad);
        var y = cy + R * Math.sin(rad);
        var fade = Math.max(0, 1 - Math.abs(angleDeg) / fadeRangeDeg);
        el.style.transform =
          "translate(" + x + "px," + y + "px) translate(-100%,-50%) rotate(" + angleDeg + "deg)";
        el.style.opacity = fade.toFixed(3);
        el.classList.toggle("is-active", i === activeIndex);

        // clock-face tick mark on the circle itself at this item's angle
        var tick = tickEls[i];
        tick.style.left = x + "px";
        tick.style.top = y + "px";
        tick.style.transform = "rotate(" + angleDeg + "deg)";
        tick.style.opacity = fade.toFixed(3);
        tick.style.background = i === activeIndex ? "#D3A376" : "rgba(232,201,160,0.35)";
      });

      updateNeedle();
    }

    // The leader line from the fixed marker dot back toward the arc
    // (.exp-arc-marker::before) grows or shrinks with the active
    // label's own rendered width, so it always reaches from the dot
    // to just past the start of the text — never a fixed length that
    // happens to run under/through short labels or short of long ones.
    function updateNeedle() {
      var activeWidth = numberEls[activeIndex].offsetWidth; // offsetWidth ignores the transform, so it's safe mid-transition
      var len = activeWidth + MARKER_GAP + 26;
      marker.style.setProperty("--needle-len", len + "px");
    }

    function shake() {
      arc.classList.remove("is-shaking");
      void arc.offsetWidth; // force reflow so the animation can retrigger
      arc.classList.add("is-shaking");
    }

    function renderPanel(item) {
      panel.style.opacity = "0";
      panel.style.transform = "translateY(6px)";
      window.setTimeout(function () {
        panel.innerHTML = "";

        var dateEl = document.createElement("div");
        dateEl.className = "exp-panel-date";
        dateEl.textContent = item.date;
        panel.appendChild(dateEl);

        var labelEl = document.createElement("div");
        labelEl.className = "exp-panel-label";
        labelEl.textContent = item.label;
        panel.appendChild(labelEl);

        var titleEl = document.createElement("div");
        titleEl.className = "exp-panel-title";
        titleEl.textContent = item.title;
        panel.appendChild(titleEl);

        var orgEl = document.createElement("div");
        orgEl.className = "exp-panel-org";
        orgEl.textContent = item.org;
        panel.appendChild(orgEl);

        var descEl = document.createElement("div");
        descEl.className = "exp-panel-desc";
        descEl.textContent = item.desc;
        panel.appendChild(descEl);

        panel.style.opacity = "1";
        panel.style.transform = "translateY(0)";
      }, 180);
    }

    function goTo(index, fromClick) {
      index = Math.max(0, Math.min(items.length - 1, index));
      if (index === activeIndex && !fromClick) return;
      var changed = index !== activeIndex;
      activeIndex = index;
      layout();
      if (changed) {
        shake();
        renderPanel(items[activeIndex]);
      }
    }

    dial.hidden = false;
    fallback.hidden = true;
    layout();
    renderPanel(items[activeIndex]);

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(layout).observe(arc);
    } else {
      window.addEventListener("resize", layout);
    }

    // -- scroll-driven stepping ---------------------------------------
    // The section itself is pinned static by script.js's ScrollTrigger
    // while the dial steps through entries; only once the last entry is
    // reached does that pin release and the page scroll onward. So the
    // dial no longer reads scroll input itself — script.js calls
    // window.ExpDial.goToIndex() with the step derived from scrub
    // progress. (Clicking a label still jumps straight to it.)
    window.ExpDial = {
      itemCount: items.length,
      goToIndex: function (index) { goTo(index, false); }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();