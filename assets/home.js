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

/* Walk with Mimi. Scroll drives one timeline, measured in "stops" (t from 0 to TOTAL).
   Stop i owns [b, b + 1) with b = INTRO + i:
     b+0.14..b+0.40  poster i slides in from the near (right) edge while she walks
     b+0.40..b+0.48  she raises the pointer (raise frames 0, 2, 3; frame 1 is blurred)
     b+0.48..b+0.84  she points; the poster is lit
     b+0.84..b+0.92  she lowers it (same frames reversed)
     b+0.92..b+1.12  she walks on; the poster falls behind toward the vanishing point
   Mimi never moves sideways: her box is centred on the hero Mimi and keeps the hero's
   height (shrunk only when a poster could not otherwise fit above her head). The camera
   backs up with her, so the wall streams away from the viewer: seams and posters recede
   toward the vanishing point and nothing grows out of the distance.
   Every walk between stops lasts WALK_GAP and covers exactly two 12-frame cycles, so
   each arrival lands on walk frame 4, the stride closest to raise frame 0.
   Smoothing: the drawn time eases toward the scroll time, like a short scrub. */
(function () {
  "use strict";
  var section = document.querySelector("[data-walk]");
  if (!section || !window.requestAnimationFrame) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var scroller = section.querySelector("[data-walk-scroller]");
  var stage = section.querySelector("[data-walk-stage]");
  var walker = section.querySelector("[data-walker]");
  var walkImg = section.querySelector("[data-walk-strip]");
  var raiseImg = section.querySelector("[data-raise-strip]");
  var pointImg = section.querySelector("[data-point]");
  var floor = section.querySelector("[data-walk-floor]");
  var end = section.querySelector("[data-walk-end]");
  var face = section.querySelector("[data-wall-face]");
  var ledge = section.querySelector("[data-wall-ledge]");
  var seams = [].slice.call(section.querySelectorAll("[data-seam]"));
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  var fills = [].slice.call(section.querySelectorAll("[data-rail-fill]"));
  var railItems = fills.map(function (f) { return f.parentNode; });
  var rail = railItems.length ? railItems[0].parentNode : null;
  var hero = document.querySelector("[data-mimi]");
  var walkLayer = walkImg.parentNode, raiseLayer = raiseImg.parentNode;
  var n = stops.length;

  var INTRO = 0.25, ARRIVE = 0.40, RAISED = 0.48, LOWER = 0.84, LEFT = 0.92;
  var ENTER = 0.14, EXIT_END = 1.12, LIT_A = 0.44, LIT_B = 0.88;
  var WALK_GAP = (1 - LEFT) + ARRIVE;          // 0.48
  var FPS_UNIT = 24 / WALK_GAP;                // walk frames per walked unit
  var LAND = 4;                                // walk frame on arrival
  var END_AT = INTRO + n, STAND = END_AT + ARRIVE, TOTAL = STAND + 0.35;
  var SEG_SVH = 96;
  var RAISE_SEQ = [0, 2, 3];
  // Depth: s = 1 / (1 - d) is the on-screen scale of something d units from the posters'
  // resting depth (d < 0 is behind). The camera backs up DEPTH_GAP units per walk.
  var DEPTH_GAP = 0.6, KZ = DEPTH_GAP / WALK_GAP, SEAM_GAP = 0.25, SEAM_S0 = 0.3;
  var GAP = 14, MIN_MH = 220, LEDGE = 10, EDGE_PAD = 12;  // EDGE_PAD < poster right padding

  var vw = 0, vh = 0, mobile = false, range = 1, top0 = 0;
  var aL = 0, aB = 0, pw = 0, vpx = 0, vpy = 0, lw = 1, wallTop = 0, travel = 0;
  var dHi = 0, dLo = 0, heights = [];
  var cur = -1, target = 0, last = 0, running = false, ready = false;
  var memo = [], drawn = {};

  section.classList.add("is-live");
  scroller.style.height = (TOTAL * SEG_SVH + 100) + "vh";
  scroller.style.height = (TOTAL * SEG_SVH + 100) + "svh";

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function px(v) { return Math.round(v) + "px"; }
  function opac(v) { return v < 0.002 ? "0" : v > 0.998 ? "1" : v.toFixed(3); }
  function put(el, key, prop, val) {
    var m = memo[key] || (memo[key] = {});
    if (m[prop] !== val) { m[prop] = val; el.style[prop] = val; }
  }

  // The hero Mimi's box in page pixels, ignoring her pointer-follow nudge (a translate).
  function heroBox() {
    if (!hero || !hero.offsetHeight) return null;
    var x = 0;
    for (var el = hero; el; el = el.offsetParent) x += el.offsetLeft;
    return { cx: x + hero.offsetWidth / 2, h: hero.offsetHeight };
  }

  function layout() {
    var i, ph = 0;
    vw = stage.clientWidth; vh = stage.clientHeight;
    mobile = vw <= 700;
    var dock = mobile ? 76 : 92;
    var side = mobile ? 12 : Math.round(Math.max(24, vw * 0.033));
    ["--mh", "--mw", "--mx", "--mb"].forEach(function (p) { stage.style.removeProperty(p); });

    // Posters: right-aligned on the wall, bottoms on one line just above her head.
    pw = mobile ? vw - side * 2 : Math.min(780, vw - side * 2);
    aL = vw - side - pw;
    heights = [];
    for (i = 0; i < n; i++) { stops[i].style.width = pw + "px"; heights[i] = stops[i].offsetHeight; ph = Math.max(ph, heights[i]); }
    end.style.width = Math.min(mobile ? pw : 460, 460) + "px";
    var eh = end.offsetHeight;

    var hb = heroBox();
    var H = hb ? hb.h : walker.offsetHeight;
    var cx = hb ? hb.cx : walker.offsetLeft + walker.offsetWidth / 2;
    var mb = mobile ? 20 : 24;
    var room = vh - mb - H - GAP - Math.max(ph, mobile ? eh : 0) - dock;
    if (room < 0) H = Math.max(MIN_MH, Math.floor(H + room));       // short screens only
    else if (room > 24) mb += Math.round(room / 3);                 // lift the pair a little
    var mw = H * 0.535, ml = cx - mw / 2, wt = vh - mb - H;
    stage.style.setProperty("--mh", H + "px");
    stage.style.setProperty("--mw", mw.toFixed(2) + "px");
    stage.style.setProperty("--mx", ml.toFixed(2) + "px");
    stage.style.setProperty("--mb", mb + "px");

    aB = Math.round(wt - GAP);
    for (i = 0; i < n; i++) { stops[i].style.left = aL + "px"; stops[i].style.top = (aB - heights[i]) + "px"; }
    travel = Math.min(vw - aL + 24, Math.max(140, vw - aL - pw + 120));

    // The wall converges on a point left of the posters, on their bottom line.
    vpy = aB;
    vpx = Math.max(side + 4, aL - pw * 0.3);
    lw = aL - vpx > pw * 0.2 ? aL - vpx : pw * 0.45;
    wallTop = aB - ph - 28;
    var sR = (vw + 2 - vpx) / lw, yT = vpy - (vpy - wallTop) * sR, yB = vpy + LEDGE * sR;
    face.style.clipPath = "polygon(" + px(vpx) + " " + px(vpy) + "," + px(vw + 2) + " " + px(yT) + "," + px(vw + 2) + " " + px(yB) + ")";
    var len = Math.hypot(vw + 2 - vpx, yB - vpy), ang = Math.atan2(yB - vpy, vw + 2 - vpx);
    ledge.style.transform = "translate(" + px(vpx) + "," + px(vpy) + ") rotate(" + ang.toFixed(4) + "rad) scaleX(" + (len / 100).toFixed(3) + ")";
    dHi = 1 - 1 / sR;
    dLo = 1 - 1 / SEAM_S0;

    if (mobile) {
      end.style.left = aL + "px";
      end.style.top = Math.round(aB - eh) + "px";
    } else {
      end.style.left = side + "px";
      end.style.top = Math.round(Math.max(dock + 24, wt + H * 0.32 - eh / 2)) + "px";
      end.style.width = Math.max(240, Math.min(460, ml - side - 40)) + "px";
    }
    if (rail) {
      rail.style.left = side + "px";
      rail.style.width = Math.round(mobile ? ml - side - 12 : Math.min(520, ml - side - 40)) + "px";
      rail.style.top = Math.round(wt + H - (mobile ? 6 : 26)) + "px";
    }

    range = Math.max(1, scroller.offsetHeight - vh);
    top0 = scroller.getBoundingClientRect().top + window.pageYOffset;
    memo = []; drawn = {};
  }

  function scrollTime() {
    var p = clamp((window.pageYOffset - top0) / range);
    return p * TOTAL;
  }

  // Walked distance up to t: time minus every pause before it.
  function walked(t) {
    var w = t;
    for (var i = 0; i < n; i++) {
      var b = INTRO + i;
      w -= Math.max(0, Math.min(t, b + LEFT) - (b + ARRIVE));
    }
    return w - Math.max(0, t - STAND);
  }

  function pose(t) {
    if (t >= STAND) return { layer: "raise", f: 0, at: -1 }; // standing, pointer down
    for (var i = 0; i < n; i++) {
      var u = t - (INTRO + i);
      if (u >= ARRIVE && u < LEFT) {
        if (u < RAISED) return { layer: "raise", f: RAISE_SEQ[Math.min(2, Math.floor((u - ARRIVE) / (RAISED - ARRIVE) * 3))], at: i };
        if (u < LOWER) return { layer: "point", f: 0, at: i };
        return { layer: "raise", f: RAISE_SEQ[2 - Math.min(2, Math.floor((u - LOWER) / (LEFT - LOWER) * 3))], at: i };
      }
    }
    var w0 = INTRO + ARRIVE; // walked distance at the first arrival
    var f = (LAND + Math.floor((walked(t) - w0) * FPS_UNIT + 1e-6)) % 12;
    return { layer: "walk", f: f < 0 ? f + 12 : f, at: -1 };
  }

  function drawMimi(t) {
    var p = ready ? pose(t) : { layer: "point", f: 0, at: -1 };
    put(walkLayer, "wl", "opacity", p.layer === "walk" ? "1" : "0");
    put(raiseLayer, "rl", "opacity", p.layer === "raise" ? "1" : "0");
    put(pointImg, "pi", "opacity", p.layer === "point" ? "1" : "0");
    if (p.layer === "walk") put(walkImg, "wi", "transform", "translate3d(" + (-p.f * 100 / 12).toFixed(4) + "%,0,0)");
    if (p.layer === "raise") put(raiseImg, "ri", "transform", "translate3d(" + (-p.f * 25) + "%,0,0)");
    // Contact shadow breathes with the stride: tighter on a passing step, wider at full stride.
    var stride = p.layer === "walk" && t < STAND ? Math.abs(Math.cos(p.f / 6 * Math.PI)) : 0.5;
    put(floor, "fl", "transform", "scaleX(" + (0.92 + stride * 0.1).toFixed(3) + ")");
    var tap = p.layer === "point";
    if (drawn.tap !== tap) { drawn.tap = tap; walker.classList.toggle("is-tap", tap); }
  }

  // Seams sit at fixed depths on the wall; as the camera backs up they slide toward the
  // vanishing point, closing up and fading. A pool of spans is reused by depth slot.
  function drawWall(t) {
    var z = walked(t) * KZ, j0 = Math.ceil((z + dLo) / SEAM_GAP);
    for (var m = 0; m < seams.length; m++) {
      var d = (j0 + m) * SEAM_GAP - z, key = "w" + m;
      if (d >= dHi) { put(seams[m], key + "o", "opacity", "0"); continue; }
      var s = 1 / (1 - d), x = vpx + lw * s, y0 = vpy - (vpy - wallTop) * s, y1 = vpy + LEDGE * s;
      put(seams[m], key + "t", "transform", "translate3d(" + x.toFixed(1) + "px," + y0.toFixed(1) + "px,0) scaleY(" + ((y1 - y0) / 1000).toFixed(4) + ")");
      put(seams[m], key + "o", "opacity", opac(clamp((s - SEAM_S0) / 0.4)));
    }
  }

  function drawStops(t) {
    for (var i = 0; i < n; i++) {
      var u = t - (INTRO + i), el = stops[i], key = "s" + i, h = heights[i];
      var tx = 0, ty = 0, sc = 1, op = 1;
      if (u < ENTER || u >= EXIT_END) {
        tx = travel; op = 0;
      } else if (u < ARRIVE) {
        // Near the camera: it slides in from the right edge, a touch larger, and settles.
        var r = 1 - easeOut((u - ENTER) / (ARRIVE - ENTER));
        sc = 1 + r * 0.06; tx = r * travel; ty = h * (1 - sc);
        // Invisible while any of it is past the edge; it fades in over the last few pixels,
        // which are inside its own padding, so no line of text is ever cut by the frame.
        var off = aL + tx + pw * sc - vw;
        op = off <= 0 ? 1 : clamp(1 - off / EDGE_PAD);
      } else if (u >= LEFT) {
        // Behind her now: it recedes with the wall toward the vanishing point and fades.
        sc = 1 / (1 + (u - LEFT) * KZ);
        tx = (vpx + (aL - vpx) * sc) - aL; ty = h * (1 - sc);
        op = 1 - easeInOut((u - LEFT) / (EXIT_END - LEFT));
      }
      put(el, key + "t", "transform", "translate3d(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px,0) scale(" + sc.toFixed(4) + ")");
      put(el, key + "o", "opacity", opac(op));
      var on = op > 0.5, lit = u >= LIT_A && u < LIT_B;
      if (drawn[key + "on"] !== on) { drawn[key + "on"] = on; el.classList.toggle("is-on", on); }
      if (drawn[key + "lit"] !== lit) {
        drawn[key + "lit"] = lit;
        el.classList.toggle("is-here", lit);
        if (railItems[i]) railItems[i].classList.toggle("is-here", lit);
      }
      if (fills[i]) put(fills[i], key + "f", "transform", "scaleX(" + clamp((u - (LEFT - 1)) / WALK_GAP).toFixed(3) + ")");
    }
    var v = t - END_AT;
    var k = easeOut(clamp((v - 0.1) / 0.3));
    put(end, "et", "transform", "translate3d(0," + ((1 - k) * 24).toFixed(1) + "px,0)");
    put(end, "eo", "opacity", opac(k));
    if (drawn.end !== k > 0.5) { drawn.end = k > 0.5; end.classList.toggle("is-on", drawn.end); }
  }

  function draw(t) { drawWall(t); drawStops(t); drawMimi(t); }

  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var d = target - cur;
    if (Math.abs(d) > 1.5) cur = target - (d > 0 ? 0.6 : -0.6); // long jumps: skip ahead, then ease
    else cur += d * (1 - Math.exp(-dt / 0.09));
    if (Math.abs(target - cur) < 0.0005) cur = target;
    draw(cur);
    if (cur !== target) requestAnimationFrame(tick); else running = false;
  }

  function kick() {
    target = scrollTime();
    if (cur < 0) { cur = target; draw(cur); return; }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { layout(); cur = target = scrollTime(); draw(cur); }, 120);
  }

  // Keyboard: focusing a poster scrolls to the moment Mimi points at it.
  section.addEventListener("focusin", function (event) {
    var i = stops.indexOf(event.target.closest && event.target.closest("[data-stop]"));
    var t = i >= 0 ? INTRO + i + 0.66 : end.contains(event.target) ? TOTAL : -1;
    if (t < 0) return;
    var y = top0 + t / TOTAL * range;
    // overflow:hidden still lets focus scroll the stage sideways; undo that.
    stage.scrollLeft = 0; stage.scrollTop = 0;
    if (Math.abs(window.pageYOffset - y) > 2) window.scrollTo({ top: y, behavior: "instant" });
    cur = target = t; draw(cur);
  });

  layout();
  kick();
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("load", onResize, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  var imgs = [walkImg, raiseImg, pointImg];
  function decoded(img) { return img.decode ? img.decode().catch(function () {}) : Promise.resolve(); }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      imgs.forEach(function (img) { img.loading = "eager"; });
      Promise.all(imgs.map(decoded)).then(function () { ready = true; memo = []; drawn = {}; draw(cur); });
    }, { rootMargin: "100% 0px" });
    io.observe(section);
  } else {
    ready = true;
  }
})();
