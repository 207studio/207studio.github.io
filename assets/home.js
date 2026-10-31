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

/* Walk: scroll position -> track offset + walk-cycle frame. Each stop owns one
   segment of scroll: the first half walks in, the second half stops and points.
   Only transform/opacity change; one rAF per scroll burst. */
(function () {
  "use strict";
  var section = document.querySelector("[data-walk]");
  if (!section || !window.requestAnimationFrame) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var track = section.querySelector("[data-walk-track]");
  var walker = section.querySelector("[data-walker]");
  var sprite = section.querySelector("[data-walk-sprite]");
  var stops = section.querySelectorAll("[data-stop]");
  var n = stops.length;
  var FRAMES = 8, STEPS_PER_STOP = 2.5, SEG_VH = 110;
  var queued = false, here = -1, pointing = null, frame = -1;

  section.classList.add("is-live");

  function size() {
    section.style.height = (n * SEG_VH + 100) + "vh";
    update();
  }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function update() {
    queued = false;
    var rect = section.getBoundingClientRect();
    var range = section.offsetHeight - window.innerHeight;
    var p = Math.min(Math.max(-rect.top / range, 0), 1);
    var t = Math.min(p * n, n - 1e-6);
    var k = Math.floor(t), u = t - k;
    var walking = u < 0.5;
    var pos = walking ? k - 1 + ease(u / 0.5) : k;
    track.style.transform = "translate3d(" + (-pos * 100) + "%,0,0)";

    if (walking !== pointing) {
      pointing = walking;
      walker.classList.toggle("is-pointing", !walking);
    }
    var nh = walking ? k - 1 : k;
    if (!walking || u > 0.4) nh = k;
    if (nh !== here) {
      if (stops[here]) stops[here].classList.remove("is-here");
      here = nh;
      if (stops[here]) stops[here].classList.add("is-here");
    }
    if (walking) {
      var f = Math.floor((pos + 1) * STEPS_PER_STOP * FRAMES) % FRAMES;
      if (f < 0) f += FRAMES;
      if (f !== frame) {
        frame = f;
        sprite.style.transform = "translate3d(" + (-f * 12.5) + "%,0,0)";
      }
      var bob = Math.abs(Math.sin((pos + 1) * STEPS_PER_STOP * Math.PI * 2)) * -4;
      walker.style.transform = "translate3d(0," + bob.toFixed(1) + "px,0)";
    } else {
      walker.style.transform = "";
    }
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(update); } }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", size);
  size();
})();
