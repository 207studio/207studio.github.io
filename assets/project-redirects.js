/* Keep shared homepage fragment links working after details move to project homes. */
(function () {
  var lang = document.documentElement.lang === 'ko' ? '/ko' : '';
  var destinations = { '#ttoryeot': '/ttoryeot/#ttoryeot', '#compare': '/ttoryeot/#compare', '#pairy': '/pairy/' };
  function follow() {
    var dest = destinations[location.hash];
    if (dest) location.replace(lang + dest);
  }
  follow();
  window.addEventListener('hashchange', follow);
})();
