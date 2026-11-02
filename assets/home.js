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

/* Walk with Mimi. One scroll handler drives the pinned wall (see the CSS): per poster a
   dwell where the wall rests, then an eased walk to the next. Lengths are measured on resize;
   each frame reads scrollY and writes three transforms plus, on a step change, a few
   classes. Reduced motion or a short screen keeps the static grid with every note showing. */
(function () {
  var section = document.querySelector("[data-walk]");
  if (!section) return;
  var live = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 560px)");
  var phone = window.matchMedia("(max-width: 700px)");
  var scroller = section.querySelector("[data-walk-scroller]");
  var stage = section.querySelector("[data-walk-stage]");
  var track = section.querySelector("[data-walk-track]");
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  var strip = section.querySelector("[data-walk-strip]");
  var still = section.querySelector(".walker-still");
  var sayN = section.querySelector("[data-walk-n]");
  var sayName = section.querySelector("[data-walk-name]");
  var names = stops.map(function (s) { return s.querySelector(".poster-name").textContent; });
  var N = stops.length, FRAMES = 12, STAND = 10, DWELL = 0.55;
  var top = 0, run = 1, step = 0, active = -1, lastPos = 0, ticking = false, on = false;

  // The wall clips the track at its left edge (CSS); it only exists for the live view.
  var wall = document.createElement("div");
  wall.className = "walk-wall";

  var film = document.createElement("span");
  film.className = "walker-film";
  strip.appendChild(film);

  var prog = document.createElement("div");
  prog.className = "walk-prog";
  prog.setAttribute("aria-hidden", "true");
  var dots = "";
  for (var d = 0; d < N; d++) dots += '<i class="walk-prog-dot" style="left:' + (d * 100 / (N - 1)).toFixed(3) + '%"></i>';
  prog.innerHTML = '<span class="walk-prog-at">01</span><span class="walk-prog-bar"><span class="walk-prog-fill"></span>' + dots + "</span><span>0" + N + "</span>";
  var at = prog.firstChild, fill = prog.querySelector(".walk-prog-fill"), dotEls = prog.querySelectorAll(".walk-prog-dot");

  // The walk sheet is the only Mimi image the live view needs; fetch it a screen ahead.
  if ("IntersectionObserver" in window) {
    var near = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { section.classList.add("is-near"); near.disconnect(); }
    }, { rootMargin: "100% 0px" });
    near.observe(section);
  } else section.classList.add("is-near");

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2; }

  function measure() {
    top = scroller.getBoundingClientRect().top + window.pageYOffset;
    run = Math.max(1, scroller.offsetHeight - stage.offsetHeight);
    step = N > 1 ? stops[1].offsetLeft - stops[0].offsetLeft : 0;
  }

  function light(i) {
    for (var k = 0; k < N; k++) {
      stops[k].classList.toggle("is-on", k === i);
      stops[k].classList.toggle("is-past", k < i);
      dotEls[k].classList.toggle("is-lit", k <= i);
    }
    at.textContent = sayN.textContent = "0" + (i + 1);
    sayName.textContent = names[i];
    active = i;
  }

  function tick() {
    ticking = false;
    var t = Math.min(Math.max((window.pageYOffset - top) / run, 0), 1) * N;
    var i = Math.min(N - 1, Math.floor(t));
    var move = i < N - 1 ? ease(Math.min(Math.max((t - i - DWELL) / (1 - DWELL), 0), 1)) : 0;
    var pos = i + move, here = Math.round(pos), dir = pos - lastPos;
    track.style.transform = "translate3d(" + (-pos * step).toFixed(1) + "px,0,0)";
    fill.style.transform = "scaleX(" + (pos / (N - 1)).toFixed(4) + ")";
    if (here !== active) light(here);
    // Walking: feet follow the distance covered, two strides per poster, and she leans
    // the way she is going. Resting: the standing frame, upright.
    var walking = move > 0 && move < 1 && dir !== 0;
    var f = walking ? Math.floor(pos * FRAMES * 2) % FRAMES : STAND;
    film.style.transform = "translateX(" + (-f * 100 / FRAMES).toFixed(4) + "%)";
    var lean = walking ? (dir > 0 ? "translateX(6px) rotate(2.5deg)" : "translateX(-6px) rotate(-2.5deg)") : "none";
    (phone.matches ? still : strip).style.transform = lean;
    lastPos = pos;
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }

  function mode() {
    on = live.matches;
    window.removeEventListener("scroll", onScroll);
    track.style.transform = still.style.transform = strip.style.transform = "";
    if (!on) {
      if (wall.parentNode) { stage.insertBefore(track, wall); wall.remove(); prog.remove(); }
      stops.forEach(function (s) { s.classList.remove("is-past"); });
      return;
    }
    if (!wall.parentNode) { stage.insertBefore(wall, track); wall.appendChild(track); stage.appendChild(prog); }
    measure();
    active = -1;
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Keyboard: Tab to a poster scrolls the page to that poster's dwell, so wall and focus agree.
  track.addEventListener("focusin", function (e) {
    var stop = e.target.closest("[data-stop]");
    if (!on || !stop) return;
    var i = stops.indexOf(stop);
    window.scrollTo(0, Math.round(top + run * (i + DWELL / 2) / N));
  });

  mode();
  live.addEventListener("change", mode);
  phone.addEventListener("change", mode);
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (on) { measure(); tick(); } }, 150); });
})();
