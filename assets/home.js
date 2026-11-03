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

  if (document.readyState === "complete") {
    scheduleLoad();
  } else {
    window.addEventListener("load", scheduleLoad, { once: true });
  }
})();

/* Walk. One scroll handler drives the pinned stage (see the CSS): per app a dwell where its
   card rests in front, then an eased change where it falls back in depth and the next card
   rises to the front. Mimi walks in place during a change and her bubble fades out and back
   with the next app's line. Reduced motion or a short screen keeps the static grid. */
(function () {
  var section = document.querySelector("[data-walk]");
  if (!section) return;
  var live = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 560px)");
  var scroller = section.querySelector("[data-walk-scroller]");
  var stage = section.querySelector("[data-walk-stage]");
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  var N = stops.length, DWELL = 0.55, BACK = -420, DEPTH = -600, NEAR = 0.8;
  var top = 0, run = 1, active = -1, ticking = false, on = false;

  var mimi = document.createElement("div");
  mimi.className = "walk-mimi";
  mimi.setAttribute("aria-hidden", "true");
  var say = document.createElement("p");
  say.className = "walk-say";
  say.setAttribute("aria-hidden", "true");

  var prog = document.createElement("div");
  prog.className = "walk-prog";
  prog.setAttribute("aria-hidden", "true");
  var dots = "";
  for (var d = 0; d < N; d++) dots += '<i class="walk-prog-dot" style="left:' + (d * 100 / (N - 1)).toFixed(3) + '%"></i>';
  prog.innerHTML = '<span class="walk-prog-at">01</span><span class="walk-prog-bar"><span class="walk-prog-fill"></span>' + dots + "</span><span>0" + N + "</span>";
  var at = prog.firstChild, fill = prog.querySelector(".walk-prog-fill"), dotEls = prog.querySelectorAll(".walk-prog-dot");

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2; }

  function measure() {
    top = scroller.getBoundingClientRect().top + window.pageYOffset;
    run = Math.max(1, scroller.offsetHeight - stage.offsetHeight);
  }

  function light(i) {
    for (var k = 0; k < N; k++) {
      stops[k].classList.toggle("is-on", k === i);
      dotEls[k].classList.toggle("is-lit", k <= i);
    }
    at.textContent = "0" + (i + 1);
    say.textContent = stops[i].getAttribute("data-say");
    active = i;
  }

  // Depth and opacity for card k while card i hands over to i + 1 (move runs 0 to 1).
  // The old card is mostly gone by the midpoint and the new one paints over it, so the two
  // never read as one muddle of half-opaque text.
  function place(k, i, move) {
    var z = 0, o = 0, out = Math.min(1, move * 1.6);
    if (k === i) { z = BACK * out; o = 1 - out; }
    else if (k === i + 1) { z = DEPTH * (1 - move); o = Math.min(1, Math.max(0, (move - 0.15) / 0.35)); }
    stops[k].style.transform = "translate3d(0,0," + z.toFixed(1) + "px)";
    stops[k].style.opacity = o.toFixed(3);
  }

  function tick() {
    ticking = false;
    var t = Math.min(Math.max((window.pageYOffset - top) / run, 0), 1) * N;
    var i = Math.min(N - 1, Math.floor(t));
    var move = i < N - 1 ? ease(Math.min(Math.max((t - i - DWELL) / (1 - DWELL), 0), 1)) : 0;
    var pos = i + move, here = Math.round(pos);
    for (var k = 0; k < N; k++) place(k, i, move);
    // Mimi walks toward the viewer the whole way: the walk cycle runs in CSS, and she grows
    // from NEAR to full size as the tour goes from the first app to the last.
    section.style.setProperty("--mimi-s", (NEAR + (1 - NEAR) * pos / (N - 1)).toFixed(4));
    say.style.opacity = Math.min(1, Math.abs(move - 0.5) * 2).toFixed(3);
    fill.style.transform = "scaleX(" + (pos / (N - 1)).toFixed(4) + ")";
    if (here !== active) light(here);
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }

  function mode() {
    on = live.matches;
    window.removeEventListener("scroll", onScroll);
    if (!on) {
      [mimi, say, prog].forEach(function (el) { el.remove(); });
      stops.forEach(function (s) { s.style.transform = ""; s.style.opacity = ""; });
      return;
    }
    stage.appendChild(mimi);
    stage.appendChild(say);
    stage.appendChild(prog);
    measure();
    active = -1;
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // The walk cycle only runs while the stage is on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      mimi.classList.toggle("is-walking", entries[0].isIntersecting);
    }).observe(stage);
  } else {
    mimi.classList.add("is-walking");
  }

  // Keyboard: Tab to a card scrolls the page to that card's dwell, so the stage and focus agree.
  section.querySelector("[data-walk-track]").addEventListener("focusin", function (e) {
    var stop = e.target.closest("[data-stop]");
    if (!on || !stop) return;
    var i = stops.indexOf(stop);
    window.scrollTo(0, Math.round(top + run * (i + DWELL / 2) / N));
  });

  mode();
  live.addEventListener("change", mode);
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (on) { measure(); tick(); } }, 150); });
})();
