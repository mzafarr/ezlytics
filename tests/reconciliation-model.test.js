import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "analytics-golden-dataset.json");

const toDay = (ts) => new Date(ts).toISOString().slice(0, 10);

const createMetrics = () => ({
  visitors: 0,
  sessions: 0,
  bounced: 0,
  duration: 0,
  pageviews: 0,
  goals: 0,
});

const addDimension = (target, dimension, value, delta) => {
  const label = value && String(value).trim() ? String(value).trim() : "unknown";
  if (!target[dimension]) {
    target[dimension] = {};
  }
  target[dimension][label] = (target[dimension][label] ?? 0) + delta;
  if (target[dimension][label] === 0) {
    delete target[dimension][label];
  }
};

const sessionContextFromEvent = (event) => ({
  country: event.country ?? null,
  device: event.device ?? "unknown",
  browser: event.browser ?? "unknown",
});

const simulateLive = (events) => {
  const daily = {};
  const visitorSets = new Map();
  const dimensions = { country: {}, device: {}, browser: {} };
  const sessions = new Map();

  const ensureDay = (day) => {
    if (!daily[day]) {
      daily[day] = createMetrics();
    }
    return daily[day];
  };

  for (const event of events) {
    if (event.bot) {
      continue;
    }

    const day = toDay(event.ts);
    const dayMetrics = ensureDay(day);

    if (event.type === "pageview") {
      dayMetrics.pageviews += 1;
      const visitorKey = `${day}|${event.visitorId}`;
      if (!visitorSets.has(visitorKey)) {
        visitorSets.set(visitorKey, true);
        dayMetrics.visitors += 1;
      }

      if (!event.sessionId) {
        continue;
      }

      const sessionKey = `${event.sessionId}|${event.visitorId}`;
      const context = sessionContextFromEvent(event);
      const existing = sessions.get(sessionKey);
      if (!existing) {
        sessions.set(sessionKey, {
          firstTs: event.ts,
          lastTs: event.ts,
          pageviews: 1,
          context,
        });
        dayMetrics.sessions += 1;
        dayMetrics.bounced += 1;
        addDimension(dimensions, "country", context.country, 1);
        addDimension(dimensions, "device", context.device, 1);
        addDimension(dimensions, "browser", context.browser, 1);
        continue;
      }

      const prevFirst = existing.firstTs;
      const prevLast = existing.lastTs;
      const prevPageviews = existing.pageviews;
      const prevDuration = Math.max(0, prevLast - prevFirst);
      const prevDay = toDay(prevFirst);
      const prevContext = existing.context;

      const nextFirst = Math.min(prevFirst, event.ts);
      const nextLast = Math.max(prevLast, event.ts);
      const nextDuration = Math.max(0, nextLast - nextFirst);
      const nextDay = toDay(nextFirst);
      const nextContext = event.ts < prevFirst ? context : prevContext;

      existing.firstTs = nextFirst;
      existing.lastTs = nextLast;
      existing.pageviews = prevPageviews + 1;
      existing.context = nextContext;

      if (prevDay !== nextDay) {
        ensureDay(prevDay).sessions -= 1;
        if (prevPageviews === 1) {
          ensureDay(prevDay).bounced -= 1;
        }
        if (prevDuration) {
          ensureDay(prevDay).duration -= prevDuration;
        }

        ensureDay(nextDay).sessions += 1;
        if (existing.pageviews === 1) {
          ensureDay(nextDay).bounced += 1;
        }
        if (nextDuration) {
          ensureDay(nextDay).duration += nextDuration;
        }
      } else {
        if (prevPageviews === 1) {
          ensureDay(nextDay).bounced -= 1;
        }
        const delta = nextDuration - prevDuration;
        if (delta) {
          ensureDay(nextDay).duration += delta;
        }
      }

      const contextChanged =
        prevContext.country !== nextContext.country ||
        prevContext.device !== nextContext.device ||
        prevContext.browser !== nextContext.browser;
      if (contextChanged) {
        addDimension(dimensions, "country", prevContext.country, -1);
        addDimension(dimensions, "device", prevContext.device, -1);
        addDimension(dimensions, "browser", prevContext.browser, -1);
        addDimension(dimensions, "country", nextContext.country, 1);
        addDimension(dimensions, "device", nextContext.device, 1);
        addDimension(dimensions, "browser", nextContext.browser, 1);
      }
    } else if (event.type === "goal") {
      dayMetrics.goals += 1;
    }
  }

  return { daily, sessionDimensions: dimensions };
};

