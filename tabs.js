(function () {
  var nav = document.querySelector("[data-tabs]");
  if (!nav) return;
  var tabs = Array.prototype.slice.call(nav.querySelectorAll("[data-tab]"));
  var panels = {};
  tabs.forEach(function (tab) {
    var panel = document.getElementById(tab.getAttribute("data-tab"));
    if (panel) panels[tab.getAttribute("data-tab")] = panel;
  });
  if (!tabs.length || tabs.some(function (t) { return !panels[t.getAttribute("data-tab")]; })) return;

  nav.querySelector("ul").setAttribute("role", "tablist");
  Array.prototype.forEach.call(nav.querySelectorAll("li"), function (li) { li.setAttribute("role", "presentation"); });
  tabs.forEach(function (tab) {
    var id = tab.getAttribute("data-tab");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", id);
    panels[id].setAttribute("role", "tabpanel");
    panels[id].setAttribute("aria-labelledby", tab.id);
  });

  function select(id, focus) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-tab") === id;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      panels[tab.getAttribute("data-tab")].hidden = !on;
      if (on && focus) tab.focus();
    });
  }

  function fromHash() {
    var id = decodeURIComponent(window.location.hash.slice(1));
    return panels[id] ? id : null;
  }

  function reveal(id) {
    select(id, false);
    var target = document.getElementById("products");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function remember(id) {
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + id);
  }

  var initial = fromHash();
  select(initial || tabs[0].getAttribute("data-tab"), false);
  if (initial) window.setTimeout(function () { reveal(initial); }, 0);

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      var id = tab.getAttribute("data-tab");
      select(id, false);
      remember(id);
    });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % tabs.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      var id = tabs[next].getAttribute("data-tab");
      select(id, true);
      remember(id);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var id = link.getAttribute("data-goto");
      reveal(id);
      remember(id);
    });
  });

  window.addEventListener("hashchange", function () {
    var id = fromHash();
    if (id) reveal(id);
  });
})();
