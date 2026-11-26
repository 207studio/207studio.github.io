/* 207 Studio home: the walk. Load with defer on the two home pages only.
   One scroll handler drives the pinned stage (see site-home.css): per app a dwell where its card rests in front, then an eased
   change where it falls back in depth and the next card rises to the front. Mimi walks in place during a change and her bubble
   fades out and back with the next app's line. A screen under 440px tall keeps the static list. Her walk cycle runs while the stage
   is on screen (decided from the scroll position, not an observer, so it never depends on one) and the walk measures itself again
   whenever the page's size or look settles. Reduced motion keeps the stage and Mimi's walk cycle (the owner wants her to walk on a
   Windows PC with animation effects off), but the cards only fade (no depth) and she stays at one size. The cards are the work list's own links: with no script the
   page is that list. Moved from the studio's home script (assets/home.js) unchanged in behaviour. */
(function () {
  var section = document.querySelector("[data-walk]");
  if (!section) return;
  var live = window.matchMedia("(min-height: 440px)");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  var scroller = section.querySelector("[data-walk-scroller]");
  var stage = section.querySelector("[data-walk-stage]");
  var track = section.querySelector("[data-walk-track]");
  var stops = [].slice.call(section.querySelectorAll("[data-stop]"));
  if (!scroller || !stage || !track || stops.length < 2) return;
  var N = stops.length, DWELL = 0.55, BACK = -420, DEPTH = -600, NEAR = 0.8;
  var top = 0, run = 1, active = -1, ticking = false, on = false, walking = true;

  section.style.setProperty("--stops", String(N));

  var mimi = document.createElement("div");
  mimi.className = "walk-mimi is-walking";
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
    var z = 0, o = 0, out = Math.min(1, move * 1.6), deep = !still.matches;
    if (k === i) { z = deep ? BACK * out : 0; o = 1 - out; }
    else if (k === i + 1) { z = deep ? DEPTH * (1 - move) : 0; o = Math.min(1, Math.max(0, (move - 0.15) / 0.35)); }
    stops[k].style.transform = "translate3d(0,0," + z.toFixed(1) + "px)";
    stops[k].style.opacity = o.toFixed(3);
  }

  function tick() {
    ticking = false;
    var t = Math.min(Math.max((window.pageYOffset - top) / run, 0), 1) * N;
    var i = Math.min(N - 1, Math.floor(t));
    var move = i < N - 1 ? ease(Math.min(Math.max((t - i - DWELL) / (1 - DWELL), 0), 1)) : 0;
    var pos = i + move, here = Math.round(pos);
    var seen = window.pageYOffset + window.innerHeight > top && window.pageYOffset < top + run + stage.offsetHeight;
    if (seen !== walking) { walking = seen; mimi.classList.toggle("is-walking", seen); }
    for (var k = 0; k < N; k++) place(k, i, move);
    // Mimi walks toward the viewer the whole way: the walk cycle runs in CSS, and she grows
    // from NEAR to full size as the tour goes from the first app to the last.
    section.style.setProperty("--mimi-s", still.matches ? "1" : (NEAR + (1 - NEAR) * pos / (N - 1)).toFixed(4));
    say.style.opacity = Math.min(1, Math.abs(move - 0.5) * 2).toFixed(3);
    fill.style.transform = "scaleX(" + (pos / (N - 1)).toFixed(4) + ")";
    if (here !== active) light(here);
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }

  function mode() {
    on = live.matches;
    window.removeEventListener("scroll", onScroll);
    section.classList.toggle("is-live", on);
    if (!on) {
      [mimi, say, prog].forEach(function (el) { el.remove(); });
      stops.forEach(function (s) { s.style.transform = ""; s.style.opacity = ""; s.classList.remove("is-on"); });
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

  // Keyboard: Tab to a card scrolls the page to that card's dwell, so the stage and focus agree.
  track.addEventListener("focusin", function (e) {
    var stop = e.target.closest("[data-stop]");
    if (!on || !stop) return;
    var i = stops.indexOf(stop);
    window.scrollTo(0, Math.round(top + run * (i + DWELL / 2) / N));
  });

  mode();
  live.addEventListener("change", mode);
  still.addEventListener("change", function () { if (on) tick(); });
  // The page settles after this script runs (styles, fonts and images arrive on their own time, mostly on a phone's connection),
  // and each change moves where the walk starts and how long it is. Measure again whenever the page's size or look is final.
  var rt = 0;
  function settle() { clearTimeout(rt); rt = setTimeout(function () { if (on) { measure(); tick(); } }, 120); }
  window.addEventListener("resize", settle);
  window.addEventListener("load", settle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  if ("ResizeObserver" in window) new ResizeObserver(settle).observe(document.body);
})();
