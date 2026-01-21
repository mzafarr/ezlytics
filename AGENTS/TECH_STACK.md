# Technology Stack & Standards

## Tech Stack (Better-T-Stack)

- **Monorepo**: Turborepo (`apps/web`, `packages/api`, `packages/auth`, `packages/db`).
- **Framework**: Next.js (App Router) with React Server Components.
- **Database**: Drizzle ORM (PostgreSQL).
- **API**: tRPC for internal dashboard, standard `Route Handlers` for public APIs.
- **Auth**: Better Auth.
- **Package Manager**: Bun (use `bun install`, `bun add`, etc).

## Database Workflow

- **Schema Management**: We use `drizzle-kit` for schema updates.
- **Applying Changes**: When you modify any file in `packages/db/src/schema/`, you **MUST** run the push command to sync the DB:
  ```bash
  cd app && bun run db:push
  ```
- **Prototyping**: Do not use `db:migrate`. Use `db:push` for rapid iteration.

## Quality Rules

- **Testing**: Write tests ONLY for critical core logic (e.g., auth flows, complex calculations). Do NOT write trivial tests for UI components.
- **Linting**: Run `bun run lint` before committing.
- **Verification**: If a task involves UI, use the `dev-browser` skill to verify it renders.
