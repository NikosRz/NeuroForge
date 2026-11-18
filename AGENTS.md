# Agent Instructions — NeuroForge

These instructions apply to the **NeuroForge** repository.

## 1. Coding Style & Modern TypeScript (ES2020+)

- **Prefer arrow functions** (`export const myFn = (...) => ...`, `const helper = (...) => ...`) over `function` declarations for all modules, helpers, API handlers, and React components.
- **Use modern ES2020+ syntax:** optional chaining (`?.`), nullish coalescing (`??`), destructuring, `const` by default, template literals, and functional array methods (`map`, `filter`, `reduce`, `some`) where they improve clarity.
- **Strict TypeScript:** Avoid `any`, unsafe casts, and silent type assertions. Validate untrusted external data (API payloads, JIRA/Ollama JSON, `.ics` feeds, uploaded roadmap JSON) at boundaries before trusting its shape.
- **Small, focused modules:** Break complex logic into small, well-named local helpers. Keep shared contracts in `src/lib/types.ts` and tunable RPG defaults in `src/config/rpg-presets.json`.

## 2. Error Handling, Security & Async Lifecycles

- **Never swallow errors silently:** Surface actionable, normalized `{ error }` messages at API boundaries without leaking internal stack traces or secrets.
- **Never log secrets or credentials:** Keep JIRA tokens, emails, and `.ics` private URLs out of logs and client error messages.
- **Explicit async lifecycles:** External HTTP calls (JIRA, ICS, Ollama) must use explicit timeouts and `try/catch` fallbacks so offline services never crash the game room.

## 3. Collaboration, Git & Verification

- **Work in the current checkout:** Do not create Git worktrees, and **do not stage or commit changes** — leave all Git operations to the user.
- **Step-by-step execution:** Complete one task at a time, run `npx tsc --noEmit` (and `npm run build` where relevant), and ask the user to verify and commit manually before moving to the next task.
- **Testing:** Automated tests are currently deferred per user instruction; verify with `npx tsc --noEmit`, `npm run build`, and targeted runtime checks.
- **Honest reporting:** Only report checks as passing if they were actually run after the final edit and succeeded.

## 4. graphify

This project has a knowledge graph at `graphify-out/`.

- **Always use the `graphify` skill whenever querying the project:** Before exploring files manually for codebase, symbol, or architecture questions, run `graphify query "<question>"` (or `graphify path` / `graphify explain`) using `graphify` from `PATH`.
- **Report problems immediately:** If `graphify` fails, is blocked (e.g., sandbox/permission error), or returns unexpected errors, report the issue to the user immediately rather than silently skipping it.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- **After modifying code files**, run `graphify update .` to keep the graph current (AST-only, no API cost).
