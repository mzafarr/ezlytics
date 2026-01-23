# Analytics Metrics Specification

This document defines analytics metrics for ingest, rollups, rebuilds, and UI display.

## Shared Rules

- **Event timestamp**: Use the resolved event timestamp (client ts if within skew, else server time).
- **Pageviews only**: Visitor and session metrics use `pageview` events only.
- **Bot exclusion**: Any event with `normalized.bot = true` is excluded from visitors, sessions, and rollups.
- **Session identity**: A session is keyed by `(site_id, session_id, visitor_id)`.
- **UTC buckets**: Day and hour buckets are UTC based.

## Metric Definitions

### Visitors (daily)

Count of distinct `visitor_id` that had at least one **pageview** on a given UTC day.

### Visitors (range)

Count of distinct `visitor_id` with at least one **pageview** between `start` and `end` timestamps,
inclusive, across the whole range (not the sum of daily uniques).

### Visitors now

Count of distinct `visitor_id` from **pageview** events in the last 5 minutes, where
`event_timestamp <= now`.

### Session

The **first** pageview for a `(site_id, session_id, visitor_id)` creates a session.
All subsequent pageviews for that key belong to the same session.

### Bounce

A session with exactly **one** pageview.

### Avg session duration

For each session: `last_pageview_timestamp - first_pageview_timestamp` (ms).
Average that duration across sessions in the bucket.

### Session attribution (day/hour)

Sessions, bounces, and session duration are attributed to the UTC day/hour of the
**first pageview** in the session, regardless of when later pageviews occur.

## Worked Examples

### Example 1: Daily visitors vs range visitors

Events (all pageviews, all human):
- Day 1: visitor A, visitor B
- Day 2: visitor A, visitor C

Expected:
- Visitors (day 1) = 2 (A, B)
- Visitors (day 2) = 2 (A, C)
- Visitors (range day1–day2) = 3 (A, B, C)

### Example 2: Visitors now with bots and non-pageviews

Events in last 5 minutes:
- pageview visitor A (human)
- pageview visitor B (human)
- goal visitor C (human)
- pageview visitor D (bot)

Expected:
- Visitors now = 2 (A, B)

### Example 3: Sessions, bounce, duration, and attribution

Events (UTC):
- 10:00 pageview visitor A session S1
- 10:05 pageview visitor A session S1
- 23:58 pageview visitor B session S2
- 00:02 (next day) pageview visitor B session S2
- 11:00 pageview visitor C session S3

Expected:
- Session S1 duration = 5 minutes, not a bounce.
- Session S2 duration = 4 minutes, not a bounce, attributed to previous day 23:00 hour.
- Session S3 duration = 0 minutes, **bounce**, attributed to 11:00 hour.
