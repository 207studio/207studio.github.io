/* 207 Studio home loader.
   The poster is the first paint; the 3D engine is fetched only when someone drags. */

(function () {
  "use strict";

  var root = document.querySelector("[data-scene]");
  if (!root) return;

  var reduceMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hint = document.querySelector("[data-scene-hint]");
  var isKo = document.documentElement.lang === "ko";

  function showStaticHint() {
    if (!hint) return;
    hint.textContent = isKo ? "정적 장면 · 모션 줄임" : "Static scene · reduced motion";
  }

  if (reduceMedia.matches) showStaticHint();

  var started = false;
  var loading = false;
  var pending = null;
  var last = null;
  var released = false;

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
    if (started || loading) return;
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

  function onDown(event) {
    if (started) return;
    pending = { id: event.pointerId, x: event.clientX, y: event.clientY, event: event };
    last = { x: event.clientX, y: event.clientY, event: event };
    released = false;
  }

  function onMove(event) {
    if (started || !pending || event.pointerId !== pending.id) return;
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
      if (event.matches) showStaticHint();
    });
  }

  root.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
})();
