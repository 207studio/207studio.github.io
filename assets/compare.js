/* Ttoryeot page: the compare lens. Moved verbatim from assets/home.js lines 239-317 (the rest of home.js, the walk and the scene loader, is not used by the redesigned pages). */
/* Compare. One focus point (fx, fy as fractions of the page) drives a gold box on both pages
   and two lens panes that show that region of each render enlarged. Tap, click or hover moves
   it; arrow keys move it when the pair has focus. */
(function () {
  var section = document.querySelector("[data-compare]");
  if (!section) return;
  var pages = [].slice.call(section.querySelectorAll("[data-compare-page]"));
  var panes = {};
  [].forEach.call(section.querySelectorAll("[data-pane]"), function (p) { panes[p.getAttribute("data-pane")] = p; });
  var tabs = [].slice.call(section.querySelectorAll("[data-compare-tabs] button"));
  var ZOOM = 3, page = pages[0], fx = 0.5, fy = 0.25;

  function marks(pg) {
    return [].map.call(pg.querySelectorAll(".compare-shot"), function (shot) {
      var m = shot.querySelector(".compare-mark");
      if (!m) { m = document.createElement("span"); m.className = "compare-mark"; shot.appendChild(m); }
      return m;
    });
  }

  function draw() {
    var imgs = page.querySelectorAll(".compare-side img");
    var ms = marks(page);
    [].forEach.call(imgs, function (img, k) {
      var key = img.closest("[data-side]").getAttribute("data-side"), pane = panes[key];
      var w = img.clientWidth, h = img.clientHeight;
      if (!w || !pane) return;
      // Never enlarge past the render's own pixels, so the lens shows the real output, not upscaling blur.
      var z = Math.max(1.5, Math.min(ZOOM, (img.naturalWidth || w * ZOOM) / w));
      var pw = pane.clientWidth, ph = pane.clientHeight, bw = w * z, bh = h * z;
      var x = Math.min(Math.max(fx * bw - pw / 2, 0), Math.max(bw - pw, 0));
      var y = Math.min(Math.max(fy * bh - ph / 2, 0), Math.max(bh - ph, 0));
      pane.style.backgroundImage = "url(\"" + img.currentSrc + "\")";
      pane.style.backgroundSize = bw + "px " + bh + "px";
      pane.style.backgroundPosition = -x + "px " + -y + "px";
      var m = ms[k];
      m.style.left = x / z + "px"; m.style.top = y / z + "px";
      m.style.width = Math.min(pw / z, w) + "px"; m.style.height = Math.min(ph / z, h) + "px";
    });
  }

  function show(pg) {
    page = pg;
    var f = (pg.getAttribute("data-focus") || "0.5 0.25").split(" ");
    fx = +f[0]; fy = +f[1];
    pages.forEach(function (p) { p.hidden = p !== pg; });
    tabs.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-n") === pg.getAttribute("data-n"))); });
    draw();
  }

  function aim(e) {
    var img = e.target.closest(".compare-shot") && e.target.closest(".compare-shot").querySelector("img");
    if (!img) return;
    var r = img.getBoundingClientRect();
    fx = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    fy = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    draw();
  }

  pages.forEach(function (pg) {
    var pair = pg.querySelector(".compare-pair");
    pair.addEventListener("click", aim);
    pair.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") aim(e); });
    pair.addEventListener("keydown", function (e) {
      var d = { ArrowLeft: [-0.04, 0], ArrowRight: [0.04, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03] }[e.key];
      if (!d) return;
      e.preventDefault();
      fx = Math.min(Math.max(fx + d[0], 0), 1); fy = Math.min(Math.max(fy + d[1], 0), 1);
      draw();
    });
    [].forEach.call(pg.querySelectorAll("img"), function (img) { img.addEventListener("load", draw); });
  });
  tabs.forEach(function (b) {
    b.addEventListener("click", function () { show(pages.filter(function (p) { return p.getAttribute("data-n") === b.getAttribute("data-n"); })[0]); });
  });
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(draw, 120); });
  show(page);
})();
