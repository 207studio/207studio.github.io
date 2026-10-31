/* 207 Studio home loader.
   The poster is the first paint. The clay engine wakes on idle so the hero is
   already moving before the first drag; reduced motion keeps the still poster. */

(function () {
  "use strict";

  var root = document.querySelector("[data-scene]");
  if (!root) return;

  var reduceMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hint = document.querySelector("[data-scene-hint]");
  var isKo = document.documentElement.lang === "ko";
  var started = false;
  var loading = false;
  var pending = null;
  var last = null;
  var released = false;

  function setHint() {
    if (!hint) return;
    hint.textContent = reduceMedia.matches
      ? isKo ? "정적 장면 · 모션 줄임" : "Static scene · reduced motion"
      : isKo ? "끌어서 밀어 보세요 · 놓으면 돌아와요" : "Drag the pieces · they settle back";
  }

  setHint();

  function dispatchPointer(canvas, type, event, x, y) {
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      clientX: x,
      clientY: y,
      buttons: 1
    }));
  }

  function loadScene() {
    if (started || loading || reduceMedia.matches) return;
    loading = true;

    var script = document.createElement("script");
    script.src = "/assets/scene.min.js";
    script.async = true;

    script.onload = function () {
      loading = false;
      if (typeof window.initClayScene !== "function") return;
      started = true;
      window.initClayScene();

      if (released || !pending || !last) return;
      var canvas = document.getElementById("clay-scene");
      if (!canvas) return;
      dispatchPointer(canvas, "pointerdown", pending.event, pending.x, pending.y);
      dispatchPointer(canvas, "pointermove", last.event, last.x, last.y);
    };

    script.onerror = function () {
      loading = false;
      pending = null;
    };

    document.head.appendChild(script);
  }

  function scheduleLoad() {
    if (started || loading || reduceMedia.matches) return;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadScene, { timeout: 1400 });
    } else {
      window.setTimeout(loadScene, 450);
    }
  }

  function onDown(event) {
    if (started || reduceMedia.matches) return;
    if (event.target.closest && event.target.closest("a, button, input, textarea, select, label")) return;
    pending = { id: event.pointerId, x: event.clientX, y: event.clientY, event: event };
    last = { x: event.clientX, y: event.clientY, event: event };
    released = false;
  }

  function onMove(event) {
    if (started || reduceMedia.matches || !pending || event.pointerId !== pending.id) return;
    last = { x: event.clientX, y: event.clientY, event: event };

    var dx = event.clientX - pending.x;
    var dy = event.clientY - pending.y;
    if (Math.sqrt(dx * dx + dy * dy) < 8) return;

    loadScene();
  }

  function onUp() {
    if (started || !pending) return;
    released = true;
  }

  if (reduceMedia.addEventListener) {
    reduceMedia.addEventListener("change", function (event) {
      setHint();
      if (!event.matches) scheduleLoad();
    });
  }

  root.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  var mimi = document.querySelector("[data-mimi]");
  if (mimi && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", function (event) {
      if (reduceMedia.matches) return;
      var nx = event.clientX / window.innerWidth - 0.5;
      var ny = event.clientY / window.innerHeight - 0.5;
      mimi.style.setProperty("--mimi-x", (nx * 14).toFixed(1) + "px");
      mimi.style.setProperty("--mimi-y", (ny * 8).toFixed(1) + "px");
    }, { passive: true });
  }

  if (document.readyState === "complete") {
    scheduleLoad();
  } else {
    window.addEventListener("load", scheduleLoad, { once: true });
  }
})();

/* Walk (treadmill): scroll -> distance s. Stop i sits at depth i + 1; while
   walking, s grows and every stop moves toward the viewer (translateZ); at each
   stop Mimi pauses and points to its side. Only transform/opacity change. */
(function () {
  "use strict";
  var section = document.querySelector("[data-walk]");
  if (!section || !window.requestAnimationFrame) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var walker = section.querySelector("[data-walker]");
  var sprite = section.querySelector("[data-walk-sprite]");
  var floor = section.querySelector("[data-walk-floor]");
  var stage = section.querySelector(".walk-stage");
  var stops = section.querySelectorAll("[data-stop]");
  var n = stops.length;
  var FRAMES = 12, STEPS = 3, SEG_VH = 120, WALK = 0.6, DEPTH = 1500, STRIPE = 160;
  var queued = false, here = -1, pose = "", frame = -1, cx = 0, cy = 0;

  section.classList.add("is-live");
  for (var i = 0; i < n; i++) stops[i].dataset.side = i % 2 ? "r" : "l";

  function measure() {
    section.style.height = (n * SEG_VH + 100) + "vh";
    var cs = getComputedStyle(stage);
    var probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:var(--cx);height:0";
    stage.appendChild(probe); cx = probe.getBoundingClientRect().width; stage.removeChild(probe);
    cy = parseFloat(cs.getPropertyValue("--cy")) / 100 * stage.clientHeight;
    update();
  }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function update() {
    queued = false;
    var range = section.offsetHeight - window.innerHeight;
    var p = Math.min(Math.max(-section.getBoundingClientRect().top / range, 0), 1);
    var t = Math.min(p * n, n - 1e-6);
    var k = Math.floor(t), u = t - k;
    var walking = u < WALK;
    var s = walking ? k + ease(u / WALK) : k + 1;

    for (var i = 0; i < n; i++) {
      var d = s - (i + 1);
      var z = d * DEPTH;
      var op = d < -1.9 ? 0 : d < -1 ? (d + 1.9) / 0.9 : d > 0.45 ? 0 : d > 0.15 ? (0.45 - d) / 0.3 : 1;
      var side = i % 2 ? 1 : -1;
      stops[i].style.transform = "translate3d(" + (side * cx).toFixed(1) + "px," + cy.toFixed(1) + "px," + z.toFixed(1) + "px)";
      stops[i].style.opacity = op.toFixed(3);
      stops[i].style.visibility = op > 0 ? "visible" : "hidden";
    }
    floor.style.transform = "translate3d(0," + ((s * DEPTH * 0.35) % STRIPE).toFixed(1) + "px,0)";

    var nh = walking ? (u / WALK > 0.75 ? k : -1) : k;
    if (nh !== here) {
      if (stops[here]) stops[here].classList.remove("is-here");
      here = nh;
      if (stops[here]) stops[here].classList.add("is-here");
    }
    var np = walking ? "" : (k % 2 ? "r" : "l");
    if (np !== pose) {
      walker.classList.remove("is-pointing-l", "is-pointing-r");
      if (np) walker.classList.add("is-pointing-" + np);
      pose = np;
    }
    if (walking) {
      var f = Math.floor(s * STEPS * FRAMES) % FRAMES;
      if (f !== frame) { frame = f; sprite.style.transform = "translate3d(" + (-f * 100 / FRAMES).toFixed(4) + "%,0,0)"; }
    }
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(update); } }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  measure();
})();
