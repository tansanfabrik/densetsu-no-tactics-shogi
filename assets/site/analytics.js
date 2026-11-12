// 公開サイト用の計測 (GA4)。tools/build_site.mjs が測定 ID を付けたときだけ読み込まれる。
// 本体 (index.html) が投げる 2 つの合図を gtag のイベントにして送る。送る値は合図の detail の値だけ。
// 使い方: <script src="assets/site/analytics.js" data-ga="G-XXXXXXXXXX"></script>
(function () {
  'use strict';
  var s = document.currentScript, id = s && s.getAttribute('data-ga');
  if (!id || !/^G-[A-Za-z0-9]+$/.test(id)) return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') window.gtag = function () { window.dataLayer.push(arguments); };
  try {
    var g = document.createElement('script');
    g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(g);
    window.gtag('js', new Date());
    window.gtag('config', id);
  } catch (e) { /* 計測が動かなくてもゲームは止めない */ }

  function pick(d, keys) {
    var o = {};
    keys.forEach(function (k) { if (d && d[k] !== undefined) o[k] = d[k]; });
    return o;
  }
  window.addEventListener('tactics:gamestart', function (e) {
    try { window.gtag('event', 'game_start', pick(e.detail, ['mode', 'side', 'field', 'resumed'])); } catch (err) { /* noop */ }
  });
  window.addEventListener('tactics:gameend', function (e) {
    try { window.gtag('event', 'game_end', pick(e.detail, ['result', 'reason', 'ending', 'plies'])); } catch (err) { /* noop */ }
  });
})();
