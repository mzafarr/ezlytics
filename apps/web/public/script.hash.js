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
  var debug = script && script.hasAttribute("data-debug");
  var allowLocalhost = script && script.hasAttribute("data-allow-localhost");
  var allowFileProtocol =
    script && script.hasAttribute("data-allow-file-protocol");
  var websiteId = script ? script.getAttribute("data-website-id") : "";
  var domain = script ? script.getAttribute("data-domain") : "";
  var allowedHostnamesRaw = script
    ? script.getAttribute("data-allowed-hostnames")
    : "";
  var apiUrlRaw = script ? script.getAttribute("data-api-url") : "";

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

  function parseAllowedHostnames(value) {
    if (!value) {
      return [];
    }
    return value
      .split(/[\s,]+/)
      .map(function (entry) {
        return entry.trim();
      })
      .filter(Boolean);
  }

  function normalizeApiUrl(value, fallback) {
    if (!value) {
      return fallback;
    }
    var trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    if (
      trimmed.indexOf("http://") === 0 ||
      trimmed.indexOf("https://") === 0 ||
      trimmed.indexOf("//") === 0 ||
      trimmed.indexOf(".") === 0 ||
      trimmed.indexOf("/") === 0
    ) {
      return trimmed;
    }
    return "/" + trimmed;
  }

  function isInIframe() {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.self !== window.top;
    } catch (error) {
      return true;
    }
  }

  function isLocalhost(hostname) {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  }

  function hostnameAllowed(hostname, allowlist) {
    if (!allowlist || allowlist.length === 0) {
      return true;
    }
    for (var i = 0; i < allowlist.length; i += 1) {
      var entry = allowlist[i];
      if (!entry) {
        continue;
      }
      if (entry.indexOf(".") === 0) {
        if (hostname.slice(-entry.length) === entry) {
          return true;
        }
        continue;
      }
      if (hostname === entry || hostname.slice(-entry.length - 1) === "." + entry) {
        return true;
      }
    }
    return false;
  }

  var allowedHostnames = parseAllowedHostnames(allowedHostnamesRaw);

  if (!debug && isInIframe()) {
    warn("Tracking disabled: script is running inside an iframe.");
    return;
  }

  if (typeof location !== "undefined") {
    if (location.protocol === "file:" && !allowFileProtocol) {
      warn("Tracking disabled: file protocol is not allowed.");
      return;
    }
    if (!allowLocalhost && isLocalhost(location.hostname || "")) {
      warn("Tracking disabled: localhost is not allowed.");
      return;
    }
    if (!hostnameAllowed(location.hostname || "", allowedHostnames)) {
      warn("Tracking disabled: hostname is not in the allowed list.");
      return;
    }
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
    debug: debug,
    allowLocalhost: allowLocalhost,
    allowFileProtocol: allowFileProtocol,
    allowedHostnames: allowedHostnames,
  };
  if (apiUrlRaw) {
    config.apiUrl = apiUrlRaw;
  }
  window.datafast.config = config;

  var VISITOR_COOKIE = "datafast_visitor_id";
  var SESSION_COOKIE = "datafast_session_id";
  var VISITOR_TTL = 60 * 60 * 24 * 365;
  var SESSION_TTL = 60 * 30;
  var EVENT_ENDPOINT = normalizeApiUrl(apiUrlRaw, "/api/v1/ingest");
  var lastPath = null;
  var TRACKING_KEYS = [
    "ref",
    "source",
    "via",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];
  var lastTracking = null;

  function isSecureContext() {
    return typeof location !== "undefined" && location.protocol === "https:";
  }

  function normalizeHashPath(hashValue) {
    var normalized = hashValue.charAt(0) === "#" ? hashValue.slice(1) : hashValue;
    if (!normalized) {
      return "/";
    }
    if (normalized.charAt(0) !== "/") {
      return "/" + normalized;
    }
    return normalized;
  }

  function getCurrentPath() {
    var path = "/";
    if (typeof location !== "undefined") {
      var hash = location.hash || "";
      if (hash) {
        path = normalizeHashPath(hash);
      } else {
        path = location.pathname || "/";
        if (location.search) {
          path += location.search;
        }
      }
    }
    return path;
  }

  function decodeParamValue(value) {
    if (!value) {
      return "";
    }
    var replaced = value.replace(/\+/g, " ");
    try {
      return decodeURIComponent(replaced);
    } catch (error) {
      return replaced;
    }
  }

  function normalizeTrackingKey(value) {
    if (!value) {
      return "";
    }
    var decoded = decodeParamValue(value);
    return decoded.trim().toLowerCase();
  }

  function normalizeTrackingValue(value) {
    if (!value) {
      return "";
    }
    var decoded = decodeParamValue(value);
    var trimmed = decoded.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.toLowerCase();
  }

  function parseTrackingParams(query) {
    if (!query) {
      return null;
    }
    var queryString = query.charAt(0) === "?" ? query.slice(1) : query;
    if (!queryString) {
      return null;
    }
    var values = {};
    var found = false;
    if (typeof URLSearchParams !== "undefined") {
      var params = new URLSearchParams(queryString);
      for (var i = 0; i < TRACKING_KEYS.length; i += 1) {
        var key = TRACKING_KEYS[i];
        if (params.has(key)) {
          var value = normalizeTrackingValue(params.get(key));
          if (value) {
            values[key] = value;
            found = true;
          }
        }
      }
      return found ? values : null;
    }

    var keyLookup = {};
    for (var j = 0; j < TRACKING_KEYS.length; j += 1) {
      keyLookup[TRACKING_KEYS[j]] = true;
    }

    var pairs = queryString.split("&");
    for (var k = 0; k < pairs.length; k += 1) {
      var pair = pairs[k];
      if (!pair) {
        continue;
      }
      var equalsIndex = pair.indexOf("=");
      var rawKey = equalsIndex === -1 ? pair : pair.slice(0, equalsIndex);
      var normalizedKey = normalizeTrackingKey(rawKey);
      if (!normalizedKey || !keyLookup[normalizedKey]) {
        continue;
      }
      var rawValue = equalsIndex === -1 ? "" : pair.slice(equalsIndex + 1);
      var normalizedValue = normalizeTrackingValue(rawValue);
      if (!normalizedValue) {
        continue;
      }
      values[normalizedKey] = normalizedValue;
      found = true;
    }
    return found ? values : null;
  }

  function mergeTrackingParams(previous, current) {
    if (!previous && !current) {
      return null;
    }
    var merged = {};
    var hasAny = false;
    for (var i = 0; i < TRACKING_KEYS.length; i += 1) {
      var key = TRACKING_KEYS[i];
      var value = "";
      if (current && current[key]) {
        value = current[key];
      } else if (previous && previous[key]) {
        value = previous[key];
      }
      if (value) {
        merged[key] = value;
        hasAny = true;
      }
    }
    return hasAny ? merged : null;
  }

  function parseHashTrackingParams(hashValue) {
    if (!hashValue) {
      return null;
    }
    var queryIndex = hashValue.indexOf("?");
    if (queryIndex === -1) {
      return null;
    }
    return parseTrackingParams(hashValue.slice(queryIndex + 1));
  }

  function getTrackingParams() {
    if (typeof location === "undefined") {
      return lastTracking;
    }
    var searchParams = parseTrackingParams(location.search || "");
    var hashParams = parseHashTrackingParams(location.hash || "");
    var current = mergeTrackingParams(searchParams, hashParams);
    if (current) {
      lastTracking = mergeTrackingParams(lastTracking, current);
    }
    return lastTracking;
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
    var tracking = getTrackingParams();
    if (tracking) {
      for (var key in tracking) {
        if (Object.prototype.hasOwnProperty.call(tracking, key)) {
          payload[key] = tracking[key];
        }
      }
    }
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
    window.addEventListener("hashchange", handleRouteChange);
  }
})();
