/*!
 * MarkTasks Chat — embed loader
 * Kullanım:
 *   <script>window.$marktasks={websiteId:"PUBLIC_KEY"};</script>
 *   <script async src="https://DOMAIN/widget.js"></script>
 * veya:
 *   <script async src="https://DOMAIN/widget.js" data-website="PUBLIC_KEY"></script>
 */
(function () {
  var scriptEl =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var cfg = window.$marktasks || {};
  var websiteId =
    cfg.websiteId ||
    (scriptEl && scriptEl.getAttribute("data-website")) ||
    window.MARKTASKS_WEBSITE_ID;

  if (!websiteId) {
    console.error("[marktasks] websiteId bulunamadı — script tag'e data-website ekleyin.");
    return;
  }

  var ORIGIN = "";
  try {
    ORIGIN = new URL(scriptEl.src).origin;
  } catch (e) {
    ORIGIN = "";
  }

  if (document.getElementById("marktasks-chat")) return; // çift yükleme koruması

  var iframe = document.createElement("iframe");
  iframe.id = "marktasks-chat";
  iframe.title = "Live Chat";
  iframe.allowTransparency = "true";
  iframe.src = ORIGIN + "/widget?key=" + encodeURIComponent(websiteId);
  iframe.style.cssText = [
    "position:fixed",
    "bottom:0",
    "right:0",
    "width:92px",
    "height:92px",
    "max-width:100vw",
    "max-height:100vh",
    "border:0",
    "background:transparent",
    "color-scheme:normal",
    "z-index:2147483647",
    "transition:width .18s ease,height .18s ease",
  ].join(";");

  function place(position) {
    if (position === "left") {
      iframe.style.left = "0";
      iframe.style.right = "auto";
    } else {
      iframe.style.right = "0";
      iframe.style.left = "auto";
    }
  }

  window.addEventListener("message", function (e) {
    if (ORIGIN && e.origin !== ORIGIN) return;
    var d = e.data || {};
    if (d.type === "marktasks:size") {
      if (d.open) {
        iframe.style.width = "min(400px,100vw)";
        iframe.style.height = "min(660px,100vh)";
      } else {
        iframe.style.width = "92px";
        iframe.style.height = "92px";
      }
    } else if (d.type === "marktasks:position") {
      place(d.position);
    }
  });

  function mount() {
    document.body.appendChild(iframe);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  // Üst sayfanın GERÇEK URL'ini iframe'e bildir (iframe içinden location host sayfayı vermez).
  // SPA gezinmelerinde de güncellenir → sayfa geçmişi tam kaydedilir.
  var lastSent = "";
  function sendUrl() {
    try {
      var u = location.href;
      if (u === lastSent) return;
      lastSent = u;
      iframe.contentWindow.postMessage({ type: "marktasks:url", url: u }, ORIGIN || "*");
    } catch (e) {}
  }
  iframe.addEventListener("load", sendUrl);
  // history API'sini sar (SPA push/replace) + tarayıcı navigasyonu
  try {
    var _ps = history.pushState;
    history.pushState = function () {
      var r = _ps.apply(this, arguments);
      setTimeout(sendUrl, 0);
      return r;
    };
    var _rs = history.replaceState;
    history.replaceState = function () {
      var r = _rs.apply(this, arguments);
      setTimeout(sendUrl, 0);
      return r;
    };
  } catch (e) {}
  window.addEventListener("popstate", sendUrl);
  window.addEventListener("hashchange", sendUrl);

  // Basit JS API: $marktasks.open() / .close()
  window.$marktasks = window.$marktasks || {};
  function cmd(type) {
    try {
      iframe.contentWindow.postMessage({ type: type }, ORIGIN || "*");
    } catch (e) {}
  }
  window.$marktasks.open = function () {
    cmd("marktasks:open");
  };
  window.$marktasks.close = function () {
    cmd("marktasks:close");
  };
})();
