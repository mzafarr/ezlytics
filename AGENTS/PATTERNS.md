# Architectural Patterns

## Site Management

- **Dashboard**: `apps/web/src/app/dashboard/dashboard.tsx` is the main entry.
- **Data Layer**: Site data is handled via the `sites` tRPC router (`packages/api/src/router/sites.ts`).
- **Schema**: Site entities are defined in `packages/db/src/schema/site.ts`.

## Authentication

- Uses Better Auth.
- Configuration: `packages/auth/src/auth.ts`.
- Client-side hook: `useSession` from `packages/auth/src/react.ts`.

## Web Analytics Implementation

- **Ingestion**: Public API at `apps/web/src/app/api/v1/ingest/route.ts`.
- **Processing**: Use specific `services/analytics.ts` in `packages/api` (if exists) or direct Drizzle calls.
- **Storage**: Raw events table for high-volume writes. Rollups for read-heavy dashboards.
