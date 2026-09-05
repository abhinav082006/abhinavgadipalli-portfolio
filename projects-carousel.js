/* =========================================================
   Projects "Magnetic Carousel" — inspired by Originkit's Magnetic
   Carousel component (macOS dock-style proximity magnification of a
   row of image bars, click to expand into a large view). Ported to
   plain vanilla JS since there are no real project screenshots to
   use as bar images — each bar is instead a themed gradient "cover"
   card carrying the project's icon, in the same visual language as
   the site's edu-card (diagonal stripe texture, warm amber accents).

   Critically, none of the project data (title, description, tags,
   GitHub/demo links) is retyped here. It's read straight from the
   accessible list already in the page (#projects-fallback) — the
   link elements themselves are cloned verbatim into the modal, so
   the "View on GitHub" / "Live demo" links are guaranteed to keep
   working exactly as before, not a re-typed copy that could drift.

   If JS fails, WebGL isn't relevant here so that's not a gate — but
   prefers-reduced-motion still gets the plain accessible list, since
   the whole point of this component is a motion effect.
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = {
    collapsedWidth: 92,
    hoverWidth: 176,
    collapsedHeight: 260,
    hoverHeight: 310,
    influence: 190,
    ease: 0.18
  };

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function smoothstep(edge0, edge1, x) {
    var t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function readProjects() {
    var rows = document.querySelectorAll("#projects-fallback .project-row");
    var projects = [];
    rows.forEach(function (row) {
      var iconEl = row.querySelector(".proj-icon i");
      var iconClass = row.getAttribute("data-icon") || (iconEl ? iconEl.className : "fa-solid fa-star");
      var title = row.querySelector("h3");
      var date = row.querySelector(".proj-date");
      var desc = row.querySelector("p");
      var tags = row.querySelectorAll(".tech-tag");
      var links = row.querySelectorAll(".proj-link");
      projects.push({
        iconClass: iconClass,
        title: title ? title.textContent : "",
        date: date ? date.textContent : "",
        desc: desc ? desc.textContent : "",
        tagEls: tags,
        linkEls: links
      });
    });
    return projects;
  }

  function buildBar(project) {
    var bar = document.createElement("div");
    bar.className = "proj-bar";
    bar.style.width = CONFIG.collapsedWidth + "px";
    bar.style.height = CONFIG.collapsedHeight + "px";
    bar._curW = CONFIG.collapsedWidth;
    bar._curH = CONFIG.collapsedHeight;
    bar._targetW = CONFIG.collapsedWidth;
    bar._targetH = CONFIG.collapsedHeight;

    var icon = document.createElement("i");
    icon.className = project.iconClass + " proj-bar-icon";
    bar.appendChild(icon);

    var label = document.createElement("span");
    label.className = "proj-bar-label";
    label.textContent = project.title;
    bar.appendChild(label);

    bar.setAttribute("role", "button");
    bar.setAttribute("tabindex", "0");
    bar.setAttribute("aria-label", "View project: " + project.title);

    return bar;
  }

  function buildModalContent(project) {
    var body = document.createElement("div");
    body.className = "proj-modal-body";

    var head = document.createElement("div");
    head.className = "proj-head";
    var h3 = document.createElement("h3");
    h3.textContent = project.title;
    var dateSpan = document.createElement("span");
    dateSpan.className = "proj-date";
    dateSpan.textContent = project.date;
    head.appendChild(h3);
    head.appendChild(dateSpan);
    body.appendChild(head);

    var p = document.createElement("p");
    p.textContent = project.desc;
    body.appendChild(p);

    var tech = document.createElement("div");
    tech.className = "proj-tech";
    project.tagEls.forEach(function (tagEl) {
      tech.appendChild(tagEl.cloneNode(true));
    });
    body.appendChild(tech);

    var links = document.createElement("div");
    links.className = "proj-links";
    project.linkEls.forEach(function (linkEl) {
      // clone the REAL anchor — same href/target/rel/markup as the
      // accessible list, so these links behave exactly as before
      links.appendChild(linkEl.cloneNode(true));
    });
    body.appendChild(links);

    return body;
  }

  function init() {
    var carousel = document.getElementById("proj-carousel");
    var barsContainer = document.getElementById("proj-bars");
    var fallback = document.getElementById("projects-fallback");
    if (!carousel || !barsContainer || !fallback) return;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // leave the accessible list showing, untouched

    var projects = readProjects();
    if (!projects.length) return;

    var bars = projects.map(function (project) {
      var bar = buildBar(project);
      barsContainer.appendChild(bar);
      bar.addEventListener("click", function () { openProject(project, bar); });
      bar.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProject(project, bar);
        }
      });
      return bar;
    });

    // now that the carousel is actually built, swap views
    fallback.hidden = true;
    carousel.hidden = false;

    // -- magnetic dock hover --------------------------------------------
    var mouseX = null;
    var raf = 0;

    function tick() {
      var containerRect = barsContainer.getBoundingClientRect();
      bars.forEach(function (bar) {
        if (mouseX === null || carousel.classList.contains("has-open")) {
          bar._targetW = CONFIG.collapsedWidth;
          bar._targetH = CONFIG.collapsedHeight;
        } else {
          var rect = bar.getBoundingClientRect();
          var barCenter = rect.left + rect.width / 2 - containerRect.left + barsContainer.scrollLeft;
          var dist = Math.abs(mouseX - barCenter);
          var closeness = 1 - smoothstep(0, CONFIG.influence, dist);
          bar._targetW = CONFIG.collapsedWidth + (CONFIG.hoverWidth - CONFIG.collapsedWidth) * closeness;
          bar._targetH = CONFIG.collapsedHeight + (CONFIG.hoverHeight - CONFIG.collapsedHeight) * closeness;
        }
        bar._curW += (bar._targetW - bar._curW) * CONFIG.ease;
        bar._curH += (bar._targetH - bar._curH) * CONFIG.ease;
        bar.style.width = bar._curW + "px";
        bar.style.height = bar._curH + "px";
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    barsContainer.addEventListener("mousemove", function (e) {
      var containerRect = barsContainer.getBoundingClientRect();
      mouseX = e.clientX - containerRect.left + barsContainer.scrollLeft;
    });
    barsContainer.addEventListener("mouseleave", function () {
      mouseX = null;
    });

    // -- click-to-expand modal --------------------------------------------
    var backdrop = document.createElement("div");
    backdrop.className = "proj-backdrop";
    var modal = document.createElement("div");
    modal.className = "proj-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    var currentBar = null;

    function openProject(project, bar) {
      currentBar = bar;
      carousel.classList.add("has-open");
      bar.classList.add("is-open");

      modal.innerHTML = "";
      var cover = document.createElement("div");
      cover.className = "proj-modal-cover";
      var coverIcon = document.createElement("i");
      coverIcon.className = project.iconClass;
      cover.appendChild(coverIcon);
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "proj-modal-close";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.addEventListener("click", closeProject);
      cover.appendChild(closeBtn);
      modal.appendChild(cover);
      modal.appendChild(buildModalContent(project));

      requestAnimationFrame(function () {
        backdrop.classList.add("is-visible");
        modal.classList.add("is-visible");
      });
      document.body.style.overflow = "hidden";
    }

    function closeProject() {
      backdrop.classList.remove("is-visible");
      modal.classList.remove("is-visible");
      carousel.classList.remove("has-open");
      if (currentBar) currentBar.classList.remove("is-open");
      currentBar = null;
      document.body.style.overflow = "";
    }

    backdrop.addEventListener("click", closeProject);
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-visible")) closeProject();
    });

    window.addEventListener("beforeunload", function () {
      cancelAnimationFrame(raf);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();