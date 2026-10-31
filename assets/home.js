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

/* Walk with Mimi. Scroll position -> one smoothed number t (0..n+tail) -> poses.
   Per stop k, in units of t:
     k+0.00 .. k+0.40  walk; card k slides in from the right edge and comes to rest
     k+0.40 .. k+0.48  raise the pointer (same hand): raise frames 0, 2, 3, then point
     k+0.48 .. k+0.74  point; card k is lit
     k+0.74 .. k+0.82  lower the pointer (raise frames reversed)
     k+0.82 .. k+1.00  walk on; card k leaves k+0.84 .. k+1.02, before card k+1 shows
   Cards are fully still while she raises, points and lowers, and never overlap.
   Only transform/opacity change per frame; layout is read on resize only. */
(function () {
  "use strict";
  var section = document.querySelector("[data-walk]");
  if (!section || !window.requestAnimationFrame) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) return;

  var run = section.querySelector("[data-walk-run]");
  var sticky = section.querySelector("[data-walk-sticky]");
  var stage = section.querySelector("[data-walk-stage]");
  var walker = section.querySelector("[data-walker]");
  var shadow = section.querySelector("[data-walk-shadow]");
  var walkImg = section.querySelector('[data-sprite="walk"]');
  var raiseImg = section.querySelector('[data-sprite="raise"]');
  var pointImg = section.querySelector('[data-sprite="point"]');
  var countEl = section.querySelector("[data-walk-count]");
  var barEl = section.querySelector("[data-walk-bar]");
  var cue = section.querySelector("[data-walk-cue]");
  var stops = section.querySelectorAll(".stop");
  var n = stops.length;
  if (!run || !sticky || !walker || !walkImg || !raiseImg || !pointImg || !n) return;

  var TAIL = 0.5, UNIT_SVH = 120;
  var ENTER = 0.40, RAISE0 = 0.40, RAISE1 = 0.48, LOWER0 = 0.74, LOWER1 = 0.82;
  var EXIT0 = 0.84, EXIT1 = 1.02, ENTER_DELAY = 0.03;
  var RAISE_FRAMES = [0, 2, 3];            // frame 1 hides the pointer; skip it
  var FRAMES_PER_UNIT = 30;                // walk frames per unit of walking time

  var cur = 0, target = 0, last = 0, ticking = false, inView = false;
  var mw = 0, travel = 0, layout = [], state = [], pose = "", frameKey = "", here = -2, shown = "";
  var dpr = Math.max(1, window.devicePixelRatio || 1);

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function snap(px) { return Math.round(px * dpr) / dpr; }

  /* Time spent walking before t, so her stride follows the distance covered. */
  function walked(t) {
    var k = Math.floor(t), u = t - k, w = k * (ENTER + (1 - LOWER1));
    if (k >= n) return n * (ENTER + (1 - LOWER1)) + u;
    return w + Math.min(u, ENTER) + Math.max(0, u - LOWER1);
  }

  function measure() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    var vh = sticky.clientHeight || window.innerHeight;
    var vw = stage.clientWidth;
    var mobile = vw <= 700;
    // Same height as the hero Mimi: clamp(540px, 100svh - 320px, 640px), 320px on phones.
    var h = mobile ? 320 : clamp(vh - 320, 540, 640);
    var gb = mobile ? Math.max(18, vh * 0.03) : Math.max(28, vh * 0.05);
    var top = mobile ? 78 : 104;            // clear the floating dock
    h = Math.min(h, vh - gb - top - (mobile ? 0 : 20));
    if (mobile && vh < 700) h = Math.min(h, Math.round(vh * 0.46));
    h = Math.round(h);
    mw = snap(h * 214 / 400);
    var gutter = mobile ? 16 : Math.max(32, (vw - 1240) / 2);
    var mx = mobile ? Math.max(4, vw * 0.02) : Math.max(gutter - 10, vw * 0.29 - mw / 2);
    stage.style.setProperty("--h", h + "px");
    stage.style.setProperty("--mw", mw + "px");
    stage.style.setProperty("--mx", mx + "px");
    stage.style.setProperty("--gb", gb + "px");
    walkImg.style.width = (mw * 12) + "px";
    raiseImg.style.width = (mw * 4) + "px";

    // The pointer tip sits at 98% across and 20% down the point frame.
    var tipX = mx + mw * 0.98, tipY = vh - gb - h * 0.8;
    var mimiTop = vh - gb - h;
    var sideRoom = vw - gutter - (tipX + 28);
    var side = sideRoom >= 300;
    var cw, left;
    if (side) {
      cw = Math.min(560, sideRoom);
      left = tipX + Math.max(28, Math.min(72, (sideRoom - cw) * 0.5 + 28));
    } else {
      cw = Math.min(vw - 32, Math.max(250, Math.min(320, vw * 0.7)));
      left = vw - 16 - cw;
    }
    stage.classList.remove("is-tight");
    for (var i = 0; i < n; i++) stops[i].style.width = cw + "px";
    var tallest = 0;
    for (i = 0; i < n; i++) tallest = Math.max(tallest, stops[i].offsetHeight);
    var maxBottom = side ? vh - gb - 8 : mimiTop - 14;
    if (tallest > maxBottom - top) {
      stage.classList.add("is-tight");
      tallest = 0;
      for (i = 0; i < n; i++) tallest = Math.max(tallest, stops[i].offsetHeight);
    }
    layout = [];
    for (i = 0; i < n; i++) {
      var ch = stops[i].offsetHeight;
      // Side by side: the tip lines up with the middle of the card. Stacked: the card
      // sits above-right of her head, where the raised pointer aims.
      var y = side ? tipY - ch * 0.5 : maxBottom - ch;
      y = clamp(y, top, Math.max(top, maxBottom - ch));
      stops[i].style.top = Math.round(y) + "px";
      stops[i].style.left = Math.round(left) + "px";
      layout.push(ch);
    }
    travel = vw - left + 40;                // from rest to fully past the right edge
    run.style.height = "calc(" + Math.round((n + TAIL) * UNIT_SVH) + "svh + 100svh)";
    state = [];
    frameKey = ""; shown = ""; pose = "";
    target = readTarget(); cur = target;
    render(cur);
  }

  function readTarget() {
    var range = run.offsetHeight - sticky.offsetHeight;
    if (range <= 0) return 0;
    var p = clamp(-run.getBoundingClientRect().top / range, 0, 1);
    return p * (n + TAIL);
  }

  function setPose(p) {
    if (p !== pose) { pose = p; walker.setAttribute("data-pose", p); }
  }

  function render(t) {
    t = clamp(t, 0, n + TAIL - 1e-6);
    var k = Math.min(Math.floor(t), n), u = t - k;

    // Cards.
    for (var i = 0; i < n; i++) {
      var x = 0, y = 0, z = 0, ry = 0, op = 1;
      var a = t - i;                        // local time for card i
      if (a < ENTER_DELAY) { op = 0; x = travel; }
      else if (a < ENTER) {
        var e = easeOut(clamp((a - ENTER_DELAY) / (ENTER - ENTER_DELAY), 0, 1));
        var r = 1 - e;
        x = r * travel; y = r * 40; z = r * 120; ry = -r * 14;
        op = clamp((a - ENTER_DELAY) / (ENTER * 0.4), 0, 1);
      } else if (a > EXIT0) {
        var q = clamp((a - EXIT0) / (EXIT1 - EXIT0), 0, 1), f = q * q;
        x = f * travel * 1.05; y = -f * 36; z = f * 280; ry = -f * 20;
        op = 1 - clamp((q - 0.3) / 0.7, 0, 1);
      }
      var st = state[i] || (state[i] = {});
      var vis = op > 0.002;
      // At rest the card drops its transform so the text renders crisp.
      var moving = x !== 0 || y !== 0 || z !== 0;
      var tf = !vis ? "" : moving ? "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px," + z.toFixed(1) + "px) rotateY(" + ry.toFixed(2) + "deg)" : "none";
      if (vis && tf !== st.tf) { st.tf = tf; stops[i].style.transform = tf; }
      var o = vis ? op.toFixed(3) : "0";
      if (o !== st.o) { st.o = o; stops[i].style.opacity = o; }
      if (vis !== st.vis) { st.vis = vis; stops[i].style.visibility = vis ? "visible" : "hidden"; }
    }

    // Mimi.
    var key;
    if (k < n && u >= RAISE0 && u < LOWER1) {
      var phase;
      if (u < RAISE1) phase = clamp((u - RAISE0) / (RAISE1 - RAISE0), 0, 0.999);
      else if (u < LOWER0) phase = 1;
      else phase = clamp((LOWER1 - u) / (LOWER1 - LOWER0), 0, 0.999);
      if (phase >= 1) { setPose("point"); key = "p"; }
      else {
        var ri = RAISE_FRAMES[Math.floor(phase * RAISE_FRAMES.length)];
        setPose("raise"); key = "r" + ri;
        if (key !== frameKey) raiseImg.style.transform = "translate3d(" + (-ri * mw) + "px,0,0)";
      }
    } else {
      var w = walked(t) * FRAMES_PER_UNIT;
      var fi = Math.floor(w) % 12;
      setPose("walk"); key = "w" + fi;
      if (key !== frameKey) {
        walkImg.style.transform = "translate3d(" + (-fi * mw) + "px,0,0)";
        // Contact shadow tightens a touch on each footfall (two per cycle).
        var sw = 1 - 0.07 * Math.abs(Math.sin((w / 12) * Math.PI * 2));
        if (shadow) shadow.style.transform = "scale(" + sw.toFixed(3) + ",1)";
      }
    }
    frameKey = key;

    var pointing = k < n && u >= RAISE1 && u < LOWER0;
    var nh = pointing ? k : -1;
    if (nh !== here) {
      if (stops[here]) stops[here].classList.remove("is-here");
      here = nh;
      if (stops[here]) stops[here].classList.add("is-here");
    }

    // The counter moves on as soon as the previous card starts to leave.
    var c = clamp(Math.floor(t - ENTER_DELAY) + 1, 1, n);
    var label = (c < 10 ? "0" : "") + c;
    if (label !== shown && countEl) { shown = label; countEl.textContent = label; }
    if (barEl) barEl.style.transform = "scaleX(" + (t / (n + TAIL)).toFixed(4) + ")";
    if (cue) cue.classList.toggle("is-gone", t > 0.08);
  }

  function tick(now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    var d = target - cur;
    // Critically damped follow, about 110ms to settle: the scrub feels weighted, not laggy.
    cur += d * (1 - Math.exp(-dt / 0.11));
    if (Math.abs(target - cur) < 0.0005) cur = target;
    render(cur);
    if (cur !== target && inView) requestAnimationFrame(tick);
    else ticking = false;
  }

  function onScroll() {
    if (!inView) return;
    target = readTarget();
    if (!ticking) { ticking = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  function decodeAll() {
    var imgs = [walkImg, raiseImg, pointImg];
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].loading = "eager";
      if (imgs[i].decode) imgs[i].decode().catch(function () {});
    }
  }

  section.classList.add("is-live");
  setPose("walk");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) { decodeAll(); onScroll(); }
    }, { rootMargin: "50% 0px" }).observe(run);
  } else { inView = true; decodeAll(); }

  // A keyboard user tabbing to a visible card should see it at rest.
  stage.addEventListener("focusin", function (event) {
    for (var i = 0; i < n; i++) {
      if (stops[i].contains(event.target)) {
        var range = run.offsetHeight - sticky.offsetHeight;
        var want = (i + (RAISE1 + LOWER0) / 2) / (n + TAIL);
        var y = run.getBoundingClientRect().top + window.pageYOffset + want * range;
        window.scrollTo(0, y);
        target = cur = readTarget();
        render(cur);
        return;
      }
    }
  });

  var rz = 0;
  window.addEventListener("resize", function () {
    if (rz) cancelAnimationFrame(rz);
    rz = requestAnimationFrame(function () { rz = 0; measure(); });
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  if (reduce.addEventListener) reduce.addEventListener("change", function () { window.location.reload(); });
  measure();
})();
