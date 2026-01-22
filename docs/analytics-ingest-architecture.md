# Analytics Ingest: ASCII Diagram + Logic Notes

```
Client
  |
  | POST /api/v1/ingest  (payload + api key)
  v
┌──────────────────────────────────────────────────────────┐
│ Ingest Route (apps/web/src/app/api/v1/ingest/route.ts)   │
├──────────────────────────────────────────────────────────┤
│ 1) Payload guardrails                                   │
│    - size limit + JSON parse                            │
│    - allowlist keys + schema validate                   │
│    - type rules (goal name, identify user_id)           │
│    - ts future bound                                    │
│                                                        │
│ 2) Auth + site binding                                  │
│    - verify API key → siteId/websiteId/domain           │
│    - websiteId must match payload                       │
│                                                        │
│ 3) Domain allowlist                                     │
│    - normalize payload.domain + site.domain             │
│    - allow exact match or subdomain                     │
│                                                        │
│ 4) Rate limit                                           │
│                                                        │
│ 5) Context enrich                                       │
│    - parse UA → device/browser/os                       │
│    - bot detect (UA signatures)                         │
│    - geo: headers → maxmind (if configured)             │
│                                                        │
│ 6) Timestamp resolve                                    │
│    - client ts accepted only if skew <= 5m              │
│    - createdAt = server time                            │
│    - event timestamp = client ts (if ok) else server    │
│    - rollup bucket uses event ts if ok else server      │
│                                                        │
│ 7) Insert raw_event                                     │
│    - dedupe by (site_id, event_id)                      │
│                                                        │
│ 8) Bot?                                                 │
│    - yes → return ok (skip rollups/session/visitors)    │
│                                                        │
│ 9) Metrics + rollups                                    │
│    - metricsForEvent (pageview/goals/revenue)           │
│    - unique visitor daily: visitor_daily               │
│        * insert unique (site,date,visitor)              │
│        * if insert ok → metrics.visitors += 1           │
│    - session metrics: analytics_session                 │
│        * first pageview inserts session (sessions+1,    │
│          bounced+1)                                     │
│        * later pageviews update last_timestamp +        │
│          pageviews; bouncedSessions -1 on 2nd view      │
│        * avgSessionDurationMs += delta                  │
│    - upsert hourly + daily rollups                      │
│    - upsert dimension rollups                           │
│                                                        │
│ 10) Response { ok: true }                               │
└──────────────────────────────────────────────────────────┘

Cron
  |
  | GET/POST /api/cron/retention (with secret)
  v
┌──────────────────────────────────────────────────────────┐
│ Retention Cleanup (apps/web/src/lib/retention.ts)       │
├──────────────────────────────────────────────────────────┤
│ - raw_event older than RAW_EVENT_RETENTION_DAYS         │
│ - analytics_session last_timestamp cutoff               │
│ - visitor_daily older than rollup daily cutoff          │
│ - rollup_* hourly/daily cutoffs                         │
└──────────────────────────────────────────────────────────┘
```

## Key Data Tables

- `raw_event`: full event log, includes normalized context + metadata.
- `visitor_daily`: unique visitor per site+day (drives “visitors” rollups).
- `analytics_session`: per session_id+visitor_id per site, tracks
  pageviews + first/last timestamps (drives sessions + bounce + avg duration).
- `rollup_hourly` / `rollup_daily`: fast dashboard aggregates.
- `rollup_dimension_*`: aggregates by page/referrer/utm/country/etc.

## Timestamp Rules (accuracy + anti‑fraud)

- Client `ts` accepted only if within ±5m of server time.
- Server time used for createdAt always.
- Rollups use client `ts` only when in skew; otherwise server time.
- Stores client/server/skew in `normalized` for debugging.

## Bot Handling (privacy‑first)

- If UA is missing or matches bot signatures:
  - raw_event is still stored
  - rollups/session/visitors skipped

## Domain Allowlist

- payload.domain must match site.domain or subdomain.
- prevents API key misuse from other domains.

## Retention

- removed from ingest path.
- cron endpoint runs cleanup on schedule using secret.
