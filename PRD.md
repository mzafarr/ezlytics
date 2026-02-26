# PRD: Analytics Metrics Correctness & Validation

## Introduction

Fix correctness of core analytics metrics (visitors, visitors now, sessions, bounce rate, avg session duration, geo, dimension rollups, idempotency) and add automated validation (tests + reconciliation) so reported numbers are trustworthy.

## Goals

- Align metric definitions with common analytics standards.
- Make rollups deterministic and consistent with raw events.
- Exclude bot traffic consistently across real-time and rollups.
- Prevent duplicate counting on retries and webhook replays.
- Add automated tests and reconciliation to prove correctness.

## User Stories

### US-001: Publish metric definitions
**Description:** As a developer, I want clear metric definitions so all code and tests use the same rules.

**Acceptance Criteria:**
- [x] Add `docs/analytics-metrics-spec.md` defining: visitor (daily), visitor (range), visitors now, session, bounce, avg session duration, session attribution to day/hour, bot exclusion.
- [x] Definitions include at least 3 worked examples with expected numbers.
- [x] Typecheck/lint passes.

### US-002: Fix visitors now query
**Description:** As a user, I want “visitors now” to reflect active humans, not bots or background events.

**Acceptance Criteria:**
- [x] Count distinct `visitor_id` from **pageview** events only.
- [x] Exclude bot events (normalized.bot = true).
- [x] Use event timestamp window: last 5 minutes, timestamp <= now.
- [x] Unit test covers bot exclusion + non-pageview exclusion.
- [x] Typecheck/lint passes.

### US-003: Fix visitors for date range
**Description:** As a user, I want “visitors” for a range to be unique across the whole range.

**Acceptance Criteria:**
- [x] Range visitors = distinct visitor_id across start/end (inclusive), pageviews only, bots excluded.
- [x] Dashboard uses range-unique visitor count for “Visitors”.
- [x] Add query (or computed field) to return range-unique visitors.
- [x] Integration test verifies range-unique vs sum-of-daily difference.
- [x] Typecheck/lint passes.

### US-004: Session metrics attributed to session start
**Description:** As a user, I want bounce rate and session duration to be accurate for the day/hour the session started.

**Acceptance Criteria:**
- [x] Session start = first pageview timestamp for (site_id, session_id, visitor_id).
- [x] Bounce = exactly 1 pageview in session.
- [x] Avg session duration = (last_ts - first_ts) averaged across sessions.
- [x] Session rollup deltas (sessions, bouncedSessions, duration) are bucketed to session **start** day/hour.
- [x] Rollup rebuild logic matches live ingest behavior.
- [x] Unit tests cover single-pageview, two-pageview, cross-day, out-of-order events.
- [x] Typecheck/lint passes.

### US-005: Dimension sessions by session start context
**Description:** As a user, I want geo/device/browser conversion rates to use correct session counts.

**Acceptance Criteria:**
- [x] Session dimension context = normalized values from first pageview of session.
- [x] Dimension rollups for country/region/city/device/browser increment sessions based on session start context.
- [x] Dimension rollup rebuild uses same rules.
- [x] Geo conversion rate uses dimension session totals (not pageviews fallback).
- [x] Typecheck/lint passes.

### US-006: Fix geo points date filtering
**Description:** As a user, I want map points to respect the selected date range.

**Acceptance Criteria:**
- [x] Geo points filter uses event timestamp (not createdAt).
- [x] End date is inclusive (end-of-day).
- [x] Bot events excluded.
- [x] Integration test validates date range boundaries.
- [x] Typecheck/lint passes.

### US-007: Idempotent goals/payments
**Description:** As an operator, I want retries to never double-count revenue or goals.

**Acceptance Criteria:**
- [x] Goals endpoint requires an idempotency key (event_id) or uses a deterministic key.
- [x] Payments endpoint dedupes using transaction_id (or event_id).
- [x] Raw events for goal/payment use event_id for unique constraint.
- [x] Retries return ok without changing rollups.
- [x] Typecheck/lint passes.

### US-008: Automated validation and reconciliation
**Description:** As an operator, I want automated proof that rollups match raw events.

**Acceptance Criteria:**
- [x] Add golden datasets for ingest and expected rollups.
- [x] Add property-based test: live ingest rollups == rebuild rollups for same events.
- [x] Add reconciliation job/endpoint that diffs rollups vs raw_event rebuild (dry-run allowed).
- [x] CI fails on mismatch.
- [x] Typecheck/lint passes.

### US-009: Clarify metric definitions in UI
**Description:** As a user, I want the dashboard to explain what each KPI means.

**Acceptance Criteria:**
- [x] “Visitors” and “Visitors now” show tooltip with definition from spec.
- [x] Bounce rate and Avg session duration show definition tooltip.
- [x] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## Functional Requirements

- FR-1: Range visitors must be unique across the full range (pageview-only, bots excluded).
- FR-2: Visitors now must be distinct pageview visitors in last 5 minutes, bots excluded.
- FR-3: Session metrics must be attributed to session start day/hour.
- FR-4: Dimension session rollups must use session start context (country/region/city/device/browser).
- FR-5: Geo point filters must use event timestamp and inclusive end date.
- FR-6: Goals/payments must be idempotent and deduped.
- FR-7: Rollup rebuild must match live ingest logic.
- FR-8: Automated tests + reconciliation must guard correctness.

## Non-Goals (Out of Scope)

- Multi-touch attribution or marketing modeling.
- Real-time streaming UI beyond current “visitors now”.
- Currency conversion or multi-currency reporting changes.
- Rewriting the entire dashboard UI.

## Design Considerations (Optional)

- Add small tooltip icons next to KPI labels for definitions.
- Reuse existing tooltip component and styles.

## Technical Considerations (Optional)

- May require storing session start context (e.g., JSON) in `analytics_session`.
- May require new query or table for range-unique visitors (e.g., `visitor_daily` distinct).
- Ensure rollup rebuild reuses exact same metric logic as ingest.
- Add SQL filters for `normalized.bot` (JSON) where needed.

## Success Metrics

- Reconciliation job shows 0 drift for golden datasets and staging.
- Automated tests cover all edge cases listed in US-004.
- No regression in dashboard performance for default ranges.

## Open Questions

- Do we want to surface both “unique across range” and “sum of daily” in UI for transparency?
- Should hourly unique visitors be explicitly supported if we add hourly charts later?

## Launch Fast-Track Tasks (2026-02-24)

- [x] Add launch roadmap doc for post-MVP shipping priorities.
- [x] Restore landing page pricing section.
- [x] Update README to proper OSS format and MIT license messaging.
