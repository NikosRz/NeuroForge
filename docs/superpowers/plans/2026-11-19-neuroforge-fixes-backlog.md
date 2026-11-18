# NeuroForge Fixes & Improvements Backlog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all 22 fixes, UX improvements, and architectural refactors in `docs/fixes.md` in a single consistent, non-duplicative sequence of 8 tasks.

**Architecture:** Establish shared utilities, error normalization, and schema migrations first; harden external clients and server actions next; then decompose oversized UI/canvas modules (`SettingsModal`, `sprites.ts`, `ArcadeStage`) *in the same pass* that introduces their new features so no file is rewritten twice.

**Tech Stack:** Next.js 15 (App Router, Server Actions, Route Handlers), React 19, TypeScript 5.8 (strict), Tailwind CSS 4, SQLite (`better-sqlite3`), `node-ical`, Ollama HTTP API, JIRA REST API v3/v2, HTML5 Canvas 2D, Web Audio API.

**Spec:** `docs/fixes.md`

---

## Global Constraints

- **Coding style (`AGENTS.md` §1):** Arrow functions (`const fn = (...) => ...`) everywhere; ES2020+ syntax (`?.`, `??`, `const`); strict TypeScript (no `any`, no unsafe casts, no `!` non-null assertions); validate untrusted inputs at boundaries.
- **Security & errors (`AGENTS.md` §2):** Never swallow errors; normalize all API/Server Action errors without leaking URLs, tokens, emails, stack traces, or SQLite internals; explicit timeouts + `try/catch` on all external HTTP calls.
- **Git & workflow (`AGENTS.md` §3):** Work in the current checkout; **do not** create worktrees, stage, or commit — leave all Git operations to the user. Automated test suites are deferred; verify every task with `npx tsc --noEmit`, targeted runtime checks, and `npm run build` where relevant, then pause for user verification/commit.
- **Knowledge graph (`AGENTS.md` §4):** Run `graphify update .` after code changes in each task.
- **Author footer (Fix #10 exact copy):**
  ```text
  Designed and developed by Nikos Rzewucki
  www.nikos.click, https://github.com/NikosRz
  ```
- **Boss taunt copy (Fix #1):** `"HaHa, you need to finish the task first!"` (with optional current JIRA status).

## Review Focus

1. **Existing SQLite DB upgrade (`completed_statuses` column):** Opening an existing `data/neuroforge.db` must not fail with `no such column: completed_statuses`; `initSchema` must check `PRAGMA table_info(jira_config)` and run `ALTER TABLE` idempotently (pinned in Task 2).
2. **Browser popup blocker on 1st Boss shot:** `window.open(activeQuest.url, '_blank', 'noopener,noreferrer')` must execute synchronously inside the `keydown`/`click` user-gesture handler, never inside an async callback or `requestAnimationFrame` collision (pinned in Task 8).
3. **JIRA status fetch without a single project key:** When `jql_scope` is empty or matches multiple projects (or project endpoint returns 404), `fetchJiraStatuses` must fall back cleanly to `GET /rest/api/{2|3}/status` without throwing (pinned in Task 3).
4. **Spacebar hold >3s vs. tap / station / window blur:** Holding Spacebar while standing on a station or blurring the window mid-charge must never leave `chargeProgress` stuck or trigger an unintended AI split (pinned in Task 8).
5. **Recurring `.ics` `exdate` & `recurrences` key formats:** `node-ical` keys `exdate` and `recurrences` by `YYYY-MM-DD` or ISO timestamp; occurrence matching must check both date-key and exact timestamp so cancelled/rescheduled meetings never reappear (pinned in Task 3).

---

## Fix-to-Task Traceability Matrix (Zero Duplication)

| Task | Fixes Covered | Primary Modules |
|---|---|---|
| **Task 1** | #15 (shared helpers), #17 (error normalizer), #19 (`presets.ts`, `package.json`), #22 (prune unused RPG fields, arrow fns) | `src/lib/shared.ts`, `src/lib/errors.ts`, `src/lib/types.ts`, `src/lib/presets.ts`, `src/config/rpg-presets.json`, `package.json` |
| **Task 2** | #1 (DB column), #11 (remove `globalThis` calendar cache), #15 (local dates), #18 (DB transactions + single daily reset), #19 (DB HMR singleton) | `src/lib/db.ts`, `src/lib/rpg-engine.ts`, `src/lib/state-loader.ts` |
| **Task 3** | #1 (JIRA status + live check), #14 (JQL escaping & key match), #17 (client error sanitization), #19 (`pkill -x ollama`), #20 (SSE abort signal), #21 (`.ics` `exdate`/`recurrences`) | `src/lib/jira-client.ts`, `src/lib/ics-client.ts`, `src/lib/ollama-client.ts` |
| **Task 4** | #1 (boss check & statuses actions, remove transitions), #2 (JIRA display name sync), #4 (Base URL validation), #11 (remove cache invalidation), #17 (action/route error sanitization), #18 (input validation + transactions), #20 (forward `req.signal`) | `src/app/actions/*.ts`, `src/app/api/state/route.ts`, `src/app/api/ai/pull/route.ts` |
| **Task 5** | #1 (remove QuestModal transitions), #13 (StrictMode Focus Turn timer), #20 (`next/font/google`, debounced/cancellable search), #22 (`aria-labelledby`, remove `!`, timer cleanup) | `src/app/layout.tsx`, `src/app/globals.css`, `ArcadeModalShell.tsx`, `QuestModal.tsx`, `QuestBoardModal.tsx`, `MindDumpModal.tsx` |
| **Task 6** | #1 (completed status multi-select), #2 (prefill JIRA user name), #4 (inline Base URL warning), #5 (`(i)` help popups), #6 (auto-close on save), #20 (SSE `AbortController`), #22 (split `SettingsModal`, `Test SFX` unmute fix) | `src/components/modals/SettingsModal.tsx`, `src/components/modals/settings/{ProfileSection,JiraSection,OllamaSection,SettingsHelpPopup}.tsx` |
| **Task 7** | #1 (shield deflect ring + taunt), #7 (larger 2-line boss task label), #9 (blaster charge-up + super-shot visuals), #22 (split `sprites.ts` into `src/lib/arcade/*`) | `src/lib/arcade/{types,world,primitives,background,stations,hero,boss,effects,index}.ts`, `src/lib/sprites.ts` |
| **Task 8** | #1 (real JIRA boss combat), #3 (instant click activation), #8 (larger calendar pill), #9 (>3s Spacebar charged AI split), #10 (`InfoModal` + `[i]` button), #11 (independent calendar polling), #12 (gate `K`/`L`, remove `grantXp`), #16 (hydration-safe dates), #22 (decompose `ArcadeStage`, ref order, cleanup) | `src/components/ArcadeStage.tsx`, `src/components/arcade/{ArcadeHud,ArcadeModals,simulation}.ts`, `src/components/modals/InfoModal.tsx`, delete `src/lib/sprites.ts` |

---

### Task 1: Shared Core Utilities, Error Normalization, Presets & Package Cleanup

**Files:**
- Create: `src/lib/shared.ts`
- Create: `src/lib/errors.ts`
- Modify: `src/lib/types.ts:1-70`
- Modify: `src/config/rpg-presets.json:1-26`
- Modify: `src/lib/presets.ts:1-13`
- Modify: `package.json:13-23`

**Interfaces:**
- Consumes: `@/config/rpg-presets.json`
- Produces:
  - `src/lib/shared.ts`:
    - `export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b'`
    - `export const toLocalDateStr = (date: Date): string`
    - `export const parseLocalDate = (dateStr: string): Date`
    - `export const getIsoWeekKey = (date: Date): string`
    - `export const parseRestDays = (raw: string): number[]`
    - `export const parseCompletedStatuses = (raw: string): string[]`
    - `export const isValidHttpUrl = (raw: string): boolean`
    - `export const validateJiraBaseUrl = (raw: string): { valid: boolean; error?: string }`
    - `export const isJiraConfigured = (cfg: Pick<JiraConfigRow, 'base_url' | 'token' | 'auth_type' | 'email'>): boolean`
  - `src/lib/errors.ts`:
    - `export const normalizeError = (err: unknown, fallback: string): string`
  - `src/lib/types.ts`:
    - `XpSourceType = 'micro_step' | 'focus_turn' | 'quest_clear'` (pruned unused `'subtask' | 'epic_clear'`)
    - `JiraConfigRow.completed_statuses: string` (JSON array of status names)
    - `JiraStatusOption { id: string; name: string; categoryKey: 'new' | 'indeterminate' | 'done' }`
    - `RpgPresets.xpAwards` pruned to `{ micro_step, focus_turn, quest_clear_base }` (and `staminaCosts` matches `XpSourceType`)
  - `src/lib/presets.ts`:
    - `export const getPresets = (): RpgPresets` (static JSON import, arrow function)

- [ ] **Step 1: Create `src/lib/shared.ts`**
  Implement all shared pure helpers using arrow functions:
  - `toLocalDateStr(date)`: `YYYY-MM-DD` in local time.
  - `parseLocalDate(dateStr)`: local `Date` at midnight.
  - `getIsoWeekKey(date)`: `YYYY-Www` ISO week key.
  - `parseRestDays(raw)`: parses JSON array, filters integers `0..6`, defaults to `[0, 6]`.
  - `parseCompletedStatuses(raw)`: parses JSON array of non-empty trimmed strings, deduplicated, defaults to `[]`.
  - `isValidHttpUrl(raw)`: `new URL(raw)` with `http:` or `https:` protocol.
  - `validateJiraBaseUrl(raw)`: trims input; if empty returns `{ valid: true }`; if invalid HTTP(S) URL returns `{ valid: false, error: 'JIRA Base URL must be a valid http:// or https:// URL (e.g. https://your-org.atlassian.net).' }`; if `parsed.pathname !== '/' && parsed.pathname !== ''` (or `parsed.search` or `parsed.hash` present) returns `{ valid: false, error: 'Use only the root JIRA domain without board or project sub-paths (e.g. https://your-org.atlassian.net).' }`.
  - `isJiraConfigured(cfg)`: `Boolean(cfg.base_url.trim() && cfg.token.trim() && (cfg.auth_type === 'server' || cfg.email.trim()))`.

- [ ] **Step 2: Create `src/lib/errors.ts`**
  Implement `normalizeError(err: unknown, fallback: string): string`:
  - Returns `${fallback}: request timed out.` for `DOMException` (`TimeoutError`) or `AbortError`.
  - Strips/redacts any `https?://[^\s]+` URLs, credentials, or SQLite internal prefixes (`SQLITE_`) so raw `undici`/`fetch` messages and DB internals never reach the client.
  - If an error message is safe, short (<= 160 chars), and doesn't contain URLs, tokens, or `SQLITE_`, returns it; otherwise returns `fallback`.

- [ ] **Step 3: Update `src/lib/types.ts`, `src/config/rpg-presets.json`, `src/lib/presets.ts`, and `package.json`**
  - In `src/lib/types.ts`: prune `'subtask' | 'epic_clear'` from `XpSourceType`, prune `subtask`, `quest_clear_max`, `epic_clear` from `RpgPresets['xpAwards']`, add `completed_statuses: string` to `JiraConfigRow`, and export `JiraStatusOption`. (Leave `epicsCleared` on `RpgStatsSnapshot` until Task 2 updates `rpg-engine.ts` so `tsc` stays green.)
  - In `src/config/rpg-presets.json`: remove `subtask` and `epic_clear` from `staminaCosts` and `subtask`, `quest_clear_max`, `epic_clear` from `xpAwards`.
  - In `src/lib/presets.ts`: replace `fs.readFileSync` with `import presetsJson from '@/config/rpg-presets.json';` and `export const getPresets = (): RpgPresets => presetsJson as RpgPresets;`.
  - In `package.json`: remove unused `"motion"` from `dependencies`.

- [ ] **Step 4: Verify compilation and update knowledge graph**
  Run: `npx tsc --noEmit`
  Run: `graphify update .`
  Expected: `npx tsc --noEmit` exits 0; ask user to verify and commit before Task 2.

---

### Task 2: SQLite Singleton, Schema Migration, RPG Engine Transactions & Single-Pass State Loader

**Files:**
- Modify: `src/lib/db.ts:1-149`
- Modify: `src/lib/rpg-engine.ts:1-335`
- Modify: `src/lib/state-loader.ts:1-131`
- Modify: `src/lib/types.ts` (prune `epicsCleared` from `RpgStatsSnapshot` now that `rpg-engine.ts` is updated)

**Interfaces:**
- Consumes: `toLocalDateStr`, `parseLocalDate`, `getIsoWeekKey`, `parseRestDays`, `isJiraConfigured` from `@/lib/shared`; `getPresets` from `@/lib/presets`
- Produces:
  - `src/lib/db.ts`:
    - `export const initSchema = (db: Database.Database): void`
    - `export const getDb = (dbPath?: string): Database.Database`
  - `src/lib/rpg-engine.ts`:
    - `export const applyDailyResetIfNeeded = (db: Database.Database, now?: Date): ProfileRow`
    - `export const getRpgStats = (db: Database.Database, now?: Date, existingProfile?: ProfileRow): RpgStatsSnapshot`
    - `export const useWeeklyPotion = (db: Database.Database, now?: Date): { success: boolean; reason?: string; stamina: number }` (atomic `db.transaction`)
    - `export const awardXp = (db: Database.Database, input: AwardXpInput): AwardXpResult`
  - `src/lib/state-loader.ts`:
    - `export const loadHydratedState = async (): Promise<HydratedState>` (fast local SQLite only + `nextEvent: null`; zero `.ics` network calls, zero `globalThis` calendar cache)

- [ ] **Step 1: Upgrade `src/lib/db.ts`**
  - Convert `initSchema` and `getDb` to arrow functions; remove duplicated `formatToday` and `getIsoWeekKey` in favor of `toLocalDateStr` and `getIsoWeekKey` from `@/lib/shared`.
  - Add `completed_statuses TEXT NOT NULL DEFAULT '[]'` to `CREATE TABLE IF NOT EXISTS jira_config`.
  - Add idempotent migration after `CREATE TABLE` statements: inspect `db.prepare("PRAGMA table_info(jira_config)").all()` and run `ALTER TABLE jira_config ADD COLUMN completed_statuses TEXT NOT NULL DEFAULT '[]'` if missing.
  - Store singleton DB handle + path on `globalThis` (typed with `globalForDb`) for Next.js dev HMR safety; if `resolved !== cachedPath` and an existing handle is open, call `existingDb.close()` inside `try/catch` before opening the new handle.

- [ ] **Step 2: Upgrade `src/lib/rpg-engine.ts`**
  - Remove local `toLocalDateStr`, `parseLocalDate`, `parseRestDays`, `getIsoWeekKey` and import from `@/lib/shared`.
  - In `applyDailyResetIfNeeded`: when `changed === false`, return `profile` directly without running a second `SELECT * FROM profile`.
  - Wrap `useWeeklyPotion` in `db.transaction(...)`.
  - Update `getRpgStats(db, now = new Date(), existingProfile?: ProfileRow)` to reuse `existingProfile` when provided instead of calling `applyDailyResetIfNeeded(db, now)` a second time, and remove `epicsCleared` from the SQL aggregate & return type (matching `src/lib/types.ts`).

- [ ] **Step 3: Clean up `src/lib/state-loader.ts`**
  - Remove `fetchTodayCalendarEvents`, `CalendarCacheEntry`, `globalForCalendarCache`, `getCalendarCache`, `setCalendarCache`, `invalidateCalendarCache`, and local `parseRestDays` / `isValidHttpUrl` (import `parseRestDays` and `isJiraConfigured` from `@/lib/shared`).
  - Pass `profile` from `applyDailyResetIfNeeded(db)` into `getRpgStats(db, new Date(), profile)`.
  - Return `nextEvent: null` (Calendar is fetched independently by `ArcadeStage` in Task 8).

- [ ] **Step 4: Targeted runtime check + typecheck + graphify**
  - Verify Review Focus #1 (existing DB migration): run a one-liner via `node -e` (or `npx tsx`) creating an in-memory SQLite DB with the old `jira_config` schema (without `completed_statuses`), calling `initSchema`, and asserting `completed_statuses` column exists with default `'[]'`.
  - Run: `npx tsc --noEmit`
  - Run: `graphify update .`
  - Expected: TypeScript passes with 0 errors (temporarily remove `invalidateCalendarCache` import in `src/app/actions/rpg.ts` if needed or update `rpg.ts` in Task 4 — remove the unused import/call in `rpg.ts` now so Task 2 compiles cleanly!). Ask user to verify and commit.

---

### Task 3: External Clients Hardening (JIRA, ICS, Ollama)

**Files:**
- Modify: `src/lib/jira-client.ts:1-330`
- Modify: `src/lib/ics-client.ts:1-128`
- Modify: `src/lib/ollama-client.ts:1-390`

**Interfaces:**
- Consumes: `isJiraConfigured`, `DEFAULT_OLLAMA_MODEL` from `@/lib/shared`; `normalizeError` from `@/lib/errors`; `JiraStatusOption` from `@/lib/types`
- Produces:
  - `src/lib/jira-client.ts`:
    - `export const fetchJiraStatuses = async (cfg: JiraConfigRow): Promise<{ statuses: JiraStatusOption[]; error?: string }>`
    - `export const fetchJiraIssueStatus = async (cfg: JiraConfigRow, issueKey: string): Promise<{ status?: string; statusCategory?: 'new' | 'indeterminate' | 'done'; error?: string }>`
    - `export const fetchJiraIssueDetail = async (cfg: JiraConfigRow, issueKey: string): Promise<{ issue?: JiraIssueSummary & { subtasks: Array<{ key: string; summary: string; done: boolean }> }; error?: string }>` (no longer fetches `/transitions`)
    - Removes `transitionJiraIssue`
  - `src/lib/ics-client.ts`:
    - `export const fetchTodayCalendarEvents = async (icsUrlsRaw: string, now?: Date): Promise<{ events: CalendarEvent[]; nextEvent: CalendarEvent | null; errors: string[] }>`
  - `src/lib/ollama-client.ts`:
    - `export const pullOllamaModelStream = async (ollamaUrl: string, model: string, onProgress: (evt: { status: string; completed?: number; total?: number }) => void, signal?: AbortSignal): Promise<void>`

- [ ] **Step 1: Upgrade `src/lib/jira-client.ts`**
  - Replace local `isJiraConfigured` with import from `@/lib/shared`; use `normalizeError` in `jiraFetch`.
  - Add `escapeJqlString = (raw: string): string => raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')` and `ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/i`.
  - Fix `buildJql`: escape `status`, `epic`, and `search` via `escapeJqlString`; for `search`, emit `(summary ~ "${safeSearch}" OR key = "${safeSearch}")` only when `ISSUE_KEY_RE.test(trimmed)`, otherwise emit `summary ~ "${safeSearch}"`.
  - Add `extractProjectKeyFromJql = (jqlScope: string): string | null`: matches a single `project\s*=\s*"?([A-Z][A-Z0-9_]+)"?/i` (returns `null` if `project in (...)` or multiple/none).
  - Add `fetchJiraStatuses(cfg)`: if a single project key is found, call `/project/${encodeURIComponent(projectKey)}/statuses` and flatten issue-type status arrays; if no project key or HTTP error, fall back to `/status`. Deduplicate by status name, preserve `{ id, name, categoryKey }`, sort alphabetically.
  - Add `fetchJiraIssueStatus(cfg, issueKey)`: calls `/issue/${encodeURIComponent(issueKey)}?fields=status` and returns `{ status, statusCategory }`.
  - Simplify `fetchJiraIssueDetail` to fetch only `/issue/${safeKey}?fields=summary,status,priority,parent,subtasks,customfield_10016` (drop `/transitions`) and remove `transitionJiraIssue`.

- [ ] **Step 2: Upgrade `src/lib/ics-client.ts`**
  - In `fetchSingleFeed`: sanitize catch errors via `normalizeError(err, 'Could not load calendar feed')` so private `.ics` URLs from `undici` errors are never returned.
  - In `extractEventsFromFeed`: when expanding `entry.rrule.between(dayStart, dayEnd, true)`:
    - Build a helper `isExcluded(occStart, entry.exdate)` checking both `toLocalDateStr(occStart)` and `occStart.toISOString().slice(0, 10)` and matching `Date` timestamps against `entry.exdate` values.
    - Check `entry.recurrences` (keyed by date string or ISO string) for an override `VEVENT`; if overridden, use the override's `start`, `end`, `summary`, `location` (and skip if the override moved it off today or marked it `STATUS:CANCELLED`).
    - Also inspect `entry.recurrences` entries that were rescheduled *onto* today from another day (if not already emitted by `between`), avoiding duplicate UIDs.

- [ ] **Step 3: Upgrade `src/lib/ollama-client.ts`**
  - Use `DEFAULT_OLLAMA_MODEL` from `@/lib/shared` and `normalizeError` from `@/lib/errors` (removing local `formatErrorMessage`).
  - In `stopOllamaServer`: replace `execFileAsync('pkill', ['-f', 'ollama serve'], ...)` with `execFileAsync('pkill', ['-x', 'ollama'], { timeout: 5_000 })`.
  - In `pullOllamaModelStream`: accept optional `signal?: AbortSignal`; combine via `signal ? AbortSignal.any([signal, AbortSignal.timeout(PULL_TIMEOUT_MS)]) : AbortSignal.timeout(PULL_TIMEOUT_MS)`.

- [ ] **Step 4: Verify compilation and update knowledge graph**
  Run: `npx tsc --noEmit` (Note: `src/app/actions/jira.ts` imports `transitionJiraIssue` — update `src/app/actions/jira.ts` in Task 4, OR remove `transitionJiraIssue` in Task 4 so Task 3 compiles cleanly on its own. Keep `transitionJiraIssue` deprecated in Task 3 and delete it in Task 4!).
  Run: `graphify update .`
  Expected: `npx tsc --noEmit` exits 0; ask user to verify and commit.

---

### Task 4: Server Actions & API Routes (Validation, Transactions, Sanitized Errors, Boss Check & JIRA Name Sync)

**Files:**
- Modify: `src/app/actions/jira.ts:1-329`
- Modify: `src/app/actions/rpg.ts:1-224`
- Modify: `src/app/actions/ai.ts:1-71`
- Modify: `src/app/actions/mind-dump.ts:1-91`
- Modify: `src/app/actions/roadmap-calendar.ts:1-97`
- Modify: `src/app/api/state/route.ts:1-12`
- Modify: `src/app/api/ai/pull/route.ts:1-66`
- Modify: `src/lib/jira-client.ts` (delete now-unused `transitionJiraIssue`)

**Interfaces:**
- Consumes: `fetchJiraStatuses`, `fetchJiraIssueStatus`, `fetchJiraIssues`, `testJiraConnection` from `@/lib/jira-client`; `validateJiraBaseUrl`, `isValidHttpUrl`, `parseCompletedStatuses`, `parseRestDays`, `DEFAULT_OLLAMA_MODEL` from `@/lib/shared`; `normalizeError` from `@/lib/errors`; `pullOllamaModelStream` from `@/lib/ollama-client`
- Produces:
  - `src/app/actions/jira.ts`:
    - `export const getJiraStatusesAction = async (override?: { baseUrl?: string; authType?: JiraAuthType; email?: string; token?: string; jqlScope?: string }): Promise<{ statuses: JiraStatusOption[]; error?: string }>`
    - `export const checkBossCompletionAction = async (issueKey: string): Promise<{ ok: boolean; completed: boolean; currentStatus?: string; xpResult?: AwardXpResult; nextQuestKey?: string | null; error?: string }>`
    - Removes `transitionQuestAction`
  - `src/app/actions/rpg.ts`:
    - `SettingsSnapshot.jira.completedStatuses: string[]`
    - `SaveSettingsInput.jira.completedStatuses?: string[]`

- [ ] **Step 1: Upgrade `src/app/actions/jira.ts`**
  - Keep `transitionQuestAction` temporarily untouched until Task 5 removes its `QuestModal` caller (both `transitionQuestAction` and `transitionJiraIssue` are deleted in Task 5 so every task passes `npx tsc --noEmit` independently).
  - Add `getJiraStatusesAction(override?)`: builds effective `JiraConfigRow` (merging optional unsaved form overrides with saved DB config), validates `baseUrl` via `validateJiraBaseUrl`, calls `fetchJiraStatuses(cfg)`.
  - Add `checkBossCompletionAction(issueKey)`:
    1. Validates `issueKey.trim()`.
    2. Loads `jira_config`; calls `fetchJiraIssueStatus(cfg, key)`.
    3. Determines completion: `const configured = parseCompletedStatuses(cfg.completed_statuses)`. Completed if `configured.length > 0 ? configured.some((s) => s.toLowerCase() === res.status.toLowerCase()) : res.statusCategory === 'done'`.
    4. If not completed: updates `profile.active_quest_status` to `res.status` (where `active_quest_key = key`) and returns `{ ok: true, completed: false, currentStatus: res.status }`.
    5. If completed: awards `quest_clear` XP (`itemId: key`, `baseXp: presets.xpAwards.quest_clear_base`), fetches next open issues via `fetchJiraIssues(cfg)` (filtering out `key` and any issue whose status is in `configured`), updates `profile.active_quest_*` to the next open issue (or `NULL` if none), returns `{ ok: true, completed: true, currentStatus: res.status, xpResult, nextQuestKey }`.
  - In `testJiraAction`: validate `baseUrl` with `validateJiraBaseUrl`; if connection succeeds and `res.user` is non-empty (and not `'Connected'`), sync `profile.name` when current `profile.name` equals `getPresets().defaultProfile.name` or is blank.
  - Wrap `toggleMicroStepAction` (UPDATE + optional `awardXp` + SELECT) in `db.transaction(...)`.
  - Normalize all catch blocks with `normalizeError`.

- [ ] **Step 2: Upgrade `src/app/actions/rpg.ts`**
  - Add allow-lists: `VALID_AUTH_TYPES = new Set(['cloud', 'server'])`, `VALID_ASSIGNEE_FILTERS = new Set(['me_and_unassigned', 'me_only', 'all'])`, `VALID_ROADMAP_MODES = new Set(['off', 'json', 'jira_sync'])`, `VALID_KEEP_ALIVES = new Set(['30s', '5m', '15m'])`.
  - Include `completedStatuses: parseCompletedStatuses(jira.completed_statuses)` in `getSettingsAction`.
  - In `saveSettingsAction`:
    - Validate `baseUrl` with `validateJiraBaseUrl`, `ollamaUrl` with `isValidHttpUrl`, `icsUrls` (each non-empty line must pass `isValidHttpUrl`), and all enum fields against allow-lists.
    - Validate `completedStatuses` as array of trimmed non-empty strings.
    - Wrap all `profile`, `jira_config`, and `ai_config` updates inside a single `db.transaction(...)`.
    - After commit, if JIRA is configured and `profile.name` is still the default (`getPresets().defaultProfile.name`) and the user didn't supply a custom non-default name, call `testJiraConnection(updatedJiraCfg)` (best-effort, non-blocking failure) and persist `profile.name = res.user` if returned.
  - Normalize all catch blocks with `normalizeError`.

- [ ] **Step 3: Upgrade `ai.ts`, `mind-dump.ts`, `roadmap-calendar.ts`, `/api/state`, and `/api/ai/pull`**
  - `src/app/actions/ai.ts`: use `DEFAULT_OLLAMA_MODEL` and `normalizeError`.
  - `src/app/actions/mind-dump.ts`: validate `minutes` is one of `5 | 15 | 30` in `pickQuickTaskAction`; use `normalizeError`.
  - `src/app/actions/roadmap-calendar.ts`: validate `input.mode` against `['off', 'json', 'jira_sync']`; validate each step's `status` against `['done', 'current', 'locked']`; deduplicate step `id`s (suffixing `-2`, `-3`, etc. if duplicate) before inserting inside `db.transaction(...)`; use `normalizeError`.
  - `src/app/api/state/route.ts`: use `normalizeError`.
  - `src/app/api/ai/pull/route.ts`: validate `model` string (non-empty, safe chars `/^[a-zA-Z0-9._:/-]+$/`, max 120 chars), pass `req.signal` to `pullOllamaModelStream`, and use `normalizeError`.

- [ ] **Step 4: Verify compilation and update knowledge graph**
  Run: `npx tsc --noEmit`
  Run: `graphify update .`
  Expected: `npx tsc --noEmit` exits 0; ask user to verify and commit.

---

### Task 5: App Layout (`next/font/google`), Modal Shell Accessibility & Focused Modals (`QuestModal`, `QuestBoardModal`, `MindDumpModal`)

**Files:**
- Modify: `src/app/layout.tsx:1-27`
- Modify: `src/app/globals.css:1-32`
- Modify: `src/components/modals/ArcadeModalShell.tsx:1-80`
- Modify: `src/components/modals/QuestModal.tsx:1-441`
- Modify: `src/components/modals/QuestBoardModal.tsx:1-238`
- Modify: `src/components/modals/MindDumpModal.tsx:1-218`
- Modify: `src/app/actions/jira.ts` (delete deprecated `transitionQuestAction`)

**Interfaces:**
- Consumes: `getIssueDetailAction`, `splitQuestAction`, `addMicroStepAction`, `toggleMicroStepAction`, `deleteMicroStepAction`, `getIssuesAction`, `pinQuestAction` from `@/app/actions/jira`; `completeFocusTurnAction` from `@/app/actions/rpg`; `getNotesAction`, `addNoteAction`, `deleteNoteAction`, `pickQuickTaskAction` from `@/app/actions/mind-dump`
- Produces:
  - `ArcadeModalShell`: adds optional `footer?: React.ReactNode` prop (consumed by `InfoModal` in Task 8) and `aria-labelledby={titleId}` via `useId()`.
  - `QuestModal`: `onXpCelebration: (amount: number, label: string, leveledUp?: boolean, newLevel?: number) => void` (clean server-driven celebration without fake client boss defeat).

- [ ] **Step 1: Switch fonts to `next/font/google` in `src/app/layout.tsx` & `src/app/globals.css`**
  - Load `Plus_Jakarta_Sans`, `Silkscreen` (weights `400`, `700`), `Press_Start_2P` (weight `400`), and `JetBrains_Mono` with CSS variables (`--font-jakarta`, `--font-silkscreen`, `--font-press-start`, `--font-jetbrains`).
  - Convert `RootLayout` to arrow function `const RootLayout = ...; export default RootLayout;`, attach font variable classes to `<html>`, remove raw Google Fonts `<link>` tags.
  - Update `src/app/globals.css` to reference `var(--font-jakarta)`, `var(--font-silkscreen)`, `var(--font-press-start)`, `var(--font-jetbrains)` with fallbacks.

- [ ] **Step 2: Upgrade `src/components/modals/ArcadeModalShell.tsx`**
  - Generate `titleId = useId()`, set `aria-labelledby={titleId}` on the `role="dialog"` container and `id={titleId}` on the `<h2>`.
  - Add optional `footer?: React.ReactNode` rendered as a fixed `shrink-0` footer below the scrollable body (used by `InfoModal` in Task 8).

- [ ] **Step 3: Upgrade `src/components/modals/QuestModal.tsx` (Fixes #1, #13, #22)**
  - Remove `transitionQuestAction` import, `transitions` / `selectedTransition` / `busy` state, `handleTransition`, status dropdown, "Move" button, and "Complete Quest" button. Keep the status badge and **"Open in JIRA"** link + a short hint (`"Update status in JIRA, then shoot the Boss to claim XP!"`).
  - Delete `transitionQuestAction` from `src/app/actions/jira.ts` and `transitionJiraIssue` from `src/lib/jira-client.ts`.
  - Fix Focus Turn StrictMode double-XP bug (Fix #13):
    - Keep `setInterval` updater pure: `setSecondsLeft((prev) => Math.max(0, prev - 1))`.
    - Add `const finishingTurnRef = useRef<boolean>(false);` (reset to `false` when timer starts/resets).
    - Trigger `void handleFinishFocusTurn()` from a dedicated `useEffect` when `timerRunning && secondsLeft === 0 && !finishingTurnRef.current`, setting `finishingTurnRef.current = true` before calling `completeFocusTurnAction`.
  - Narrow `res.step` into `const savedStep = res.step` (remove `res.step!` non-null assertions).

- [ ] **Step 4: Upgrade `QuestBoardModal.tsx` and `MindDumpModal.tsx` (Fixes #20, #22)**
  - In `QuestBoardModal.tsx`:
    - Debounce `search` by `300ms` before calling `getIssuesAction`.
    - Add `requestIdRef = useRef(0)` so out-of-order responses are ignored.
    - Preserve `allStatuses` and `allEpics` in state accumulated from unfiltered results (when `!search && !statusFilter && !epicFilter`) so filtering never hides the other dropdown options.
  - In `MindDumpModal.tsx`:
    - Debounce `search` input by `300ms` in a `useEffect` with `requestIdRef` cancellation guard.
    - Narrow `const savedNote = res.note` (remove `res.note!`).
    - Store `savedNotice` timeout ID in a `useRef<number | null>(null)` and clear it on unmount and before scheduling a new timeout.

- [ ] **Step 5: Verify build & update knowledge graph**
  Run: `npx tsc --noEmit && npm run build`
  Run: `graphify update .`
  Expected: TypeScript and Next.js production build succeed cleanly. Ask user to verify and commit.

---

### Task 6: Decompose & Upgrade `SettingsModal` (JIRA Validation, Completed Statuses, Help Popups, Auto-Close, SSE Abort, SFX Preview)

**Files:**
- Create: `src/components/modals/settings/ProfileSection.tsx`
- Create: `src/components/modals/settings/JiraSection.tsx`
- Create: `src/components/modals/settings/OllamaSection.tsx`
- Create: `src/components/modals/settings/SettingsHelpPopup.tsx`
- Modify: `src/components/modals/SettingsModal.tsx:1-584`

**Interfaces:**
- Consumes: `getJiraStatusesAction`, `testJiraAction` from `@/app/actions/jira`; `getSettingsAction`, `saveSettingsAction` from `@/app/actions/rpg`; `getOllamaStatusAction`, `installOllamaAction`, `startOllamaAction`, `stopOllamaAction` from `@/app/actions/ai`; `validateJiraBaseUrl`, `DEFAULT_OLLAMA_MODEL` from `@/lib/shared`
- Produces:
  - `SettingsModalProps`: `{ onClose: () => void; onRefresh: () => Promise<void>; onCalendarRefresh?: () => Promise<void> }`

- [ ] **Step 1: Create `src/components/modals/settings/SettingsHelpPopup.tsx` (Fix #5)**
  - Accepts `{ topic: 'jira-token' | 'ics-calendars'; onClose: () => void }`.
  - Renders a clean nested arcade dialog overlay with `role="dialog"` and `aria-modal="true"`:
    - `'jira-token'`: clickable external link to `https://id.atlassian.com/manage-profile/security/api-tokens` + numbered steps (Sign in → Create API token → Label it "NeuroForge" → Copy token → Paste into API Token field).
    - `'ics-calendars'`: numbered steps for **Google Calendar** (Settings → select calendar → Integrate calendar → copy "Secret address in iCal format") and **Outlook Calendar** (Settings → Calendar → Shared calendars → Publish a calendar → select "Can view all details" → copy ICS link).

- [ ] **Step 2: Create `ProfileSection.tsx`, `JiraSection.tsx`, and `OllamaSection.tsx` (Fixes #1, #4, #5, #20, #22)**
  - `ProfileSection.tsx`: Character Name, Weekly EXP Goal, Rest Days toggle buttons, Mute SFX checkbox + **Test SFX** button. Fix Test SFX (Fix #22): temporarily apply `!muted` (or call `arcadeAudio.setMuted(muted)` on checkbox toggle so unchecking Mute immediately lets Test SFX play before saving).
  - `JiraSection.tsx`:
    - JIRA Base URL input with placeholder `https://your-org.atlassian.net` and live inline warning from `validateJiraBaseUrl(baseUrl)` whenever a sub-path or invalid protocol is entered (Fix #4).
    - Auth Type, Email, API Token with `(i)` help button opening `'jira-token'` popup (Fix #5), Scope JQL, Assignee Filter, Roadmap Mode.
    - **Completed Statuses (Boss Kill)** subsection (Fix #1): "Fetch JIRA Statuses" button calling `getJiraStatusesAction`, rendering selectable status toggle chips (`selected` vs `unselected`) showing each status name + category badge, plus hint `"If none selected, any JIRA 'Done' category status defeats the Boss."`.
    - **Calendars (`.ics` Private URLs)** section with `(i)` help button opening `'ics-calendars'` popup (Fix #5).
  - `OllamaSection.tsx`: Status badge, Install/Start/Stop/Download controls, progress bar, Model / Keep Alive / Ollama URL inputs. Uses `AbortController` ref for `/api/ai/pull` SSE fetch, aborting on unmount (Fix #20) and ignoring `AbortError`.

- [ ] **Step 3: Refactor `src/components/modals/SettingsModal.tsx` (Fixes #2, #4, #6, #22)**
  - Compose `ProfileSection`, `JiraSection`, `OllamaSection`, and `SettingsHelpPopup`.
  - On `handleTestJira`: if `res.ok && res.user` and `name.trim() === '' || name.trim() === 'Alex'`, automatically set `setName(res.user)` (Fix #2).
  - On `handleSave`:
    - Run `validateJiraBaseUrl(baseUrl)` first; if invalid, set `error` and keep modal open (Fix #4).
    - Pass `completedStatuses` in `saveSettingsAction`.
    - On success: play chime, clear token input, await `onRefresh()`, await `onCalendarRefresh?.()`, and call `onClose()` to automatically close the modal (Fix #6). Keep modal open on failure.

- [ ] **Step 4: Verify compilation and update knowledge graph**
  Run: `npx tsc --noEmit`
  Run: `graphify update .`
  Expected: `npx tsc --noEmit` exits 0; ask user to verify and commit.

---

### Task 7: Decompose `src/lib/sprites.ts` into `src/lib/arcade/*` + Boss Readability, Shield Deflect & Charged Shot Visuals

**Files:**
- Create: `src/lib/arcade/types.ts`
- Create: `src/lib/arcade/world.ts`
- Create: `src/lib/arcade/primitives.ts`
- Create: `src/lib/arcade/background.ts`
- Create: `src/lib/arcade/stations.ts`
- Create: `src/lib/arcade/hero.ts`
- Create: `src/lib/arcade/boss.ts`
- Create: `src/lib/arcade/effects.ts`
- Create: `src/lib/arcade/index.ts`
- Modify: `src/lib/sprites.ts` (temporary 1-line re-export `export * from './arcade';` until Task 8 deletes it)

**Interfaces:**
- Consumes: Canvas 2D API only
- Produces (`src/lib/arcade/index.ts`):
  - All existing constants/types/functions from `sprites.ts`, converted to arrow functions, plus:
    - `HeroState.chargeProgress: number` (`0..1`, drives Fix #9 blaster charge animation)
    - `BossState.shieldFlashTimer: number` (`>0` renders Fix #1 hexagonal/energy deflect shield)
    - `BossState.overrideTaunt: string | null` and `BossState.overrideTauntTimer: number` (drives Fix #1 taunt bubble)
    - `LaserBolt.charged?: boolean` (drives Fix #9 super-shot beam) and `LaserBolt.skipStatusCheck?: boolean` (prevents 1st-shot JIRA-open bolt from immediately triggering a status taunt)
    - `drawBoss(ctx, boss, hovered, time, bossLabel, tauntText, aiSplitting?: boolean)`

- [ ] **Step 1: Create `types.ts`, `world.ts`, and `primitives.ts`**
  - `types.ts`: move all interfaces (`PlatformRect`, `StationDef`, `HeroState`, `BossState`, `LaserBolt`, `Particle`, `FloatingText`, `LevelUpBanner`, `StarDot`, `AcidBubble`, `StationId`, `InteractTargetId`) and add the new fields (`chargeProgress`, `shieldFlashTimer`, `overrideTaunt`, `overrideTauntTimer`, `charged`, `skipStatusCheck`).
  - `world.ts`: move `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `BOSS_TAUNTS`, `ACID_ZONE`, `PLATFORMS`, `STATIONS`, `createStars`, `createAcidBubbles` (all arrow functions).
  - `primitives.ts`: move `pxRect`, `drawPixelLabel`, `inkPoly`, `inkBox`, and add `wrapCanvasText(ctx, text, maxWidth, maxLines = 2): string[]` (word-wraps cleanly up to 2 lines with `...` ellipsis on line 2 overflow).

- [ ] **Step 2: Create `background.ts`, `stations.ts`, `hero.ts`, and `effects.ts`**
  - `background.ts`: move `drawBuildingList`, `drawBackground`, `drawPlatformsAndAcid`.
  - `stations.ts`: move `drawStations`.
  - `hero.ts`: move `drawHero` and `drawRobotPortrait`. In `drawHero`, when `hero.chargeProgress > 0`:
    - Draw pulsing cyan/yellow energy particles & expanding ring around the blaster muzzle proportional to `chargeProgress`.
    - Draw a crisp pixel charge bar above the hero (`AI SPLIT CHARGE` when `>= 1`, filling cyan → bright yellow at 100%).
  - `effects.ts`: move `drawEffects`. When `bolt.charged` is true, render a wider, glowing cyan-and-gold super-plasma bolt with inner white core.

- [ ] **Step 3: Create `boss.ts` (Fixes #1, #7, #9)**
  - Move `drawSpeechBubble` and `drawBoss`.
  - **Fix #7 (Boss task name readability & 2-line wrap):**
    - Widen nameplate to `barW = 300` (clamped cleanly within `CANVAS_WIDTH - 16`), increase font to `bold 15px "Silkscreen", monospace` (or `bold 14px "Plus Jakarta Sans", sans-serif` with crisp dark stroke/box `#0B1221` + bright `#FFFFFF` text and cyan border).
    - Wrap `bossLabel` via `wrapCanvasText(ctx, bossLabel, barW - 18, 2)` and dynamically size nameplate height (`28px` for 1 line, `46px` for 2 lines) positioned cleanly above the HP bar without overlapping the top-right HUD or speech bubble.
  - **Fix #1 (Shield deflect visual):** When `boss.shieldFlashTimer > 0`, draw a glowing cyan/blue translucent energy dome/arc in front of the boss with pixel scanlines fading with `shieldFlashTimer`.
  - **Fix #9 (AI splitting badge):** When `aiSplitting` is true, render a pulsing cyan `"⚡ AI SPLITTING QUEST..."` pixel badge directly beneath the HP bar / above the boss.

- [ ] **Step 4: Create `src/lib/arcade/index.ts`, point `src/lib/sprites.ts` to it, verify & update graphify**
  - Barrel-export all modules from `src/lib/arcade/index.ts`.
  - Replace `src/lib/sprites.ts` body with `export * from './arcade';` (deleted in Task 8).
  - Run: `npx tsc --noEmit`
  - Run: `graphify update .`
  - Expected: `npx tsc --noEmit` exits 0; ask user to verify and commit.

---

### Task 8: `InfoModal` + Decompose & Upgrade `ArcadeStage.tsx` (Real JIRA Combat, Instant Clicks, Charged AI Split, HUD Polish, Decoupled Calendar & Clean Progression)

**Files:**
- Create: `src/components/modals/InfoModal.tsx`
- Create: `src/components/arcade/ArcadeHud.tsx`
- Create: `src/components/arcade/ArcadeModals.tsx`
- Create: `src/components/arcade/simulation.ts`
- Modify: `src/components/ArcadeStage.tsx:1-1446`
- Delete: `src/lib/sprites.ts`

**Interfaces:**
- Consumes:
  - `@/lib/arcade` (all canvas types/renderers)
  - `checkBossCompletionAction`, `splitQuestAction` from `@/app/actions/jira`
  - `getCalendarEventsAction` from `@/app/actions/roadmap-calendar`
  - `saveSettingsAction`, `triggerBoostAction` from `@/app/actions/rpg`
- Produces:
  - `ModalKind = 'quest' | 'mind-dump' | 'quest-board' | 'roadmap' | 'calendar' | 'stats' | 'settings' | 'info' | null`
  - `src/components/modals/InfoModal.tsx` (Guide + fixed author footer)
  - `src/components/arcade/ArcadeHud.tsx` (Hydration-safe HUD, larger calendar pill, bottom-right `[i]` button, AI split banner)
  - `src/components/arcade/ArcadeModals.tsx` (Modal switcher)
  - `src/components/arcade/simulation.ts` (`stepHeroAndEffects`, `hitTestTarget`, `getCanvasPoint`, `getSurfaceTier`, `getNearestStation`)

- [ ] **Step 1: Create `src/components/modals/InfoModal.tsx` (Fix #10)**
  - Uses `ArcadeModalShell` with `title="ABOUT NEUROFORGE"`, `accentColor="cyan"`, and the fixed `footer` prop containing the exact required copy:
    ```text
    Designed and developed by Nikos Rzewucki
    www.nikos.click, https://github.com/NikosRz
    ```
    with clickable external links (`https://www.nikos.click` and `https://github.com/NikosRz`, `target="_blank" rel="noreferrer"`).
  - Scrollable body covers: what NeuroForge is for, XP & Levels, HP/Stamina & Rest Days (zero-guilt pacing), Boss Combat & JIRA Loop (1st shot opens JIRA, subsequent shots verify status & defeat Boss), Charged AI Split (hold Spacebar >3s), Quest Board `[B]`, Mind-Dump `[M]`, Holo-Radar Roadmap `[R]`, Calendar `[C]`.

- [ ] **Step 2: Create `src/components/arcade/ArcadeHud.tsx` (Fixes #8, #9, #10, #16, #22)**
  - **Fix #16 (SSR/client hydration safety):** Compute `todayLabel` and `nextEventLabel` inside a client `useEffect` (initial SSR render uses `''` / `'Loading schedule...'` or neutral placeholder, then populates on mount and updates relative minutes every 60s via `setInterval` with cleanup).
  - **Fix #8 (Larger Calendar pill):** Increase Calendar next-event pill typography to `text-xs sm:text-sm`, padding to `px-3.5 py-2`, and icon to `w-4 h-4`, allowing up to ~32 chars of title cleanly.
  - **Fix #10 (`[i]` button bottom-right):** Add a clickable `[i]` (`Info` icon) button at the bottom-right corner alongside the quiet control hint (updating hint to mention `Hold Space 3s AI Split`).
  - **Fix #9 (AI splitting banner):** Display a visible top-center status pill (`⚡ AI SPLITTING ACTIVE QUEST...`) while `aiSplitting` is true.

- [ ] **Step 3: Create `src/components/arcade/ArcadeModals.tsx` and `src/components/arcade/simulation.ts`**
  - `ArcadeModals.tsx`: renders `QuestModal`, `QuestBoardModal`, `MindDumpModal`, `RoadmapModal`, `CalendarModal`, `StatsModal`, `SettingsModal` (passing `onCalendarRefresh`), and `InfoModal`.
  - `simulation.ts`: extracts `getSurfaceTier`, `getNearestStation`, `getCanvasPoint`, `hitTestTarget`, and physics/particle/laser step logic (taking callbacks for `onLaserHitBoss(bolt)` so `ArcadeStage` stays small and focused). Removes auto-pilot walking logic (Fix #3).

- [ ] **Step 4: Refactor `src/components/ArcadeStage.tsx` & delete `src/lib/sprites.ts` (Fixes #1, #3, #9, #11, #12, #22)**
  - Switch imports from `@/lib/sprites` to `@/lib/arcade` and delete `src/lib/sprites.ts`.
  - Declare ALL `useRef`s before any `useEffect`s (Fix #22); store toast timeout in `toastTimerRef` and clear on unmount.
  - **Fix #11 (Decoupled calendar):**
    - Add `refreshCalendar = useCallback(async () => { const res = await getCalendarEventsAction(); setNextEvent(res.nextEvent); }, [])`.
    - Call `refreshCalendar()` once on mount and every `5 * 60_000` ms via `setInterval` (cleanup on unmount). Remove 5-minute `/api/state` polling.
    - Pass `onCalendarRefresh={refreshCalendar}` to `SettingsModal` and `onNextEventLoaded={setNextEvent}` to `CalendarModal`.
  - **Fix #12 (No fake progression / gate debug hotkeys):**
    - Remove `grantXp()` and all `maxExp + 150` client math. Drive `hud` strictly from `gameState.stats`.
    - Keep `triggerLevelUpBanner(newLevel)` purely visual (banner + audio + particles) triggered only when server `xpResult.leveledUp === true` (or dev-only `L` hotkey).
    - Gate `K` and `L` hotkeys behind `process.env.NODE_ENV === 'development'`; remove all `[DEBUG]` and `[ACTION]` `console.log` calls.
  - **Fix #3 (Instant click activation):**
    - Clicking any station immediately calls `activateStation(st.id)`.
    - Clicking the boss immediately opens `quest` modal (if `activeQuest`) or `quest-board` modal (if none) — no walking.
  - **Fix #1 (Real JIRA Boss combat):**
    - Track `engagedQuestKeysRef = useRef<Set<string>>(new Set())`, `bossCheckInFlightRef = useRef<boolean>(false)`, `bossCheckCooldownRef = useRef<number>(0)`.
    - In `shootLaser()` (called synchronously from `keydown`/`keyup`):
      - If `activeQuest?.url` exists and `!engagedQuestKeysRef.current.has(activeQuest.key)`:
        - Call `window.open(activeQuest.url, '_blank', 'noopener,noreferrer')` **synchronously** (Review Focus #2).
        - Add `activeQuest.key` to `engagedQuestKeysRef.current`.
        - Show subtle toast `Opened ${activeQuest.key} in JIRA — shoot again when done!`.
        - Fire visual laser bolt with `skipStatusCheck: true` so the 1st shot doesn't immediately taunt.
    - On subsequent normal laser hit on Boss (`onLaserHitBoss`):
      - Never award client XP or subtract HP.
      - If `!activeQuest`: show taunt `'Pin a quest from Console [B] first!'`.
      - If `bossCheckInFlightRef.current || bossCheckCooldownRef.current > 0`: deflect silently with shield flash.
      - Otherwise set `bossCheckInFlightRef.current = true`, `bossCheckCooldownRef.current = 1.5`, call `checkBossCompletionAction(activeQuest.key)`:
        - If `res.completed`: run `triggerBossDefeat()` (explosion + coins + fanfare), show floating text `+${res.xpResult.awardedXp} XP!`, trigger level-up banner if `res.xpResult?.leveledUp`, clear `activeQuest.key` from `engagedQuestKeysRef`, and `await refreshState()`.
        - Else: set `boss.shieldFlashTimer = 0.45`, `boss.overrideTaunt = res.currentStatus ? \`HaHa, you need to finish the task first! (${res.currentStatus})\` : 'HaHa, you need to finish the task first!'`, `boss.overrideTauntTimer = 3.5`, spawn cyan deflect sparks + play UI/shield SFX.
  - **Fix #9 (Long Spacebar >3s charged shot triggers AI task split):**
    - Track `spaceHoldRef = useRef<{ active: boolean; elapsed: number; firedCharged: boolean }>({ active: false, elapsed: 0, firedCharged: false })`.
    - On Spacebar `keydown` (`!e.repeat`): if near a station, `activateStation(near)` immediately; otherwise start `spaceHoldRef.current = { active: true, elapsed: 0, firedCharged: false }`.
    - In simulation loop: while `spaceHoldRef.current.active`, increment `elapsed += dt`; if `elapsed > 0.25` and `gameStateRef.current.activeQuest`, update `hero.chargeProgress = Math.min(1, (elapsed - 0.25) / 2.75)`. When `elapsed >= 3.0 && !firedCharged`, set `firedCharged = true`, reset `hero.chargeProgress = 0`, fire charged super-shot (`charged: true`), and trigger `handleChargedAiSplit()`.
    - On Spacebar `keyup`: if `!firedCharged` and `spaceHoldRef.current.active`, fire normal `shootLaser()` (synchronously in `keyup` so 1st-shot `window.open` stays inside a user gesture!). Reset `spaceHoldRef` and `hero.chargeProgress = 0`.
    - On window `blur` or modal open: reset `spaceHoldRef` and `hero.chargeProgress = 0` (Review Focus #4).
    - `handleChargedAiSplit()`: guards against concurrent split (`aiSplittingRef`); sets `aiSplitting = true`, calls `splitQuestAction({ jiraIssueKey: activeQuest.key, summary: activeQuest.summary })`, shows toast + floating text on completion (or error toast on failure), calls `refreshState()`, sets `aiSplitting = false`.

- [ ] **Step 5: Final full verification & graphify update**
  Run: `npx tsc --noEmit && npm run build`
  Run: `graphify update .`
  Expected: TypeScript check passes with 0 errors, Next.js production build succeeds, and knowledge graph is updated. Ask user to verify in the browser (`npm run dev`) and commit manually.
