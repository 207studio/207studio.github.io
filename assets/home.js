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
     ..b+0.40        she walks; poster i comes along the wall from the far end
     b+0.40..b+0.92  she stands beside it; the poster is lit
     b+0.92..        she walks on; the poster slides on toward her and fades before it reaches her
   Mimi takes over from the hero Mimi: same figure height, same body centre, same feet, and
   she only shows once her whole figure is inside the frame. She never moves after that and
   is never mirrored.
   The wall is one CSS 3D plane (rotateY) seen through the stage's perspective, so the wall,
   its seams and the posters pasted on it share one vanishing point. On wide screens the
   wall runs to her left and the featured poster hangs there at her height; on phones it
   runs above her head and the stop list sits on the floor below her.
   Walk frames advance 24 per stop of wall travel everywhere (12 for the half-stop intro),
   so her steps keep pace with the wall, and every arrival lands on the standing frame.
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
  var floor = section.querySelector("[data-walk-floor]");
  var end = section.querySelector("[data-walk-end]");
  var wall = section.querySelector("[data-wall]");
  var face = section.querySelector("[data-wall-face]");
  var ledge = section.querySelector("[data-wall-ledge]");
  var seams = section.querySelector("[data-seam]");
  var track = section.querySelector("[data-walk-track]");
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  var fills = [].slice.call(section.querySelectorAll("[data-rail-fill]"));
  var railItems = fills.map(function (f) { return f.parentNode; });
  var rail = railItems.length ? railItems[0].parentNode : null;
  var heroImg = document.querySelector("[data-mimi] img");
  var n = stops.length;

  var INTRO = 0.25, ARRIVE = 0.40, LEFT = 0.92;
  var LIT_A = 0.44, LIT_B = 0.88;
  var WALK_GAP = (1 - LEFT) + ARRIVE;          // 0.48
  var END_AT = INTRO + n, STAND = END_AT + ARRIVE, TOTAL = STAND + 0.35;
  var SEG_SVH = 96;
  // Sprite geometry (12 cells of 162 x 420; hero image 431 x 990), from the alpha channel.
  var CELL_W = 162, CELL_H = 420, FRAMES = 12;
  var HAND_FRAME = 10, HAND_BOX = [7, 3, 159, 405];  // both feet planted: hand-off and stops
  var HERO_BOX = [8, 6, 420, 982], MIN_X = 2, MIN_Y = -2; // widest / tallest walk frame (feet pinned)
  var FOOT = [417, 415, 412, 408, 405, 409, 411, 414, 411, 408, 405, 409]; // lowest row per cell
  var INTRO_SPAN = 0.5;                         // the intro walk covers half a stop
  var K = 0.86, TILT = 20 * Math.PI / 180;     // far edge of the featured poster vs near edge
  var GAP = 10;

  var vw = 0, vh = 0, mh = 1, mobile = false, range = 1, top0 = 0, mb = 0, footGap = 0, fadeIn = 1;
  var L = 0, oy = 0, P = 1000, cs = 1, sn = 0, pwp = 0, step = 0, seamGap = 1, limit = 0, railTop = 0;
  var heights = [];
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
  function box(el, x, y, w, h) {
    el.style.left = px(x); el.style.top = px(y); el.style.width = px(w); el.style.height = px(h);
  }

  // The hero Mimi image in page pixels, ignoring her pointer-follow nudge (a translate).
  function heroBox() {
    if (!heroImg || !heroImg.offsetHeight) return null;
    var x = 0, y = 0;
    for (var el = heroImg; el; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    return { x: x, y: y, w: heroImg.offsetWidth, h: heroImg.offsetHeight };
  }

  // Plane x (0 = near edge of the featured poster) to screen x; perspective-origin x is L.
  function scale(xp) { return P / (P + xp * sn); }
  function proj(xp) { return L + xp * cs * scale(xp); }
  function unproj(sx) { return P * (L - sx) / ((sx - L) * sn - cs * P); }

  function layout() {
    var i, ph = 0;
    vw = stage.clientWidth; vh = stage.clientHeight;
    mobile = vw <= 700;
    var dock = mobile ? 76 : 92;
    var side = mobile ? 12 : Math.round(Math.max(24, vw * 0.033));
    ["--mh", "--mw", "--mx", "--mb"].forEach(function (p) { stage.style.removeProperty(p); });

    // Mimi: the hero's figure, feet and body centre, carried over exactly.
    var hb = heroBox(), H, ml, wt;
    if (hb) {
      var figH = hb.h * (HERO_BOX[3] + 1 - HERO_BOX[1]) / 990;
      H = figH * CELL_H / (HAND_BOX[3] + 1 - HAND_BOX[1]);
      var foot = hb.y + hb.h * (HERO_BOX[3] + 1) / 990;
      wt = foot - H * (HAND_BOX[3] + 1) / CELL_H;
      var heroCx = hb.x + hb.w * (HERO_BOX[0] + HERO_BOX[2] + 1) / 2 / 431;
      var boxCx = hb.x + hb.w / 2;
      var mw0 = H * CELL_W / CELL_H;
      var bodyOff = ((HAND_BOX[0] + HAND_BOX[2] + 1) / 2 - CELL_W / 2) * mw0 / CELL_W;
      // Split the difference between the box centre and the body centre (both stay within 2px).
      ml = boxCx - mw0 / 2 + ((heroCx - boxCx) - bodyOff) / 2;
    } else {
      H = walker.offsetHeight || 320; wt = vh - 24 - H; ml = walker.offsetLeft;
    }
    var mw = H * CELL_W / CELL_H;
    mh = H;
    // The cell runs a few px below her feet; that transparent strip may hang below the stage.
    mb = vh - wt - H;
    stage.style.setProperty("--mh", H.toFixed(2) + "px");
    stage.style.setProperty("--mw", mw.toFixed(2) + "px");
    stage.style.setProperty("--mx", ml.toFixed(2) + "px");
    stage.style.setProperty("--mb", mb.toFixed(2) + "px");
    section.classList.toggle("is-above", mobile);
    // She fades in over the scroll between "whole figure in frame" and the pin, never later.
    footGap = Math.max(0, vh - wt - H * (HAND_BOX[3] + 1) / CELL_H);
    fadeIn = Math.max(1, Math.min(Math.max(60, vh * 0.12), footGap));

    var figL = ml + MIN_X * mw / CELL_W, headY = wt + MIN_Y * H / CELL_H, feetY = wt + H;
    // Stop list: a thin rail at her feet on wide screens; on tall phones a list on the floor.
    var listRoom = vh - feetY - 24;
    var asList = mobile && listRoom >= 200;
    section.classList.toggle("is-list", asList);
    railTop = mobile ? (asList ? feetY + 30 : feetY - 6) : feetY - 26;

    // The featured poster at its stop, on screen: [xl, xr]. Wide screens: on the wall to her
    // left, centred between the dock and the rail. Phones: across the top, above her head.
    var xl, xr;
    if (!mobile) {
      xr = figL - Math.max(24, H * 0.06);
      xl = Math.max(side, xr - 640);
      limit = figL - 2;
    } else {
      xl = side; xr = vw - side; limit = Infinity;
    }
    // Perspective: heights fall off linearly toward the vanishing point vx, so the far edge
    // of the featured poster is K times its near edge. TILT sets how much it is foreshortened.
    var vx = (xr - K * xl) / (1 - K);
    cs = Math.cos(TILT); sn = Math.sin(TILT);
    L = xl; P = (vx - xl) * Math.tan(TILT);
    pwp = (xr - xl) / (K * cs);
    step = pwp * 1.12;
    seamGap = step / 2;

    section.classList.remove("is-tight");
    // Nearer the left edge the wall is closer, so a poster there is taller (sNear times);
    // size the sheets so even that one stays clear of the rail.
    var sNear = Math.max(1, scale(unproj(side)));
    var minH = mobile ? 0 : Math.max(0, Math.min(460, vh * 0.5, 2 * (railTop - dock - 40) / (1 + sNear)));
    for (i = 0; i < n; i++) { stops[i].style.width = px(pwp); stops[i].style.minHeight = minH ? px(minH) : ""; }
    for (var pass = 0; pass < 2; pass++) {
      ph = 0; heights = [];
      for (i = 0; i < n; i++) { heights[i] = stops[i].offsetHeight; ph = Math.max(ph, heights[i]); }
      if (!mobile) oy = Math.max(dock + 12 + ph / 2, Math.min((dock + railTop) / 2, railTop - 14 - ph / 2 * sNear));
      else oy = headY - GAP;
      if (!mobile || oy - ph >= dock + 6 || pass) break;
      section.classList.add("is-tight");                 // short band above her head
    }
    var half = mobile ? 1 : 0.5;
    stage.style.perspective = Math.round(P) + "px";
    stage.style.perspectiveOrigin = px(L) + " " + px(oy);
    var plane = "rotateY(" + TILT.toFixed(5) + "rad)";
    [wall, track].forEach(function (el) { el.style.left = px(L); el.style.transform = plane; });
    for (i = 0; i < n; i++) stops[i].style.top = px(oy - heights[i] * half);

    // Wall: from past the near (left) edge to past the right edge. Its top clears the
    // posters; its foot meets the floor just behind her feet.
    var x0 = unproj(-40), x1 = Math.max(unproj(vw + 40), pwp * 2);
    var sM = scale(unproj(ml + mw / 2));
    var yB = oy + (wt + H * 0.95 - oy) / sM;
    var yT = oy - Math.max(ph * half + 48, (oy - Math.max(0, wt - H * 0.1)) / scale(unproj(vw)));
    box(face, x0, yT, x1 - x0, yB - yT);
    box(ledge, x0, yB - 1, x1 - x0, 3);
    box(seams, x0 - seamGap, yT, x1 - x0 + seamGap * 2, yB - yT);
    seams.style.backgroundSize = seamGap.toFixed(2) + "px 100%";

    if (!mobile) {
      end.style.width = px(Math.max(240, Math.min(460, xr - side))); end.style.left = px(side);
      end.style.top = px(Math.max(dock + 10, oy - end.offsetHeight / 2));
    } else {
      end.style.width = px(vw - side * 2); end.style.left = px(side);
      end.style.top = px(Math.max(dock + 6, oy - end.offsetHeight));
    }
    if (rail) {
      rail.style.left = side + "px";
      rail.style.width = Math.round(asList ? vw - side * 2 : mobile ? ml - side - 12 : Math.min(520, ml - side - 40)) + "px";
      rail.style.top = Math.round(railTop) + "px";
    }

    range = Math.max(1, scroller.offsetHeight - vh);
    top0 = scroller.getBoundingClientRect().top + window.pageYOffset;
    memo = []; drawn = {};
  }

  function scrollTime() {
    var p = clamp((window.pageYOffset - top0) / range);
    return p * TOTAL;
  }

  // Where the walk is, in stops: -1 at the start, i while paused at stop i, n at the end.
  // Each walk eases in and out.
  function along(t) {
    var w0 = INTRO + ARRIVE;
    if (t <= 0) return -1;
    if (t < w0) return -1 + easeInOut(t / w0);
    for (var i = 0; i < n; i++) {
      var b = INTRO + i;
      if (t < b + LEFT) return i;
      var e = b + 1 + ARRIVE;
      if (t < e) return i + easeInOut((t - b - LEFT) / (e - b - LEFT));
    }
    return n;
  }

  // Walk frame for time t: the standing frame at the stops and at the end, otherwise the
  // cycle, 24 frames per stop of wall travel.
  function frame(t) {
    if (t >= STAND || t <= 0) return HAND_FRAME;
    var a = along(t);
    if (a === Math.round(a)) return HAND_FRAME;
    var f = (HAND_FRAME + Math.floor((a < 0 ? a * INTRO_SPAN : a) * 24 + 1e-6)) % FRAMES;
    return f < 0 ? f + FRAMES : f;
  }

  function drawMimi(t) {
    var f = ready ? frame(t) : HAND_FRAME;
    // Keep the lowest foot on the floor: each cell's figure ends at a slightly different row.
    var dy = (HAND_BOX[3] - FOOT[f]) * mh / CELL_H;
    put(walkImg, "wi", "transform", "translate3d(" + (-f * 100 / FRAMES).toFixed(4) + "%," + dy.toFixed(1) + "px,0)");
    // Contact shadow breathes with the stride: tighter on a passing step, wider at full stride.
    var stride = f === HAND_FRAME ? 0.5 : Math.abs(Math.cos((f - HAND_FRAME) / 6 * Math.PI));
    put(floor, "fl", "transform", "scaleX(" + (0.92 + stride * 0.1).toFixed(3) + ")");
  }

  // She appears only once her whole figure is in the frame (the stage is still sliding up
  // into view until it pins), and fades in from there.
  function drawEntry() {
    var a = window.pageYOffset - (top0 - footGap);
    put(walker, "wo", "opacity", opac(clamp(a / fadeIn)));
  }

  function drawWall(a) {
    var s = ((a * step) % seamGap + seamGap) % seamGap;
    put(seams, "sm", "transform", "translate3d(" + s.toFixed(1) + "px,0,0)");
  }

  function drawStops(t, a) {
    var lastOp = 1;
    for (var i = 0; i < n; i++) {
      var u = t - (INTRO + i), el = stops[i], key = "s" + i;
      var xp = (a - i) * step, op = 1, nearX = unproj(-40), farX = unproj(vw + 40);
      var right = xp + pwp > nearX ? proj(xp + pwp) : -1e4;
      if (right < -4 || xp > farX || proj(xp) > vw + 4) op = 0;
      // Wide screens: once it starts to slide away toward her it fades, and it is gone
      // before it could reach her.
      else if (!mobile && xp > 0) op = clamp((limit - right) / Math.max(1, limit - proj(pwp)));
      if (op === 0) xp = Math.min(Math.max(xp, nearX - pwp * 1.5), farX);
      put(el, key + "t", "transform", "translate3d(" + xp.toFixed(1) + "px,0,0)");
      put(el, key + "o", "opacity", opac(op));
      if (i === n - 1 && a > n - 1) lastOp = op;
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
    // The closing block takes over as the last poster fades, so the wall is never bare.
    var k = Math.max(easeOut(clamp((v - 0.1) / 0.3)), clamp(1 - lastOp * 2));
    put(end, "et", "transform", "translate3d(0," + ((1 - k) * (mobile ? -24 : 24)).toFixed(1) + "px,0)");
    put(end, "eo", "opacity", opac(k));
    if (drawn.end !== k > 0.5) { drawn.end = k > 0.5; end.classList.toggle("is-on", drawn.end); }
  }

  // The intro covers half a stop, so the first poster is already half on the wall when she
  // sets off (the wall is never bare); her steps are scaled to match in frame().
  function draw(t) { var a = along(t); if (a < 0) a *= INTRO_SPAN; drawWall(a); drawStops(t, a); drawMimi(t); }

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
    drawEntry();
    if (cur < 0) { cur = target; draw(cur); return; }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { layout(); cur = target = scrollTime(); drawEntry(); draw(cur); }, 120);
  }

  // Keyboard: focusing a poster scrolls to the moment Mimi stands beside it.
  section.addEventListener("focusin", function (event) {
    var i = stops.indexOf(event.target.closest && event.target.closest("[data-stop]"));
    var t = i >= 0 ? INTRO + i + 0.66 : end.contains(event.target) ? TOTAL : -1;
    if (t < 0) return;
    var y = top0 + t / TOTAL * range;
    // overflow:hidden still lets focus scroll the stage sideways; undo that.
    stage.scrollLeft = 0; stage.scrollTop = 0;
    if (Math.abs(window.pageYOffset - y) > 2) window.scrollTo({ top: y, behavior: "instant" });
    cur = target = t; drawEntry(); draw(cur);
  });

  layout();
  kick();
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("load", onResize, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  var imgs = [walkImg];
  function decoded(img) { return img.decode ? img.decode().catch(function () {}) : Promise.resolve(); }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      imgs.forEach(function (img) { img.loading = "eager"; });
      Promise.all(imgs.map(decoded)).then(function () { ready = true; memo = []; drawn = {}; drawEntry(); draw(cur); });
    }, { rootMargin: "100% 0px" });
    io.observe(section);
  } else {
    ready = true;
  }
})();
