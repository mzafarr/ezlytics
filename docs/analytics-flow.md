# Analytics Tracking Flow

This document outlines the flow of data from the client browser to the ingest server, including how "Active Visitors" (visitors now) are tracked.

## High-Level Diagram

```text
BROWSER (Client Website)                    SERVER (Analytics API)
══════════════════════════════              ══════════════════════════════════════

Page loads, script.js runs
         │
         ▼
   ┌─────────────────┐
   │  Guard Checks   │  (client-side, in script.js)
   │                 │
   │ ✗ in iframe?    │──► exit silently
   │ ✗ file://       │──► exit silently
   │ ✗ localhost     │──► exit (unless data-allow-localhost)
   │ ✗ missing keys  │──► warn + exit
   │ ✗ DNT enabled?  │──► exit (respects browser setting)
   └────────┬────────┘
            │ all checks pass
            ▼
   ┌─────────────────┐
   │  Track pageview │
   │  on load &      │
   │  navigation     │
   └────────┬────────┘
            │
            │  Generates payload and sends:
            │  (type: "pageview", visitorId, sessionId, path, etc.)
            │
            ▼
   ┌─────────────────┐        HTTP POST (sendBeacon / fetch)        ┌─────────────────┐
   │  sendEvent()    │─────────────────────────────────────────────►│ /api/v1/ingest  │
   │  (+ retry loop) │                                              │ (Route Handler) │
   └─────────────────┘                                              └────────┬────────┘
                                                                             │
         ┌───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Server-side Validation & Ingest                                 │
│                                                                  │
│  1. AUTH: Check API key matches websiteId.                       │
│  2. DOMAIN: Check Origin/Referer matches registered domain.      │
│     * (Bypassed if NODE_ENV=development and Origin=localhost)    │
│  3. BOT DETECTION: Parse User-Agent.                             │
│  4. TIME & SCHEMA: Validate payload timestamp and shape.         │
│  5. DATABASE: Insert into raw_events & update rollups/metrics.   │
└──────────────────────────────────────────────────────────────────┘
```

## How "Visitors Now" (Active Visitors) Works

When tracking real-time active visitors, the tool needs to know if a user is still looking at the page without keeping a heavy, persistent WebSocket connection open. It does this using a "Heartbeat" mechanism.

### The Heartbeat Cycle

1. **Active Tab:** While the user is actively viewing the website (the tab is visible), `script.js` sends a silent `heartbeat` event every **30 seconds**.
2. **Background Tab:** If the user switches to a different tab or minimizes the browser, the script pauses the heartbeat loop (using the `visibilitychange` event). They are no longer considered "active" after 1 minute.
3. **Closing the Tab:** If the user closes the tab, the script simply dies and stops sending heartbeats.

### Why does it take 1 minute to drop to 0?

Because the server doesn't get a notification when the user closes the tab, it calculates "Visitors Now" by asking: _"Which visitors have sent a pageview **or heartbeat** event in the last **1 minute**?"_

If a user closes the tab or switches to another tab:

1. Their heartbeats stop immediately.
2. After **~1 minute**, they drop off the Visitors Now count.

**Conclusion:** Dropping from 1 to 0 in 30–60 seconds after closing the tab or switching to another tab is the exact intended behavior and is completely normal for modern analytics engines.

## Event Types Included

- **`pageview`**: Sent automatically on page load and SPA navigations (intercepting history.pushState).
- **`heartbeat`**: Sent every 30 seconds while the page is visible.
- **`goal`**: Sent when a user triggers a tracked action (e.g., clicking a button with `data-fast-goal="signup"`).
- **`identify`**: Sent manually via `window.ezlytics("identify", {...})` to attach user data (like an email) to their visitor ID.
