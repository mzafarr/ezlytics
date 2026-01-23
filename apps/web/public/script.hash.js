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
  var apiKey = script ? script.getAttribute("data-api-key") : "";
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

  if (!websiteId || !domain || !apiKey) {
    warn(
      "Tracking disabled: missing required data-website-id, data-domain, or data-api-key on the script tag."
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

  function normalizeCookieDomain(value) {
    if (!value) {
      return "";
    }
    var trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return "";
    }
    trimmed = trimmed.replace(/^[a-z]+:\/\//i, "");
    if (trimmed.indexOf("//") === 0) {
      trimmed = trimmed.slice(2);
    }
    var slashIndex = trimmed.indexOf("/");
    if (slashIndex !== -1) {
      trimmed = trimmed.slice(0, slashIndex);
    }
    var colonIndex = trimmed.indexOf(":");
    if (colonIndex !== -1) {
      trimmed = trimmed.slice(0, colonIndex);
    }
    if (trimmed.charAt(0) === ".") {
      trimmed = trimmed.slice(1);
    }
    if (!trimmed || isLocalhost(trimmed)) {
      return "";
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
      return "";
    }
    if (trimmed.indexOf(".") === -1) {
      return "";
    }
    return trimmed;
  }

  function getRootDomain(hostname) {
    if (!hostname) {
      return "";
    }
    var parts = hostname.split(".");
    if (parts.length <= 2) {
      return hostname;
    }
    var compoundTlds = {
      "ac.uk": true,
      "co.uk": true,
      "org.uk": true,
      "gov.uk": true,
      "com.au": true,
      "net.au": true,
      "org.au": true,
      "co.nz": true,
      "com.br": true,
      "com.mx": true,
      "com.tr": true,
      "co.jp": true,
      "co.kr": true,
      "com.sg": true,
      "com.tw": true,
      "com.cn": true,
      "com.hk": true,
      "com.my": true,
      "com.ph": true,
      "com.vn": true,
      "com.pk": true,
      "com.sa": true,
      "com.ng": true,
      "co.in": true,
      "co.za": true,
    };
    var last = parts[parts.length - 1];
    var second = parts[parts.length - 2];
    var third = parts[parts.length - 3];
    var compound = second + "." + last;
    if (compoundTlds[compound] && third) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  }

  function hostnameMatchesDomain(hostname, domainValue) {
    if (!hostname || !domainValue) {
      return false;
    }
    return (
      hostname === domainValue ||
      hostname.slice(-domainValue.length - 1) === "." + domainValue
    );
  }

  function resolveCookieDomain(value) {
    var normalized = normalizeCookieDomain(value);
    if (!normalized) {
      return "";
    }
    if (typeof location === "undefined") {
      return getRootDomain(normalized);
    }
    var hostname = location.hostname || "";
    if (!hostnameMatchesDomain(hostname, normalized)) {
      return "";
    }
    return getRootDomain(normalized);
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
  var queue = [];
  if (typeof existing === "function" && existing.q) {
    queue = existing.q;
  }
  var datafast = function () {
    queue.push(arguments);
  };
  datafast.q = queue;
  window.datafast = datafast;

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

  function isDoNotTrackEnabled() {
    if (typeof navigator === "undefined") {
      return false;
    }
    var dnt =
      navigator.doNotTrack ||
      (typeof window !== "undefined" && window.doNotTrack) ||
      navigator.msDoNotTrack;
    if (!dnt) {
      return false;
    }
    var value = String(dnt).toLowerCase();
    return value === "1" || value === "yes" || value === "true";
  }

  if (isDoNotTrackEnabled()) {
    warn("Do Not Track is enabled: tracking disabled.");
    window.datafast = function () {};
    window.datafast.q = [];
    window.datafast.config = config;
    return;
  }

  var VISITOR_COOKIE = "datafast_visitor_id";
  var SESSION_COOKIE = "datafast_session_id";
  var VISITOR_TTL = 60 * 60 * 24 * 365;
  var SESSION_TTL = 60 * 30;
  var EVENT_ENDPOINT = normalizeApiUrl(apiUrlRaw, "/api/v1/ingest");
  var COOKIE_DOMAIN = resolveCookieDomain(domain);
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
  var RETRY_LIMIT = 3;
  var RETRY_BASE_DELAY = 1000;
  var RETRY_MAX_DELAY = 15000;
  var retryQueue = [];
  var retryTimer = null;

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
    if (COOKIE_DOMAIN) {
      cookie += "; Domain=" + COOKIE_DOMAIN;
    }
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

  function scheduleRetry() {
    if (retryTimer || retryQueue.length === 0) {
      return;
    }
    var entry = retryQueue[0];
    var delay = RETRY_BASE_DELAY * Math.pow(2, entry.attempt - 1);
    if (delay > RETRY_MAX_DELAY) {
      delay = RETRY_MAX_DELAY;
    }
    retryTimer = setTimeout(function () {
      retryTimer = null;
      var next = retryQueue.shift();
      if (next) {
        sendEvent(next.payload, next.options, next.attempt);
      }
      scheduleRetry();
    }, delay);
  }

  function queueRetry(payload, options, attempt) {
    if (attempt >= RETRY_LIMIT) {
      warn("Event dropped after retry attempts.");
      return;
    }
    retryQueue.push({
      payload: payload,
      options: options,
      attempt: attempt + 1,
    });
    scheduleRetry();
  }

  function sendEvent(payload, options, attempt) {
    var attemptCount = attempt || 0;
    var body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        var beaconUrl = EVENT_ENDPOINT;
        if (apiKey) {
          var joiner = beaconUrl.indexOf("?") === -1 ? "?" : "&";
          beaconUrl = beaconUrl + joiner + "api_key=" + encodeURIComponent(apiKey);
        }
        if (navigator.sendBeacon(beaconUrl, blob)) {
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
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey,
          },
          body: body,
          keepalive: options && options.keepalive === true,
        })
          .then(function (response) {
            if (!response || !response.ok) {
              queueRetry(payload, options, attemptCount);
            }
          })
          .catch(function () {
            queueRetry(payload, options, attemptCount);
          });
        return;
      } catch (error) {
        queueRetry(payload, options, attemptCount);
      }
      return;
    }
    queueRetry(payload, options, attemptCount);
  }

  function normalizeGoalName(value) {
    if (!value) {
      return "";
    }
    var trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed;
  }

  function isValidGoalName(value) {
    if (!value || value.length > 64) {
      return false;
    }
    return /^[a-z0-9_-]+$/.test(value);
  }

  function normalizeMetadataKey(value) {
    if (!value) {
      return "";
    }
    var trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return "";
    }
    var normalized = trimmed.replace(/-/g, "_");
    if (normalized.length > 64) {
      return "";
    }
    return normalized;
  }

  function sanitizeMetadataValue(value) {
    if (value === null || value === undefined) {
      return "";
    }
    var stringValue = String(value);
    if (!stringValue) {
      return "";
    }
    var cleaned = stringValue.replace(/<[^>]*>/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return "";
    }
    if (cleaned.length > 255) {
      return cleaned.slice(0, 255);
    }
    return cleaned;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function sanitizeIdentifyValue(value, maxLength) {
    if (value === null || value === undefined) {
      return "";
    }
    var stringValue = String(value);
    if (!stringValue) {
      return "";
    }
    var cleaned = stringValue.replace(/<[^>]*>/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return "";
    }
    if (cleaned.length > maxLength) {
      return cleaned.slice(0, maxLength);
    }
    return cleaned;
  }

  function getGoalMetadata(element) {
    if (!element || !element.attributes) {
      return null;
    }
    var metadata = {};
    var count = 0;
    for (var i = 0; i < element.attributes.length; i += 1) {
      var attribute = element.attributes[i];
      if (!attribute || !attribute.name) {
        continue;
      }
      var attributeName = attribute.name;
      if (attributeName.indexOf("data-fast-goal-") !== 0) {
        continue;
      }
      var rawKey = attributeName.slice("data-fast-goal-".length);
      var key = normalizeMetadataKey(rawKey);
      if (!key) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(metadata, key)) {
        continue;
      }
      var value = sanitizeMetadataValue(attribute.value);
      if (!value) {
        continue;
      }
      metadata[key] = value;
      count += 1;
      if (count >= 10) {
        break;
      }
    }
    return count > 0 ? metadata : null;
  }

  function buildIdentifyMetadata(payload) {
    if (!payload) {
      return null;
    }
    var metadata = {};
    var count = 0;
    for (var i = 0; i < Object.keys(payload).length; i += 1) {
      var rawKey = Object.keys(payload)[i];
      if (!rawKey) {
        continue;
      }
      if (
        rawKey === "user_id" ||
        rawKey === "userId" ||
        rawKey === "name" ||
        rawKey === "image"
      ) {
        continue;
      }
      var key = normalizeMetadataKey(rawKey);
      if (!key) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(metadata, key)) {
        continue;
      }
      var value = sanitizeMetadataValue(payload[rawKey]);
      if (!value) {
        continue;
      }
      metadata[key] = value;
      count += 1;
      if (count >= 10) {
        break;
      }
    }
    return count > 0 ? metadata : null;
  }

  function normalizeIdentifyPayload(payload) {
    if (!isPlainObject(payload)) {
      warn("Identify skipped: payload must be an object.");
      return null;
    }
    var userId = sanitizeIdentifyValue(payload.user_id || payload.userId, 128);
    if (!userId) {
      warn("Identify skipped: user_id is required.");
      return null;
    }
    var name = sanitizeIdentifyValue(payload.name, 255);
    var image = sanitizeIdentifyValue(payload.image, 255);
    var metadata = buildIdentifyMetadata(payload);
    return {
      userId: userId,
      name: name,
      image: image,
      metadata: metadata,
    };
  }

  function findGoalElement(target) {
    var node = target;
    while (node && node !== document.documentElement) {
      if (node.getAttribute && node.hasAttribute("data-fast-goal")) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function parseScrollThreshold(value) {
    if (!value) {
      return 0.5;
    }
    var parsed = parseFloat(value);
    if (isNaN(parsed)) {
      return 0.5;
    }
    if (parsed <= 0) {
      return 0.01;
    }
    if (parsed > 1) {
      return 1;
    }
    return parsed;
  }

  function parseScrollDelay(value) {
    if (!value) {
      return 0;
    }
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }

  function isEligibleScrollTarget(element) {
    if (!element || !element.getAttribute) {
      return false;
    }
    var value = element.getAttribute("data-fast-scroll");
    return value !== null;
  }

  function buildScrollGoalName(element) {
    if (!element || !element.getAttribute) {
      return "";
    }
    var rawName = element.getAttribute("data-fast-scroll") || "";
    var name = normalizeGoalName(rawName);
    if (!name) {
      return "scroll";
    }
    if (!isValidGoalName(name)) {
      warn(
        'Invalid scroll goal name "' +
          rawName +
          '". Scroll goal names must be lowercase letters, numbers, underscores, or hyphens and at most 64 characters.'
      );
      return "";
    }
    return name;
  }

  function scheduleScrollGoal(name, metadata, delayValue) {
    if (delayValue > 0) {
      setTimeout(function () {
        sendGoal(name, metadata);
      }, delayValue);
      return;
    }
    sendGoal(name, metadata);
  }

  function sendGoal(name, metadata) {
    var now = Date.now();
    var payload = {
      type: "goal",
      name: name,
      websiteId: websiteId,
      eventId: generateId(),
      domain: domain,
      path: getCurrentPath(),
      referrer: document.referrer || "",
      ts: now,
      timestamp: new Date(now).toISOString(),
      visitorId: getVisitorId(),
      session_id: getSessionId(),
    };
    if (metadata) {
      payload.metadata = metadata;
    }
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

  function sendIdentify(payload) {
    var normalized = normalizeIdentifyPayload(payload);
    if (!normalized) {
      return;
    }
    var now = Date.now();
    var identifyPayload = {
      type: "identify",
      websiteId: websiteId,
      eventId: generateId(),
      domain: domain,
      path: getCurrentPath(),
      referrer: document.referrer || "",
      ts: now,
      timestamp: new Date(now).toISOString(),
      visitorId: getVisitorId(),
      session_id: getSessionId(),
      user_id: normalized.userId,
    };
    if (normalized.name) {
      identifyPayload.name = normalized.name;
    }
    if (normalized.image) {
      identifyPayload.image = normalized.image;
    }
    if (normalized.metadata) {
      identifyPayload.metadata = normalized.metadata;
    }
    var tracking = getTrackingParams();
    if (tracking) {
      for (var key in tracking) {
        if (Object.prototype.hasOwnProperty.call(tracking, key)) {
          identifyPayload[key] = tracking[key];
        }
      }
    }
    sendEvent(identifyPayload, { keepalive: true });
  }

  function handleGoalClick(event) {
    var target = event && (event.target || event.srcElement);
    if (!target) {
      return;
    }
    if (target.nodeType === 3) {
      target = target.parentNode;
    }
    var goalElement = findGoalElement(target);
    if (!goalElement) {
      return;
    }
    var rawName = goalElement.getAttribute("data-fast-goal") || "";
    var name = normalizeGoalName(rawName);
    if (!isValidGoalName(name)) {
      warn(
        'Invalid goal name "' +
          rawName +
          '". Goal names must be lowercase letters, numbers, underscores, or hyphens and at most 64 characters.'
      );
      return;
    }
    var metadata = getGoalMetadata(goalElement);
    sendGoal(name, metadata);
  }

  function sendPageview(referrerOverride) {
    var now = Date.now();
    var payload = {
      type: "pageview",
      websiteId: websiteId,
      eventId: generateId(),
      domain: domain,
      path: getCurrentPath(),
      referrer: referrerOverride || document.referrer || "",
      ts: now,
      timestamp: new Date(now).toISOString(),
      visitorId: getVisitorId(),
      session_id: getSessionId(),
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

  function handleDatafastCommand(args) {
    if (!args || args.length === 0) {
      return;
    }
    var command = args[0];
    if (command === "identify") {
      sendIdentify(args[1]);
    }
  }

  function installDatafastHandler() {
    window.datafast = function () {
      handleDatafastCommand(arguments);
    };
    window.datafast.q = queue;
    if (!queue || queue.length === 0) {
      return;
    }
    for (var i = 0; i < queue.length; i += 1) {
      handleDatafastCommand(queue[i]);
    }
    queue.length = 0;
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

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("click", handleGoalClick, true);
  }

  if (
    typeof IntersectionObserver !== "undefined" &&
    typeof document !== "undefined"
  ) {
    function observeScrollTarget(element) {
      if (!isEligibleScrollTarget(element)) {
        return;
      }
      if (element.getAttribute("data-fast-scroll-fired") === "true") {
        return;
      }
      var name = buildScrollGoalName(element);
      if (!name) {
        element.setAttribute("data-fast-scroll-fired", "true");
        return;
      }
      var thresholdValue = parseScrollThreshold(
        element.getAttribute("data-fast-scroll-threshold")
      );
      var delayValue = parseScrollDelay(
        element.getAttribute("data-fast-scroll-delay")
      );
      var metadata = getGoalMetadata(element);
      var scrollObserver = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i += 1) {
            var entry = entries[i];
            if (!entry || !entry.isIntersecting) {
              continue;
            }
            if (entry.intersectionRatio < thresholdValue) {
              continue;
            }
            element.setAttribute("data-fast-scroll-fired", "true");
            scrollObserver.unobserve(element);
            scrollObserver.disconnect();
            scheduleScrollGoal(name, metadata, delayValue);
          }
        },
        { root: null, threshold: thresholdValue }
      );
      scrollObserver.observe(element);
    }

    var scrollTargets = document.querySelectorAll("[data-fast-scroll]");
    for (var j = 0; j < scrollTargets.length; j += 1) {
      observeScrollTarget(scrollTargets[j]);
    }
  }

  installDatafastHandler();
})();