const simulateRebuild = (events) => {
  const daily = {};
  const visitorSets = new Map();
  const sessions = new Map();
  const dimensions = { country: {}, device: {}, browser: {} };

  const ensureDay = (day) => {
    if (!daily[day]) {
      daily[day] = createMetrics();
    }
    return daily[day];
  };

  for (const event of events) {
    if (event.bot) {
      continue;
    }
    const day = toDay(event.ts);
    const dayMetrics = ensureDay(day);

    if (event.type === "pageview") {
      dayMetrics.pageviews += 1;
      const visitorKey = `${day}|${event.visitorId}`;
      if (!visitorSets.has(visitorKey)) {
        visitorSets.set(visitorKey, true);
        dayMetrics.visitors += 1;
      }

      if (event.sessionId) {
        const sessionKey = `${event.sessionId}|${event.visitorId}`;
        const existing = sessions.get(sessionKey);
        if (!existing) {
          sessions.set(sessionKey, {
            firstTs: event.ts,
            lastTs: event.ts,
            pageviews: 1,
            context: sessionContextFromEvent(event),
          });
        } else {
          if (event.ts < existing.firstTs) {
            existing.firstTs = event.ts;
            existing.context = sessionContextFromEvent(event);
          }
          existing.lastTs = Math.max(existing.lastTs, event.ts);
          existing.pageviews += 1;
        }
      }
    } else if (event.type === "goal") {
      dayMetrics.goals += 1;
    }
  }

  for (const state of sessions.values()) {
    const day = toDay(state.firstTs);
    const dayMetrics = ensureDay(day);
    dayMetrics.sessions += 1;
    if (state.pageviews === 1) {
      dayMetrics.bounced += 1;
    }
    dayMetrics.duration += Math.max(0, state.lastTs - state.firstTs);
    addDimension(dimensions, "country", state.context.country, 1);
    addDimension(dimensions, "device", state.context.device, 1);
    addDimension(dimensions, "browser", state.context.browser, 1);
  }

  return { daily, sessionDimensions: dimensions };
};

const makeRandomEvents = (count, seed) => {
  let x = seed;
  const rnd = () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };

  const visitors = ["v1", "v2", "v3", "v4", "v5"];
  const sessions = ["s1", "s2", "s3", "s4", "s5"];
  const countries = ["US", "CA", "IN", "BR", null];
  const devices = ["desktop", "mobile", "tablet"];
  const browsers = ["chrome", "safari", "firefox"];
  const baseTs = Date.parse("2025-01-01T00:00:00.000Z");

  const events = [];
  for (let i = 0; i < count; i += 1) {
    const typePick = rnd();
    const type = typePick < 0.7 ? "pageview" : typePick < 0.9 ? "goal" : "payment";
    const tsOffset = Math.floor(rnd() * 3 * 24 * 60 * 60 * 1000);
    events.push({
      ts: baseTs + tsOffset,
      type,
      visitorId: visitors[Math.floor(rnd() * visitors.length)],
      sessionId: sessions[Math.floor(rnd() * sessions.length)],
      bot: rnd() < 0.1,
      country: countries[Math.floor(rnd() * countries.length)],
      device: devices[Math.floor(rnd() * devices.length)],
      browser: browsers[Math.floor(rnd() * browsers.length)],
    });
  }
  return events;
};

test("golden dataset matches expected daily/session-dimension metrics", () => {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const actual = simulateRebuild(fixture.events);
  assert.deepEqual(actual.daily, fixture.expected.daily);
  assert.deepEqual(actual.sessionDimensions, fixture.expected.sessionDimensions);
});

test("property-style consistency: live model equals rebuild model", () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const events = makeRandomEvents(120, seed);
    const live = simulateLive(events);
    const rebuild = simulateRebuild(events);
    assert.deepEqual(live.daily, rebuild.daily);
    assert.deepEqual(live.sessionDimensions, rebuild.sessionDimensions);
  }
});
