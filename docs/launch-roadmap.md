# Ezlytics Launch Roadmap (ASAP)

Last updated: 2026-02-24

## P0: Launch blockers (today)

- [ ] Ship first-party tracking setup guide (Cloudflare/Nginx/Vercel examples).
- [ ] Add onboarding toggle: `First-party mode` to generate snippet using client domain.
- [ ] Add browser verification matrix for tracking (Chrome, Safari, Firefox, Brave, Zen).
- [ ] Add dashboard alert for blocked script/events mismatch.
- [ ] Publish public status page + incident contact.

## P1: First week after launch

- [ ] Add server-side fallback events API for pageview + conversion backup.
- [ ] Add consent mode (`granted`/`denied`) and enforce no cookie mode when denied.
- [ ] Add onboarding docs for Stripe + LemonSqueezy attribution end-to-end.
- [ ] Add "self-host quickstart" with Docker + one-command setup.

## P2: Hardening (week 2-4)

- [ ] Add replay queue/retry + dead-letter handling for ingestion.
- [ ] Add high-volume load test profile and SLO dashboard.
- [ ] Add weekly reconciliation automation (raw events vs rollups drift report).
- [ ] Add automated canary checks for script delivery and ingest latency.

## Go/No-Go checklist

- [ ] Script load success >= 99.9% (p95 < 150ms from edge).
- [ ] Ingestion success >= 99.5% for non-bot pageviews.
- [ ] Revenue attribution accuracy validated on 3 live stores.
- [ ] Docs complete: install, first-party mode, troubleshooting, privacy.
