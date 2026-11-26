/* 207 Studio: the header menu and the look choice. Load with defer on every page. Needs assets/look.js (window.__look). */
(function () {
  var menu = document.querySelector("[data-menu]");
  function sync() {
    var pref = window.__look ? window.__look.get() : "system";
    [].forEach.call(document.querySelectorAll("[data-look-set]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-look-set") === pref));
    });
  }
  document.addEventListener("click", function (e) {
    var t = e.target, set = t.closest && t.closest("[data-look-set]");
    if (set && window.__look) { window.__look.set(set.getAttribute("data-look-set")); sync(); return; }
    if (menu && menu.open && (!menu.contains(t) || (t.closest && t.closest(".menu-pop a")))) menu.open = false;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu && menu.open) {
      menu.open = false;
      var s = menu.querySelector("summary");
      if (s) s.focus();
    }
  });
  sync();
})();
