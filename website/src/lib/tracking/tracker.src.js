/**
 * Rearvy Website Tracking Script (source version)
 *
 * Tracks pageviews, clicks, scroll depth, and custom events.
 * Uses first-party cookies for visitor identification.
 * SPA-aware via history API patching.
 *
 * Embed: <script defer src="https://your-app.com/t.js" data-site="rv_xxx"></script>
 * Custom events: window.rearvy.track('event_name', { key: 'value' })
 */
(function () {
  "use strict";

  var scriptEl = document.currentScript;
  if (!scriptEl) return;
  var siteId = scriptEl.getAttribute("data-site");
  if (!siteId) return;

  // Derive collection endpoint from this script's own URL
  var scriptUrl = scriptEl.src || scriptEl.getAttribute("src") || "";
  var ENDPOINT;
  try {
    ENDPOINT = new URL("/api/tracking/collect", scriptUrl).href;
  } catch {
    return; // cannot determine endpoint
  }

  var FLUSH_MS = 5000;
  var COOKIE_DAYS = 365;
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  // --- Utilities ---
  function genId() {
    var a = "abcdefghijklmnopqrstuvwxyz0123456789";
    var r;
    try {
      r = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(r);
    } catch {
      r = [];
      for (var i = 0; i < 12; i++) r.push(Math.floor(Math.random() * 256));
    }
    var s = "";
    for (var j = 0; j < 12; j++) s += a[r[j] % a.length];
    return s;
  }

  function getCookie(n) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(n, v, days) {
    var s = n + "=" + encodeURIComponent(v) + "; path=/; SameSite=Lax";
    if (days) s += "; max-age=" + days * 86400;
    document.cookie = s;
  }

  // --- Visitor & Session ---
  var visitorId = getCookie("_rv_id");
  if (!visitorId) {
    visitorId = genId();
    setCookie("_rv_id", visitorId, COOKIE_DAYS);
  }

  var sessionId = getCookie("_rv_sid");
  var sessionTs = parseInt(getCookie("_rv_st") || "0", 10);
  var now = Date.now();
  if (!sessionId || now - sessionTs > SESSION_TIMEOUT_MS) {
    sessionId = genId();
    setCookie("_rv_sid", sessionId);
  }
  setCookie("_rv_st", String(now));

  // --- Event Queue ---
  var queue = [];

  function enqueue(evt) {
    evt.visitor_id = visitorId;
    evt.session_id = sessionId;
    evt.timestamp = new Date().toISOString();
    evt.url = location.href;
    evt.path = location.pathname;
    queue.push(evt);
    setCookie("_rv_st", String(Date.now()));
  }

  function flush() {
    if (!queue.length) return;
    var events = queue.splice(0, queue.length);
    var body = JSON.stringify({ site_id: siteId, events: events });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "text/plain" })
      );
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", ENDPOINT, true);
      xhr.setRequestHeader("Content-Type", "text/plain");
      xhr.send(body);
    }
  }

  // --- UTM Params ---
  function getUtmParams() {
    var params;
    try {
      params = new URLSearchParams(location.search);
    } catch {
      return {};
    }
    var utm = {};
    var keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];
    for (var i = 0; i < keys.length; i++) {
      var v = params.get(keys[i]);
      if (v) utm[keys[i]] = v;
    }
    return utm;
  }

  // --- Device Info ---
  function getBrowser() {
    var ua = navigator.userAgent;
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("Edg") > -1) return "Edge";
    if (ua.indexOf("OPR") > -1 || ua.indexOf("Opera") > -1) return "Opera";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    return "Other";
  }

  function getOS() {
    var ua = navigator.userAgent;
    if (ua.indexOf("Windows") > -1) return "Windows";
    if (ua.indexOf("Mac OS") > -1) return "macOS";
    if (ua.indexOf("Linux") > -1) return "Linux";
    if (ua.indexOf("Android") > -1) return "Android";
    if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1) return "iOS";
    return "Other";
  }

  function getDeviceInfo() {
    var w = window.innerWidth;
    return {
      screen_width: screen.width,
      screen_height: screen.height,
      device_type: w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop",
      browser: getBrowser(),
      os: getOS(),
    };
  }

  // --- Pageview Tracking ---
  var isFirstPageview = true;

  function trackPageview() {
    var evt = {
      type: "pageview",
      title: document.title,
      referrer: isFirstPageview ? document.referrer : "",
    };
    if (isFirstPageview) {
      var utm = getUtmParams();
      var device = getDeviceInfo();
      for (var k in utm) evt[k] = utm[k];
      for (var d in device) evt[d] = device[d];
      isFirstPageview = false;
    }
    enqueue(evt);
  }

  // --- Click Tracking ---
  document.addEventListener(
    "click",
    function (e) {
      var target = e.target;
      while (target && target !== document) {
        var tag = target.tagName;
        if (
          tag === "A" ||
          tag === "BUTTON" ||
          target.hasAttribute("data-rv-track")
        )
          break;
        target = target.parentElement;
      }
      if (!target || target === document) return;

      enqueue({
        type: "click",
        properties: {
          tag: target.tagName.toLowerCase(),
          text: (target.innerText || "").trim().substring(0, 100),
          href: target.href || null,
          id: target.id || null,
          classes: target.className
            ? String(target.className).substring(0, 200)
            : null,
        },
      });
    },
    true
  );

  // --- Scroll Depth ---
  var thresholds = [25, 50, 75, 100];
  var fired = {};
  var scrollTimer;

  function checkScroll() {
    var docH = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    var winH = window.innerHeight;
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var depth = Math.min(100, Math.round(((scrollTop + winH) / docH) * 100));

    for (var i = 0; i < thresholds.length; i++) {
      var t = thresholds[i];
      if (depth >= t && !fired[t]) {
        fired[t] = true;
        enqueue({ type: "scroll", properties: { depth: t } });
      }
    }
  }

  window.addEventListener(
    "scroll",
    function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(checkScroll, 200);
    },
    { passive: true }
  );

  // --- SPA Navigation ---
  var origPush = history.pushState;
  var origReplace = history.replaceState;

  function onNavigate() {
    fired = {};
    setTimeout(trackPageview, 0);
  }

  history.pushState = function () {
    origPush.apply(this, arguments);
    onNavigate();
  };
  history.replaceState = function () {
    origReplace.apply(this, arguments);
    onNavigate();
  };
  window.addEventListener("popstate", onNavigate);

  // --- Custom Event API ---
  window.rearvy = {
    track: function (eventName, properties) {
      if (!eventName || typeof eventName !== "string") return;
      enqueue({
        type: "custom",
        event_name: eventName,
        properties: properties || {},
      });
    },
  };

  // --- Flush ---
  setInterval(flush, FLUSH_MS);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  // --- Init ---
  trackPageview();
})();
