# Ralph Workflow & Debugging

## Workflow & State

- **Tasks**: Defined in `tasks.yaml`. Ralph picks the highest priority `completed: false` task.
- **Memory**:
  - `progress.txt` acts as the long-term memory between iterations. **READ IT FIRST.**
  - `AGENTS.md` (root) links to architectural patterns.
- **Execution**:
  - Ralph creates a dedicated git branch for each task (e.g., `ralphy/us-001-auth`).
  - Upon success, the task is marked `completed: true` in `tasks.yaml`.

## Important Rules for Agents

1. **One Task Only**: Do not touch code unrelated to the assigned User Story.
2. **Update Docs**: If you create a new module, add a pattern entry in `docs/AGENTS/PATTERNS.md`.
3. **Commit often**: Small, atomic commits are better than one huge commit.
4. **Fix type errors**: Do not leave `any` types or ignored TS errors.

## Debugging Ralph

- If Ralph fails to parse the PRD, check `tasks.yaml` syntax.
- If an agent loop gets stuck, kill the process `Ctrl+C` and check `progress.txt`.
