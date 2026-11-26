/* Ttoryeot page: the download button follows the visitor's system. Moved verbatim from assets/home.js lines 319-332. */
(function () {
  var box = document.querySelector("[data-tt-dl]");
  if (!box) return;
  var ua = navigator.userAgent, platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  var os = /Win/i.test(platform) || /Windows/i.test(ua) ? "windows" : /Linux|X11/i.test(platform) && !/Android/i.test(ua) ? "linux" : "mac";
  var pick = box.querySelector('[data-tt-os="' + os + '"]');
  if (!pick) return;
  var main = box.querySelector("[data-tt-main]");
  main.href = pick.href;
  box.querySelector("[data-tt-label]").textContent = pick.getAttribute("data-tt-button");
  pick.setAttribute("aria-current", "true");
  var note = pick.parentNode.querySelector(".tt-dl-note");
  if (note) box.insertBefore(note.cloneNode(true), box.querySelector("details"));
})();
