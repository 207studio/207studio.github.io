/* 207 Studio: the header menu and the look choice. Load with defer on every page. Needs assets/look.js (window.__look). */
(function () {
  var menu = document.querySelector("[data-menu]");
  function sync() {
    var pref = window.__look ? window.__look.get() : "system";
    [].forEach.call(document.querySelectorAll("[data-look-set]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-look-set") === pref));
    });
  }
  document.addEventListener("click", function (e) {
    var t = e.target, set = t.closest && t.closest("[data-look-set]");
    if (set && window.__look) { window.__look.set(set.getAttribute("data-look-set")); sync(); return; }
    if (menu && menu.open && (!menu.contains(t) || (t.closest && t.closest(".menu-pop a")))) menu.open = false;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu && menu.open) {
      menu.open = false;
      var s = menu.querySelector("summary");
      if (s) s.focus();
    }
  });
  sync();
})();

/* The sky in depth: the apps' star parallax (유일 님, 2026-11-18: going down the page the stars rise a little behind it, going back
   up they sink). Each .sky-tile moves by its share of the scroll (--depth, tokens) and wraps by its tile height (--wrap). Transform
   only: one passive scroll listener, at most one animation frame waiting, one translate3d per layer. At rest nothing runs. Under
   "reduce motion" nothing moves. */
(function () {
  var sky = document.querySelector(".sky");
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!sky || !calm.addEventListener) return;
  var layers = [], waiting = false, rest = 0;

  function measure() {
    layers = [].slice.call(sky.querySelectorAll(".sky-tile")).map(function (el) {
      var cs = getComputedStyle(el);
      return { el: el, on: cs.display !== "none", share: parseFloat(cs.getPropertyValue("--depth")) || 0, wrap: parseFloat(cs.getPropertyValue("--wrap")) || 0 };
    }).filter(function (l) { return l.on && l.share > 0 && l.wrap > 0; });
  }

  function paint() {
    waiting = false;
    var y = window.pageYOffset;
    layers.forEach(function (l) { l.el.style.transform = "translate3d(0," + (-((y * l.share) % l.wrap)).toFixed(2) + "px,0)"; });
  }

  function onScroll() {
    sky.setAttribute("data-moving", "");
    clearTimeout(rest);
    rest = setTimeout(function () { sky.removeAttribute("data-moving"); }, 160);
    if (!waiting) { waiting = true; requestAnimationFrame(paint); }
  }

  function mode() {
    window.removeEventListener("scroll", onScroll);
    if (calm.matches) {
      layers.forEach(function (l) { l.el.style.transform = ""; });
      sky.removeAttribute("data-moving");
      return;
    }
    measure();
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  mode();
  calm.addEventListener("change", mode);
  window.addEventListener("resize", function () { if (!calm.matches) { measure(); paint(); } });
})();
