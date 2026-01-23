# PRD: Ingest Quality & Consistency Hardening

## Introduction
The ingest pipeline needs additional quality controls and structural cleanup beyond the initial transactional and DoS fixes. This PRD covers remaining validation/policy decisions (session ID conflicts, backfill timestamps, UA handling, `ts` coercion), a dedupe-safe insert pattern inside transactions, minimal modularization for maintainability, and a simple rollup rebuild job for correctness while the product has zero users and a wipe/rebuild is acceptable.

## Current Context
- Product has 0 users.
- It is acceptable to wipe and rebuild DB state if needed.

## Goals
- Ensure deterministic handling of ambiguous or invalid payloads (session ID conflicts, timestamp skew, UA-less events).
- Improve data accuracy for delayed/offline events with explicit backfill policy.
- Make deduplication reliable inside transactions without aborted commits.
- Enable fast, safe rollup rebuilds without complex ledger infrastructure (v0 stage).
- Improve maintainability via minimal modularization without changing external behavior.

## User Stories

### US-001: Ingest behavior hardening (validation + dedupe)
**Description:** As a system owner, I want unambiguous validation and safe deduplication so analytics are correct and transactions don't fail.

**Acceptance Criteria:**
- [x] If both `sessionId` and `session_id` are present and differ, return 400 with a clear error field.
- [x] If only one is present or both match, continue ingest normally.
- [x] Missing User-Agent does not automatically set `bot=true`.
- [x] `bot` flag is only accepted for privileged/server-side requests (e.g., server key or server-only endpoint); untrusted use is rejected or ignored.
- [x] Rollups include UA-less events unless flagged as bot via a privileged path.
- [x] `ts` accepts numeric strings and coerces to integer; non-numeric strings still return 400.
- [ ] Use `onConflictDoNothing` with `returning()` on `(site_id, event_id)` to detect dedupe without throwing.
- [ ] If deduped, return `{ ok: true, deduped: true }` without attempting rollups.
- [ ] No unique-violation exceptions are used for normal dedupe flow.
- [ ] Typecheck/lint passes.

### US-002: Allow past backfill up to 24h using client time
**Description:** As a user with offline clients, I want delayed events (<= 24h in the past) to count in the correct historical buckets without allowing future time shifts.

**Acceptance Criteria:**
- [ ] If client timestamp is in the past and within 24h, use client time for rollups.
- [ ] If client timestamp is more than 24h in the past, reject with 400 and an explicit error message.
- [ ] If client timestamp is more than 5 minutes in the future, reject with 400 and an explicit error message.
- [ ] If client timestamp is within the 5-minute future skew window, use client time (existing behavior).
- [ ] No response shape changes; optionally include debug-only logging/metrics for backfill usage.
- [ ] Typecheck/lint passes.

### US-003: Modularize ingest handler (minimal split)
**Description:** As a maintainer, I want the ingest route split into logical modules to reduce complexity and improve testability.

**Acceptance Criteria:**
- [ ] Extract schemas/constants to `ingest/schema.ts`.
- [ ] Extract normalization helpers to `ingest/normalize.ts`.
- [ ] Extract geo resolution to `ingest/geo.ts`.
- [ ] Extract metrics/session helpers to `ingest/metrics.ts`.
- [ ] `route.ts` becomes orchestration only.
- [ ] Typecheck/lint passes.

### US-004: Add rollup rebuild job (v0, destructive allowed)
**Description:** As an operator, I want a simple way to rebuild rollups from raw events while there are no users.

**Acceptance Criteria:**
- [ ] Provide a rebuild job that can truncate rollup tables and recompute from raw events for a time window.
- [ ] Job can run for a single site or all sites.
- [ ] Job has a dry-run mode that reports counts without writing.
- [ ] Typecheck/lint passes.

## Functional Requirements
1. Reject payloads when `sessionId` and `session_id` both exist and differ.
2. Do not classify missing User-Agent as bot; restrict `bot` flag to privileged/server-side requests.
3. Coerce `ts` numeric strings to integer timestamps.
4. Implement dedupe-safe insert using `onConflictDoNothing` and `returning()`.
5. Accept past backfill events up to 24h and bucket to client timestamp; reject older than 24h.
6. Reject future timestamps beyond a 5-minute skew window.
7. Split ingest route into schema/normalize/geo/metrics modules with identical behavior.
8. Add a rollup rebuild job that can truncate and recompute rollups from raw events (v0 approach).

## Non-Goals
- No changes to public reporting/UI in this scope.
- No new analytics dimensions beyond existing ones.
- No major refactor of non-ingest API routes.

## Design Considerations (Optional)
- Keep new ingest modules colocated under `apps/web/src/app/api/v1/ingest/`.
- Provide a short README or module docstring explaining responsibilities.

## Technical Considerations (Optional)
- Rebuild job can be a CLI script or scheduled API route; must avoid full-table scans in hot paths.
- Backfill error responses should be explicit and machine-readable.
- Dedupe should avoid exception-driven control flow inside transactions (use conflict-free insert).

## Success Metrics
- <0.1% of ingest requests rejected due to ambiguous session IDs after client updates.
- Rollup rebuild can run on demand and completes within acceptable time for 7-day windows.
- Reduced operator time spent on manual rollup fixes during v0.

## Open Questions
- Should the rebuild job be triggered manually (admin-only) or via cron during v0?
- Should backfill events be counted in revenue rollups with the same policy?
