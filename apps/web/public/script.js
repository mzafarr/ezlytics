(function () {
  var script = document.currentScript;

  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i += 1) {
      var candidate = scripts[i];
      if (
        candidate.getAttribute("data-website-id") ||
        candidate.getAttribute("data-domain")
      ) {
        script = candidate;
        break;
      }
    }
  }

  var disableConsole = script && script.hasAttribute("data-disable-console");
  var websiteId = script ? script.getAttribute("data-website-id") : "";
  var domain = script ? script.getAttribute("data-domain") : "";

  function warn(message) {
    if (disableConsole) {
      return;
    }
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[Ralph Analytics] " + message);
    }
  }

  if (!websiteId || !domain) {
    warn(
      "Tracking disabled: missing required data-website-id or data-domain on the script tag."
    );
    return;
  }

  var existing = window.datafast;
  if (typeof existing !== "function") {
    var queue = [];
    var datafast = function () {
      queue.push(arguments);
    };
    datafast.q = queue;
    window.datafast = datafast;
  }

  var config = {
    websiteId: websiteId,
    domain: domain,
    disableConsole: disableConsole,
  };
  window.datafast.config = config;

  var VISITOR_COOKIE = "datafast_visitor_id";
  var SESSION_COOKIE = "datafast_session_id";
  var VISITOR_TTL = 60 * 60 * 24 * 365;
  var SESSION_TTL = 60 * 30;
  var EVENT_ENDPOINT = "/api/v1/ingest";
  var lastPath = null;

  function isSecureContext() {
    return typeof location !== "undefined" && location.protocol === "https:";
  }

  function getCurrentPath() {
    var path = "/";
    if (typeof location !== "undefined") {
      path = location.pathname || "/";
      if (location.search) {
        path += location.search;
      }
    }
    return path;
  }

  function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return (
      "df_" +
      Math.random().toString(16).slice(2) +
      Date.now().toString(16)
    );
  }

  function getCookie(name) {
    if (typeof document === "undefined") {
      return "";
    }
    var pattern = new RegExp("(^|;\\s*)" + name + "=([^;]*)");
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[2]) : "";
  }

  function setCookie(name, value, maxAgeSeconds) {
    if (typeof document === "undefined") {
      return;
    }
    var cookie = name + "=" + encodeURIComponent(value);
    cookie += "; Path=/";
    cookie += "; Max-Age=" + maxAgeSeconds;
    cookie += "; SameSite=Lax";
    if (isSecureContext()) {
      cookie += "; Secure";
    }
    document.cookie = cookie;
  }

  function getVisitorId() {
    var visitorId = getCookie(VISITOR_COOKIE);
    if (!visitorId) {
      visitorId = generateId();
    }
    setCookie(VISITOR_COOKIE, visitorId, VISITOR_TTL);
    return visitorId;
  }

  function getSessionId() {
    var sessionId = getCookie(SESSION_COOKIE);
    if (!sessionId) {
      sessionId = generateId();
    }
    setCookie(SESSION_COOKIE, sessionId, SESSION_TTL);
    return sessionId;
  }

  function sendEvent(payload, options) {
    var body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(EVENT_ENDPOINT, blob)) {
          return;
        }
      } catch (error) {
        // fall through to fetch
      }
    }
    if (typeof fetch === "function") {
      try {
        fetch(EVENT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: options && options.keepalive === true,
        });
      } catch (error) {
        // ignore network errors
      }
    }
  }

  function sendPageview(referrerOverride) {
    var payload = {
      type: "pageview",
      websiteId: websiteId,
      domain: domain,
      path: getCurrentPath(),
      referrer: referrerOverride || document.referrer || "",
      timestamp: new Date().toISOString(),
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
    };
    sendEvent(payload, { keepalive: true });
  }

  function handleRouteChange() {
    var currentPath = getCurrentPath();
    if (currentPath === lastPath) {
      return;
    }
    var previousPath = lastPath;
    lastPath = currentPath;
    sendPageview(previousPath || document.referrer || "");
  }

  lastPath = getCurrentPath();
  sendPageview(document.referrer || "");

  if (typeof history !== "undefined") {
    var originalPushState = history.pushState;
    if (typeof originalPushState === "function") {
      history.pushState = function () {
        originalPushState.apply(history, arguments);
        handleRouteChange();
      };
    }

    var originalReplaceState = history.replaceState;
    if (typeof originalReplaceState === "function") {
      history.replaceState = function () {
        originalReplaceState.apply(history, arguments);
        handleRouteChange();
      };
    }
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("popstate", handleRouteChange);
  }
})();
