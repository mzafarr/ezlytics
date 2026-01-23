# Ralph Agent Instructions

## 🚨 CRITICAL CONTEXT

**Project Structure (Monorepo):**

- **Root**: Contains orchestration (`ralphy.sh`, `PRD.md`).
- **App Code**: Lives in the `app/` subdirectory (Git submodule).
- **Commands**: Always run build/install commands inside `app/` (e.g., `cd app && bun install`).

## Documentation Strategy (Progressive Disclosure)

Read these files ONLY when relevant to your task:

1. **[Tech Stack & Standards](docs/AGENTS/TECH_STACK.md)**: Frameworks, library choices, and testing rules.
2. **[Architecture Patterns](docs/AGENTS/PATTERNS.md)**: How to implement features (Auth, API, DB).
3. **[Workflow Rules](docs/AGENTS/WORKFLOW.md)**: How to manage git branches, commits, and PRD updates.
4. **[React Best Practices](vercel-react-best-practices/AGENTS.md)**: **CRITICAL** performance rules for React/Next.js. Follow strictly.

## Core Directives

1. **Ignore Logs**: Never read `logs/` files for code context. They are outdated history.
2. **Focus on app/**: All implementation happens in `app/`.
3. **Update Tasks**: Mark items complete in `PRD.md` as you finish them.

# Rules

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.
