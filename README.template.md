<!--
This file is generated from README.template.md.
Run `bun run sync-readme` after changing packages/config/src/brand.ts.
-->

# {{brandName}}

{{brandName}} is open-source, self-hostable analytics focused on traffic-to-revenue attribution.

## Why {{brandName}}

- Revenue-first analytics (not just pageviews)
- Fast client script (`/js/script.js`)
- Public ingest endpoint (`/api/v1/ingest`) with validation + limits
- Built-in first-party tracking path support (`/js/script.js` + `/p`)
- Monorepo with Next.js, tRPC, Drizzle, PostgreSQL

## Stack

- Next.js App Router (`apps/web`)
- TypeScript + Bun + Turborepo
- Drizzle ORM + PostgreSQL
- Better Auth

## Quick Start

1. Install deps:

```bash
bun install
```

2. Configure env:

```bash
cp apps/web/.env.example apps/web/.env
```

3. Push schema:

```bash
bun run db:push
```

4. Run dev:

```bash
bun run dev
```

App runs at [http://localhost:3001](http://localhost:3001).

## Tracking Snippet

Use this on tracked sites:

```html
<script
  defer
  data-website-id="dfid_xxx"
  data-domain="example.com"
  data-api-key="key_xxx"
  src="https://your-analytics-domain.com/js/script.js"
></script>
```

Default event endpoint resolves to `/p` on the same origin as the script.

## First-Party Mode (recommended for strict browsers)

Privacy-heavy browsers can block third-party analytics. Best practice is to serve script + ingest on the tracked site's own domain.

Example:

- Script URL: `https://www.client-site.com/js/script.js`
- Ingest URL: `https://www.client-site.com/p`

In this repo:

- `apps/web/src/app/js/script.js/route.ts` serves the client script.
- Next.js rewrite maps `/p` -> `/api/v1/ingest` in `apps/web/next.config.ts`.

## Repo Layout

```text
apps/web            # Next.js app (dashboard + APIs + marketing)
packages/api        # tRPC + server logic
packages/auth       # auth wiring
packages/db         # schema + DB tooling
packages/env        # env validation
docs                # specs + architecture + roadmap
```

## Quality Checks

```bash
bun run check-types
bun run lint
bun test
```

## Roadmap

Launch roadmap: [docs/launch-roadmap.md](docs/launch-roadmap.md)

## Contributing

PRs welcome. For larger changes, open an issue first with scope and rollout plan.

## License

MIT. See [LICENSE](LICENSE).
