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

  window.datafast.config = {
    websiteId: websiteId,
    domain: domain,
    disableConsole: disableConsole,
  };
})();
