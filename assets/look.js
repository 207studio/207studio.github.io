/* 207 Studio: sets the look before the first paint (load it in <head>, no defer). data-look="night"|"paper" on <html> comes from
   the visitor's choice, else the device. Also marks the page .js so the parts that need script can show. The choice is kept on this
   browser only (localStorage "207studio-look"); "system" removes it. */
(function () {
  var d = document.documentElement, key = "207studio-look", pref = "system", mq = null;
  try { var s = localStorage.getItem(key); if (s === "night" || s === "paper") pref = s; } catch (e) {}
  try { mq = matchMedia("(prefers-color-scheme: dark)"); } catch (e) {}
  function apply() {
    d.setAttribute("data-look", pref === "system" ? (mq && mq.matches ? "night" : "paper") : pref);
    d.setAttribute("data-look-pref", pref);
  }
  apply();
  d.classList.add("js");
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (pref === "system") apply(); });
  window.__look = {
    get: function () { return pref; },
    set: function (value) {
      pref = value === "night" || value === "paper" ? value : "system";
      try { if (pref === "system") localStorage.removeItem(key); else localStorage.setItem(key, pref); } catch (e) {}
      apply();
    }
  };
})();
