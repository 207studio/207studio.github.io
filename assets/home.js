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
     b+0.14..b+0.40  card i slides in from the right edge while she walks
     b+0.40..b+0.48  she raises the pointer (raise frames 0, 2, 3; frame 1 is blurred)
     b+0.48..b+0.84  she points; the card is lit
     b+0.84..b+0.92  she lowers it (same frames reversed)
     b+0.92..b+1.12  she walks on and the card passes out past the edge
   Every walk between stops lasts WALK_GAP and covers exactly two 12-frame cycles, so
   each arrival lands on walk frame 4, the stride closest to raise frame 0.
   The pointer is in the same hand in every frame. Layers swap instantly (no crossfade).
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
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  var fills = [].slice.call(section.querySelectorAll("[data-rail-fill]"));
  var railItems = fills.map(function (f) { return f.parentNode; });
  var rail = railItems.length ? railItems[0].parentNode : null;
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

  var vw = 0, vh = 0, travel = 0, range = 1, top0 = 0;
  var cur = -1, target = 0, last = 0, running = false, ready = false;
  var memo = [], drawn = {};

  section.classList.add("is-live");
  scroller.style.height = (TOTAL * SEG_SVH + 100) + "vh";
  scroller.style.height = (TOTAL * SEG_SVH + 100) + "svh";

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeIn(x) { return x * x * x; }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function put(el, key, prop, val) {
    var m = memo[key] || (memo[key] = {});
    if (m[prop] !== val) { m[prop] = val; el.style[prop] = val; }
  }

  function layout(again) {
    if (!again) stage.style.removeProperty("--mb");
    vw = stage.clientWidth; vh = stage.clientHeight;
    var ww = walker.offsetWidth, wh = walker.offsetHeight;
    var wl = walker.offsetLeft, wt = walker.offsetTop;
    var tipX = wl + ww * 0.986, tipY = wt + wh * 0.202;
    var mobile = vw <= 700, cardL, cardW, i, h;

    if (mobile) {
      cardL = Math.round(tipX - ww * 0.3);
      cardW = vw - cardL - 12;
    } else {
      cardL = Math.round(tipX + Math.min(30, Math.max(14, vw * 0.018)));
      cardW = Math.min(680, vw - cardL - Math.max(40, vw * 0.06));
    }
    for (i = 0; i < n; i++) stops[i].style.width = cardW + "px";
    for (i = 0; i < n; i++) {
      h = stops[i].offsetHeight;
      var y = mobile ? tipY - h - 12 : tipY - h * 0.58;
      y = Math.max(mobile ? 84 : 100, Math.min(y, vh - h - (mobile ? 40 : 76)));
      stops[i].style.left = cardL + "px";
      stops[i].style.top = Math.round(y) + "px";
    }
    // Tall phones: lift Mimi so she and the card sit centred under the dock, not on the floor.
    if (mobile && !again) {
      var cardTop = Infinity, mb = vh - wt - wh;
      for (i = 0; i < n; i++) cardTop = Math.min(cardTop, stops[i].offsetTop);
      var slack = (cardTop - 84) - mb;
      if (slack > 24) { stage.style.setProperty("--mb", Math.round(mb + slack / 2) + "px"); return layout(true); }
    }
    end.style.width = Math.min(cardW, 460) + "px";
    var eh = end.offsetHeight;
    end.style.left = cardL + "px";
    end.style.top = Math.round(Math.max(100, tipY - eh * (mobile ? 1.1 : 0.6))) + "px";
    if (rail) {
      var rl = mobile ? wl + ww + 10 : cardL;
      rail.style.left = Math.round(rl) + "px";
      rail.style.width = Math.round(mobile ? vw - rl - 14 : cardW) + "px";
      rail.style.top = Math.round(wt + wh - (mobile ? 6 : 26)) + "px";
    }
    travel = vw - cardL + 60;
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

  function drawStops(t) {
    for (var i = 0; i < n; i++) {
      var u = t - (INTRO + i), el = stops[i], key = "s" + i;
      var x = 0, y = 0, ry = 0, sc = 1, op = 1, ix = 0;
      if (u < ENTER || u >= EXIT_END) {
        x = travel; op = 0;
      } else if (u < ARRIVE) {
        var e = easeOut((u - ENTER) / (ARRIVE - ENTER)), r = 1 - e;
        x = r * travel; y = r * -vh * 0.015; ry = r * -26; sc = 1 + r * 0.05; ix = r * -6;
        op = clamp((u - ENTER) / 0.09);
      } else if (u >= LEFT) {
        var q = easeIn((u - LEFT) / (EXIT_END - LEFT));
        x = q * travel * 0.9; y = q * vh * 0.12; ry = q * 18; sc = 1 + q * 0.16; ix = q * 6;
        op = 1 - easeInOut(q);
      }
      put(el, key + "t", "transform", "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) rotateY(" + ry.toFixed(2) + "deg) scale(" + sc.toFixed(4) + ")");
      put(el, key + "o", "opacity", op < 0.002 ? "0" : op > 0.998 ? "1" : op.toFixed(3));
      var img = el.querySelector("img");
      put(img, key + "i", "transform", "translate3d(" + ix.toFixed(2) + "%,0,0) scale(1.1)");
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
    put(end, "et", "transform", "translate3d(" + ((1 - k) * 56).toFixed(1) + "px,0,0)");
    put(end, "eo", "opacity", k < 0.002 ? "0" : k > 0.998 ? "1" : k.toFixed(3));
    if (drawn.end !== k > 0.5) { drawn.end = k > 0.5; end.classList.toggle("is-on", drawn.end); }
  }

  function draw(t) { drawStops(t); drawMimi(t); }

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

  // Keyboard: focusing a card scrolls to the moment Mimi points at it.
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
