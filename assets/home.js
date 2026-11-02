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

/* Walk with Mimi. The grid stays put; scroll lights one poster at a time.
   Steps come from one invisible sentinel per poster and one IntersectionObserver watching the line
   across the middle of the viewport. Pinned (wide and tall, set in CSS): the sentinels split
   the scroller's extra height evenly. Otherwise they split the poster list. Reduced
   motion keeps the static grid with every note showing. */
(function () {
  var section = document.querySelector("[data-walk]");
  if (!section || !("IntersectionObserver" in window)) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var pinned = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-width: 1180px) and (min-height: 820px)");
  var scroller = section.querySelector("[data-walk-scroller]");
  var stage = section.querySelector("[data-walk-stage]");
  var track = section.querySelector("[data-walk-track]");
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  var strip = section.querySelector("[data-walk-strip]");
  var sayN = section.querySelector("[data-walk-n]");
  var sayName = section.querySelector("[data-walk-name]");
  var names = stops.map(function (s) { return s.querySelector(".poster-name").textContent; });
  var FRAMES = 12, STAND = 10, LEAN = 14;
  var active = 0, io = null, sentinels = [], timer = 0;

  function frame(f) { if (strip) strip.style.backgroundPositionX = (f * 100 / (FRAMES - 1)).toFixed(4) + "%"; }
  function walk() {
    var n = 0;
    clearInterval(timer);
    timer = setInterval(function () {
      n += 1;
      frame(n >= FRAMES ? STAND : (STAND + n) % FRAMES);
      if (n >= FRAMES) clearInterval(timer);
    }, 45);
  }

  function set(i) {
    if (i === active) return;
    stops[active].classList.remove("is-on");
    stops[i].classList.add("is-on");
    active = i;
    if (sayN) sayN.textContent = "0" + (i + 1);
    if (sayName) sayName.textContent = names[i];
    var cols = pinned.matches ? 3 : 1;
    section.style.setProperty("--lean", (i % cols) * LEAN + "px");
    if (!reduce.matches) walk();
  }

  function build() {
    if (io) io.disconnect();
    sentinels.forEach(function (s) { s.remove(); });
    sentinels = [];
    if (reduce.matches) return;
    var host = pinned.matches ? scroller : stage;
    for (var i = 0; i < stops.length; i++) {
      var s = document.createElement("span");
      s.setAttribute("aria-hidden", "true");
      s.style.cssText = "position:absolute;left:0;width:1px;pointer-events:none;visibility:hidden";
      s.dataset.i = i;
      host.appendChild(s);
      sentinels.push(s);
    }
    place();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) set(+e.target.dataset.i); });
    }, { rootMargin: "-50% 0px -50% 0px" });
    sentinels.forEach(function (s) { io.observe(s); });
  }

  // Pinned: the stage sticks while the middle line runs from half a screen into the
  // scroller to half a screen before its end; that run is split evenly.
  function place() {
    var n = stops.length;
    if (pinned.matches) {
      var half = stage.offsetHeight / 2, seg = (scroller.offsetHeight - stage.offsetHeight) / n;
      sentinels.forEach(function (s, i) { s.style.top = half + i * seg + "px"; s.style.height = seg + "px"; });
    } else {
      // Not pinned: each row of posters owns the scroll from its top to the next row's top,
      // shared equally by the posters in it, so steps follow the cards in reading order.
      var rows = [], end = track.offsetTop + track.offsetHeight;
      stops.forEach(function (st, i) {
        var last = rows[rows.length - 1];
        if (last && Math.abs(last.top - st.offsetTop) < 4) last.ids.push(i);
        else rows.push({ top: st.offsetTop, ids: [i] });
      });
      rows.forEach(function (r, k) {
        var h = ((rows[k + 1] ? rows[k + 1].top : end) - r.top) / r.ids.length;
        r.ids.forEach(function (i, j) { sentinels[i].style.top = r.top + j * h + "px"; sentinels[i].style.height = h + "px"; });
      });
    }
  }

  // Keyboard: focus lights its step; pinned, the page scrolls to that step so the two agree.
  track.addEventListener("focusin", function (e) {
    var stop = e.target.closest("[data-stop]");
    if (!stop) return;
    var i = stops.indexOf(stop);
    if (pinned.matches && i !== active) {
      var seg = (scroller.offsetHeight - stage.offsetHeight) / stops.length;
      var top = scroller.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo(0, Math.round(top + i * seg + seg / 2));
    }
    set(i);
  });

  build();
  var onMode = function () { build(); };
  if (pinned.addEventListener) { pinned.addEventListener("change", onMode); reduce.addEventListener("change", onMode); }
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(place, 150); });
})();
