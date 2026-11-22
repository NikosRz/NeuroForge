# NeuroForge v2.0 Next.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing Vite `ArcadeStage` retro game prototype into a full-stack Next.js 15 (App Router) application backed by SQLite, the Zero-Guilt RPG Engine, JIRA REST API, `.ics` calendars, local Ollama (`qwen2.5:3b`), and all 6 interactive arcade modals.

**Architecture:** Next.js 15 App Router (`src/app/`) hosts the `'use client'` 60fps `ArcadeStage` canvas + modal UI on `/` and local Node.js API routes under `/api/**`. Server-side modules in `src/lib/` handle `better-sqlite3` persistence, centralized RPG presets (`src/config/rpg-presets.json`), JIRA Cloud/Server requests, `node-ical` parsing, and local Ollama process/HTTP management.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), `better-sqlite3`, `node-ical`, `lucide-react`, Web Audio API, local Ollama (`qwen2.5:3b`).

**Spec:** `docs/superpowers/specs/2026-11-18-neuroforge-v2-nextjs-design.md`

## Global Constraints

- Self-hosted local Next.js (`npm run dev` / `npm start`); no multi-user SaaS, no OAuth 2.0, no cloud AI APIs.
- Keep the existing hard-coded canvas `drawRobotPortrait` in the HUD; do not implement DiceBear `bottts` or avatar randomization.
- Clean Base-Camp state on first launch when JIRA is unconfigured (*"No active quests — open Console [B] or Settings [⚙]"*); Mind-Dump, Energy Core, and JSON Roadmap remain usable offline.
- Zero-guilt RPG rules: never deduct XP when unchecking micro-steps or reopening JIRA tickets; enforce `UNIQUE(source_type, item_id)` on `xp_events`; 0 Stamina or 7 consecutive non-rest days halves new XP (`Math.floor(xp * 0.5)`); 1x/week Energy Core Boost restores Stamina to `100` and locks 100% EXP for that calendar day.
- Never write local micro-steps back to JIRA; micro-steps stay in local SQLite only.
- Modal Keyboard Lock: suspend all stage movement/action hotkeys (`A/D/W/S/Space/E/M/B/R/C`) whenever any modal is open.
- **Testing excluded:** Per user instruction, do not add test frameworks or write tests in this plan; verify each task with `npx tsc --noEmit` and `npm run build` (plus targeted runtime smoke checks).

## Review Focus

- **Unchecked micro-step / reopened JIRA ticket:** Toggling a micro-step off and back on or transitioning a ticket out of *Done* must never deduct XP or double-award XP (`UNIQUE(source_type, item_id)`).
- **Stamina 0 / 7-day non-rest fatigue + Weekly Boost override:** Fatigued mode halves XP (`Math.floor(baseXp * 0.5)`); triggering Energy Core Boost restores Stamina to `100`, locks 100% EXP for the current calendar day, and rejects a second boost in the same ISO week.
- **Malformed or offline Ollama output:** If Ollama is stopped, times out, or returns non-JSON, `/api/micro-steps/split` and `/api/mind-dump/quick-task` must return a structured `{ error }` JSON response without crashing or corrupting SQLite.
- **Unreachable JIRA or `.ics` URLs:** Invalid credentials or unreachable feeds must degrade gracefully with inline error banners so `/api/state` and the game room still load.
- **Blank Mind-Dump input & empty quick-task matches:** Whitespace-only Mind-Dump submissions are rejected (`400`); quick-task matching with zero notes returns a friendly empty-state message.

---

### Task 1: Migrate Tooling & App Shell from Vite to Next.js 15 (App Router)

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Delete (after porting): `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`

**Interfaces:**
- Produces: Working Next.js 15 App Router shell (`npm run dev`, `npm run build`, `npm run lint`) with `serverExternalPackages: ['better-sqlite3']` and Google Fonts (`Silkscreen`, `Plus Jakarta Sans`, `JetBrains Mono`) loaded in `src/app/layout.tsx`.

- [ ] **Step 1: Update `package.json` dependencies and scripts**
  Remove `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `express`, `@types/express`, `@google/genai`, `esbuild`, `tsx`, `autoprefixer`. Install `next@^15.3.0`, `better-sqlite3@^11.9.0`, `node-ical@^0.20.1`, `@tailwindcss/postcss@^4.1.0`, `@types/better-sqlite3@^7.6.13` (keeping `react`, `react-dom`, `lucide-react`, `tailwindcss`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`). Set scripts to `"dev": "next dev -p 3000"`, `"build": "next build"`, `"start": "next start -p 3000"`, `"lint": "tsc --noEmit"`.
- [ ] **Step 2: Run `npm install` and create `next.config.ts` and `postcss.config.mjs`**
  In `next.config.ts`, set `serverExternalPackages: ['better-sqlite3']`. In `postcss.config.mjs`, configure `@tailwindcss/postcss`.
- [ ] **Step 3: Update `tsconfig.json` for Next.js App Router**
  Configure `"jsx": "preserve"`, `"moduleResolution": "bundler"`, `"plugins": [{ "name": "next" }]`, `"paths": { "@/*": ["./src/*"] }`, and include `next-env.d.ts` + `.next/types/**/*.ts`.
- [ ] **Step 4: Create `src/app/globals.css`, `src/app/layout.tsx`, and placeholder `src/app/page.tsx`**
  Move Tailwind v4 `@import "tailwindcss";` and custom retro utility styles from `src/index.css` into `src/app/globals.css`. Load `Silkscreen`, `Plus_Jakarta_Sans`, and `JetBrains_Mono` via `next/font/google` in `src/app/layout.tsx` (CSS variables `--font-pixel`, `--font-sans`, `--font-mono`). Render a minimal placeholder in `src/app/page.tsx` and remove `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`.
- [ ] **Step 5: Verify build & typecheck**
  Run: `npx tsc --noEmit && npm run build`
  Expected: Zero TypeScript errors and clean Next.js production build.
- [ ] **Step 6: Commit**
  `git add -A && git commit -m "chore: migrate tooling and app shell from Vite to Next.js 15"`

---

### Task 2: Centralized Presets, Shared Domain Types & SQLite Persistence

**Files:**
- Create: `src/config/rpg-presets.json`
- Create: `src/lib/types.ts`
- Create: `src/lib/presets.ts`
- Create: `src/lib/db.ts`

**Interfaces:**
- Produces:
  - `src/lib/types.ts`: `RpgPresets`, `ProfileRow`, `JiraConfigRow`, `AiConfigRow`, `MicroStepRow`, `StickyNoteRow`, `RoadmapStepRow`, `XpSourceType`, `CalendarEvent`, `JiraIssueSummary`, `HydratedState`
  - `src/lib/presets.ts`: `getPresets(): RpgPresets`
  - `src/lib/db.ts`: `getDb(dbPath?: string): Database.Database`, `initSchema(db: Database.Database): void`

- [ ] **Step 1: Create `src/config/rpg-presets.json`**
  Include `defaultProfile` (`name: "Alex"`, `weeklyXpGoal: 600`, `staminaMax: 100`, `overnightRecovery: 30`, `restDays: [0, 6]`), `staminaCosts` (`micro_step: 5`, `subtask: 5`, `focus_turn: 15`, `quest_clear: 20`), `xpAwards` (`micro_step: 15`, `subtask: 15`, `focus_turn: 25`, `quest_clear_base: 50`, `quest_clear_max: 150`, `epic_clear: 300`), `levelBaseXp: 150`, `levelGrowthFactor: 1.35`, and `bossTaunts` (30 short retro game taunts).
- [ ] **Step 2: Create `src/lib/types.ts` and `src/lib/presets.ts`**
  Define strict TypeScript interfaces for all DB rows, API payloads, and `HydratedState` (`profile`, `levelInfo`, `activeQuest`, `microSteps`, `nextEvent`, `boostAvailable`, `roadmapMode`, `roadmapSteps`, `taunts`). `getPresets()` reads and validates `src/config/rpg-presets.json`.
- [ ] **Step 3: Implement `getDb` and `initSchema` in `src/lib/db.ts`**
  Store SQLite at `process.env.NEUROFORGE_DB_PATH || path.join(process.cwd(), 'data', 'neuroforge.db')` (creating `data/` automatically), enable `WAL` mode, and create tables: `profile` (id=1 singleton with `name`, `total_xp`, `weekly_xp`, `weekly_xp_goal`, `weekly_reset_at`, `stamina`, `rest_days`, `streak_days`, `streak_shields`, `consecutive_work_days`, `last_active_date`, `last_reset_date`, `last_potion_week`, `potion_boost_date`, `muted`, `active_quest_key`, `active_quest_summary`, `active_quest_status`, `active_quest_url`), `jira_config` (id=1 singleton with `base_url`, `auth_type`, `email`, `token`, `jql_scope`, `assignee_filter`, `roadmap_mode`, `ics_urls`), `ai_config` (id=1 singleton with `model`, `keep_alive`, `ollama_url`), `micro_steps`, `roadmap_steps`, `sticky_notes`, `xp_events` (`UNIQUE(source_type, item_id)`). Seed singleton default rows using `INSERT OR IGNORE`.
- [ ] **Step 4: Verify typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS with 0 errors.
- [ ] **Step 5: Commit**
  `git add src/config/rpg-presets.json src/lib/types.ts src/lib/presets.ts src/lib/db.ts && git commit -m "feat: add centralized rpg-presets, types, and SQLite schema"`

---

### Task 3: Zero-Guilt RPG Engine

**Files:**
- Create: `src/lib/rpg-engine.ts`

**Interfaces:**
- Consumes: `getDb`, `getPresets`, `ProfileRow`, `XpSourceType`
- Produces:
  - `calculateLevel(totalXp: number): { level: number; currentLevelXp: number; nextLevelXp: number }`
  - `getIsoWeekKey(date: Date): string`
  - `applyDailyResetIfNeeded(db: Database.Database, now?: Date): ProfileRow`
  - `awardXp(db: Database.Database, input: { sourceType: XpSourceType; itemId?: string; jiraIssueKey?: string; baseXp: number; now?: Date }): { awardedXp: number; multiplier: number; leveledUp: boolean; newLevel: number; stamina: number; fatigued: boolean; duplicate: boolean }`
  - `useWeeklyPotion(db: Database.Database, now?: Date): { success: boolean; reason?: string; stamina: number }`
  - `getRpgStats(db: Database.Database): { totalXp: number; weeklyXp: number; weeklyXpGoal: number; level: number; currentLevelXp: number; nextLevelXp: number; stamina: number; fatigued: boolean; boostAvailable: boolean; streakDays: number; streakShields: number; questsCleared: number; focusTurns: number; epicsCleared: number }`

- [ ] **Step 1: Implement `calculateLevel` and `getIsoWeekKey` in `src/lib/rpg-engine.ts`**
  Use `levelBaseXp` (`150`) and `levelGrowthFactor` (`1.35`) from `getPresets()` to compute current level, XP earned within current level, and XP required for next level.
- [ ] **Step 2: Implement `applyDailyResetIfNeeded(db, now)`**
  Compare `last_reset_date` (`YYYY-MM-DD`) to `today`:
  - If new day: if today's weekday is in `rest_days`, restore `stamina` to `100` and reset `consecutive_work_days = 0`; otherwise add `overnightRecovery` (`30`, capped at `100`).
  - If days were missed between `last_active_date` and yesterday and any missed day was not in `rest_days`: consume `1` `streak_shields` per missed non-rest day (if shields reach `0`, reset `streak_days = 0`).
  - If `weekly_reset_at` ISO week differs from current ISO week: reset `weekly_xp = 0` and update `weekly_reset_at`.
- [ ] **Step 3: Implement `awardXp(db, input)` and `useWeeklyPotion(db, now)`**
  - `awardXp`: inside a SQLite transaction, check `xp_events` for `(sourceType, itemId)` when `itemId` is set — if found, return `duplicate: true, awardedXp: 0` without touching stamina. Compute `fatigued = (stamina <= 0 || consecutive_work_days >= 7) && potion_boost_date !== todayStr`. Multiplier is `0.5` if fatigued, else `1.0`. Deduct stamina cost from `presets.staminaCosts[sourceType]` (clamped at `0`). Update `total_xp`, `weekly_xp` (granting `+1` `streak_shields` up to `3` if crossing `weekly_xp_goal` for the first time this week), `streak_days` / `consecutive_work_days` on first activity of the day, and insert into `xp_events`.
  - `useWeeklyPotion`: reject if `last_potion_week === currentIsoWeek`; otherwise set `stamina = 100`, `last_potion_week = currentIsoWeek`, `potion_boost_date = todayStr`.
- [ ] **Step 4: Verify typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS.
- [ ] **Step 5: Commit**
  `git add src/lib/rpg-engine.ts && git commit -m "feat: implement zero-guilt RPG engine with idempotent XP and stamina"`

---

### Task 4: JIRA REST Client & ICS Calendar Client

**Files:**
- Create: `src/lib/jira-client.ts`
- Create: `src/lib/ics-client.ts`

**Interfaces:**
- Consumes: `JiraConfigRow`, `JiraIssueSummary`, `CalendarEvent`, `RoadmapStepRow`
- Produces:
  - `src/lib/jira-client.ts`:
    - `testJiraConnection(cfg: JiraConfigRow): Promise<{ ok: boolean; user?: string; error?: string }>`
    - `fetchJiraIssues(cfg: JiraConfigRow, opts?: { search?: string; status?: string; epic?: string }): Promise<{ issues: JiraIssueSummary[]; error?: string }>`
    - `fetchJiraIssueDetail(cfg: JiraConfigRow, issueKey: string): Promise<{ issue?: JiraIssueSummary & { subtasks: Array<{ key: string; summary: string; done: boolean }> }; transitions: Array<{ id: string; name: string }>; error?: string }>`
    - `transitionJiraIssue(cfg: JiraConfigRow, issueKey: string, transitionId: string): Promise<{ ok: boolean; error?: string }>`
    - `fetchJiraRoadmap(cfg: JiraConfigRow): Promise<{ steps: RoadmapStepRow[]; error?: string }>`
  - `src/lib/ics-client.ts`:
    - `fetchTodayCalendarEvents(icsUrlsRaw: string, now?: Date): Promise<{ events: CalendarEvent[]; nextEvent: CalendarEvent | null; errors: string[] }>`

- [ ] **Step 1: Implement `src/lib/jira-client.ts`**
  Support both Cloud (`Basic base64(email:token)`) and Server/DC (`Bearer token`) auth headers, using `/rest/api/3` for Cloud and `/rest/api/2` for Server/DC. Default JQL appends `assignee = currentUser() OR assignee IS EMPTY` when `assignee_filter === 'me_and_unassigned'`. Wrap all `fetch` calls in `try/catch` with a 10s timeout so offline/401/403 errors return `{ error }` cleanly.
- [ ] **Step 2: Implement `src/lib/ics-client.ts`**
  Parse newline/comma-separated `.ics` URLs from `icsUrlsRaw`, fetch each via `node-ical.async.fromURL` with graceful per-URL error collection, filter events occurring today (handling recurring events and timezone dates), sort chronologically, and compute `nextEvent` (first event ending after `now`).
- [ ] **Step 3: Verify typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS.
- [ ] **Step 4: Commit**
  `git add src/lib/jira-client.ts src/lib/ics-client.ts && git commit -m "feat: add JIRA REST client and ICS calendar parser"`

---

### Task 5: Local Ollama Client & OS-Aware Lifecycle Manager

**Files:**
- Create: `src/lib/ollama-client.ts`

**Interfaces:**
- Consumes: `AiConfigRow`, `StickyNoteRow`
- Produces:
  - `getOllamaStatus(ollamaUrl?: string, model?: string): Promise<{ status: 'not_installed' | 'stopped' | 'ready'; modelInstalled: boolean; error?: string }>`
  - `installOllama(): Promise<{ ok: boolean; message: string }>`
  - `startOllamaServer(): Promise<{ ok: boolean; message: string }>`
  - `stopOllamaServer(): Promise<{ ok: boolean; message: string }>`
  - `pullOllamaModelStream(model: string, onProgress: (evt: { status: string; completed?: number; total?: number }) => void): Promise<void>`
  - `splitQuestWithOllama(cfg: AiConfigRow, summary: string, description?: string): Promise<{ steps: string[]; error?: string }>`
  - `pickQuickTaskWithOllama(cfg: AiConfigRow, minutes: 5 | 15 | 30, notes: StickyNoteRow[]): Promise<{ noteId?: number; text?: string; reason?: string; error?: string }>`

- [ ] **Step 1: Implement `getOllamaStatus`, `installOllama`, `startOllamaServer`, `stopOllamaServer`, and `pullOllamaModelStream`**
  Check `/api/tags` at `ollamaUrl` (`http://127.0.0.1:11434` default) for `ready`; if unreachable, check `which ollama` (macOS/Linux) or `where ollama` (Windows) to distinguish `stopped` vs `not_installed`. `installOllama` runs OS-appropriate installer (`brew install ollama` or official install script on macOS/Linux). `startOllamaServer` spawns detached `ollama serve`; `stopOllamaServer` terminates the spawned/running `ollama` process. `pullOllamaModelStream` posts to `/api/pull` with `stream: true` and forwards NDJSON progress chunks.
- [ ] **Step 2: Implement `splitQuestWithOllama` and `pickQuickTaskWithOllama`**
  Call `POST /api/generate` with `model: cfg.model` (`qwen2.5:3b`), `keep_alive: cfg.keep_alive` (`"30s"`), `stream: false`, and strict JSON Schema `format` (`{ type: "object", properties: { steps: { type: "array", items: { type: "string" } } }, required: ["steps"] }` for splitting; `{ noteId, reason }` for quick-task matching). Parse JSON defensively in `try/catch` and return structured `{ error }` if Ollama is stopped, times out, or returns malformed JSON.
- [ ] **Step 3: Verify typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS.
- [ ] **Step 4: Commit**
  `git add src/lib/ollama-client.ts && git commit -m "feat: add local Ollama client and lifecycle management"`

---

### Task 6: API Routes — State, RPG Actions, Mind-Dump, Calendar & Settings

**Files:**
- Create: `src/app/api/state/route.ts`
- Create: `src/app/api/rpg/boost/route.ts`
- Create: `src/app/api/rpg/focus-complete/route.ts`
- Create: `src/app/api/mind-dump/route.ts`
- Create: `src/app/api/mind-dump/[id]/route.ts`
- Create: `src/app/api/mind-dump/quick-task/route.ts`
- Create: `src/app/api/calendar/route.ts`
- Create: `src/app/api/settings/route.ts`

**Interfaces:**
- Consumes: `getDb`, `getPresets`, `applyDailyResetIfNeeded`, `awardXp`, `useWeeklyPotion`, `getRpgStats`, `fetchTodayCalendarEvents`, `pickQuickTaskWithOllama`
- Produces: JSON REST endpoints matching `HydratedState` and modal CRUD contracts.

- [ ] **Step 1: Implement `GET /api/state`**
  Run `applyDailyResetIfNeeded(db)`, query `profile`, `jira_config`, `micro_steps` for `active_quest_key`, `roadmap_steps`, and `fetchTodayCalendarEvents` (with short-lived 60s in-memory cache so polling doesn't hammer `.ics` URLs). Return `HydratedState`.
- [ ] **Step 2: Implement `POST /api/rpg/boost` and `POST /api/rpg/focus-complete`**
  `/api/rpg/boost` calls `useWeeklyPotion(db)` and returns `{ success, reason, stamina }`. `/api/rpg/focus-complete` calls `awardXp(db, { sourceType: 'focus_turn', itemId: 'focus-' + Date.now(), jiraIssueKey, baseXp: presets.xpAwards.focus_turn })`.
- [ ] **Step 3: Implement `/api/mind-dump`, `/api/mind-dump/[id]`, and `/api/mind-dump/quick-task`**
  `GET` lists notes ordered newest-first (with optional `?q=` filter); `POST` trims text, rejects empty strings with `400`, inserts into `sticky_notes`; `DELETE` removes by `id`; `quick-task` validates `minutes` (`5 | 15 | 30`), returns friendly empty message if no notes exist, otherwise calls `pickQuickTaskWithOllama`.
- [ ] **Step 4: Implement `GET /api/calendar` and `GET/POST /api/settings`**
  `GET /api/calendar` returns `{ events, nextEvent, errors }`. `GET /api/settings` returns `profile` + `jira_config` (masking token presence) + `ai_config`; `POST /api/settings` updates `name`, `weekly_xp_goal`, `rest_days`, `muted`, `jira_config` fields, `ics_urls`, `ai_config`.
- [ ] **Step 5: Verify typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS.
- [ ] **Step 6: Commit**
  `git add src/app/api/state src/app/api/rpg src/app/api/mind-dump src/app/api/calendar src/app/api/settings && git commit -m "feat: add state, RPG, mind-dump, calendar, and settings API routes"`

---

### Task 7: API Routes — JIRA, Micro-Steps, Roadmap & Ollama AI

**Files:**
- Create: `src/app/api/jira/issues/route.ts`
- Create: `src/app/api/jira/pin/route.ts`
- Create: `src/app/api/jira/transition/route.ts`
- Create: `src/app/api/jira/test/route.ts`
- Create: `src/app/api/micro-steps/route.ts`
- Create: `src/app/api/micro-steps/split/route.ts`
- Create: `src/app/api/roadmap/route.ts`
- Create: `src/app/api/ai/status/route.ts`
- Create: `src/app/api/ai/install/route.ts`
- Create: `src/app/api/ai/pull/route.ts`
- Create: `src/app/api/ai/start/route.ts`
- Create: `src/app/api/ai/stop/route.ts`

**Interfaces:**
- Consumes: `jira-client.ts`, `ollama-client.ts`, `rpg-engine.ts`, `db.ts`, `presets.ts`
- Produces: Complete JIRA, micro-step, roadmap, and Ollama SSE/control endpoints.

- [ ] **Step 1: Implement JIRA API routes (`/api/jira/issues`, `pin`, `transition`, `test`)**
  `pin` saves `active_quest_key`, `active_quest_summary`, `active_quest_status`, `active_quest_url` on `profile`. `transition` calls `transitionJiraIssue`; when transitioning to a `Done`-category status, calls `awardXp(db, { sourceType: 'quest_clear', itemId: issueKey, jiraIssueKey: issueKey, baseXp: presets.xpAwards.quest_clear_base })`, clears or advances `active_quest_key` to the next open issue if available, and returns the XP award result.
- [ ] **Step 2: Implement `/api/micro-steps` (`GET`, `POST`, `PATCH`, `DELETE`) and `POST /api/micro-steps/split`**
  `PATCH` toggles `done` in `micro_steps`; when `done === 1`, calls `awardXp(db, { sourceType: 'micro_step', itemId: String(id), jiraIssueKey, baseXp: presets.xpAwards.micro_step })`; when `done === 0`, updates `done = 0` without deducting XP. `split` calls `splitQuestWithOllama` and inserts returned steps into `micro_steps`.
- [ ] **Step 3: Implement `GET/POST /api/roadmap`**
  `GET` returns `roadmap_mode` and steps from `roadmap_steps` (for `json`) or `fetchJiraRoadmap` (for `jira_sync`). `POST` validates and saves uploaded/pasted JSON steps into `roadmap_steps` and updates `roadmap_mode`.
- [ ] **Step 4: Implement `/api/ai/status`, `install`, `pull` (SSE `text/event-stream`), `start`, `stop`**
  `/api/ai/pull` streams `data: {"status":..., "completed":..., "total":...}\n\n` events via `ReadableStream` using `pullOllamaModelStream`.
- [ ] **Step 5: Verify typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS.
- [ ] **Step 6: Commit**
  `git add src/app/api/jira src/app/api/micro-steps src/app/api/roadmap src/app/api/ai && git commit -m "feat: add JIRA, micro-steps, roadmap, and Ollama AI API routes"`

---

### Task 8: Port `ArcadeStage`, `sprites.ts`, and `arcadeAudio.ts` to Next.js

**Files:**
- Modify: `src/lib/sprites.ts`, `src/lib/arcadeAudio.ts`, `src/components/ArcadeStage.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `HydratedState` from `GET /api/state`, `POST /api/rpg/boost`, `POST /api/settings` (mute toggle)
- Produces: Live 60fps `ArcadeStage` (`'use client'`) mounted in `src/app/page.tsx` with dynamic HUD, dynamic Boss name/HP/taunts, Base-Camp empty state, Energy Core boost trigger, and `activeModal` state + hotkey lock.

- [ ] **Step 1: Add `'use client';` to `src/lib/arcadeAudio.ts` and `src/components/ArcadeStage.tsx`**
  Ensure `ArcadeAudioEngine` safely guards `window` access for SSR. Keep `drawRobotPortrait` and all 16-bit canvas drawing in `src/lib/sprites.ts`.
- [ ] **Step 2: Wire `ArcadeStage.tsx` to `/api/state` and modal state**
  Replace hardcoded `CALENDAR_EVENT`, `BOSS_NAME`, and `hud` defaults with `HydratedState` fetched on mount and refreshed via a `refreshState()` callback.
  - Render dynamic date (`new Date()`) and `Hello, ${state.profile.name}!` in Top-Left HUD.
  - Render dynamic Level, Weekly EXP (`weeklyXp / weeklyXpGoal`), Stamina (`stamina / 100` + `50% EXP` Fatigued badge when `fatigued`), and Next Calendar Event pill in Top-Right HUD.
  - When `activeQuest` is null, render the calm Base-Camp Boss slot (*"No active quests — open Console [B] or Settings [⚙]"*); otherwise render `activeQuest.key + summary`, Boss HP bar (`completedSteps / totalSteps`), and taunts from `state.taunts`.
  - Clicking/activating `energy` calls `POST /api/rpg/boost`, plays power-up SFX + `+100 HP!` floating text if successful, or shows a gentle toast if already used this week.
  - Clicking/hotkeying `boss` (`Space`/`Click` on Boss), `mindDump` (`M`), `questBoard` (`B`), `roadmap` (`R`), `calendar` (`C`), `stats` (`S` or clicking Level/EXP), or `settings` (`⚙`) sets `activeModal`.
  - **Modal Keyboard Lock:** In the `keydown`/`keyup` listeners, immediately `return` if `activeModalRef.current !== null` (except `Escape` to close the modal).
- [ ] **Step 3: Render `<ArcadeStage />` in `src/app/page.tsx`**
- [ ] **Step 4: Verify build & typecheck**
  Run: `npx tsc --noEmit && npm run build`
  Expected: PASS.
- [ ] **Step 5: Commit**
  `git add src/lib/arcadeAudio.ts src/lib/sprites.ts src/components/ArcadeStage.tsx src/app/page.tsx && git commit -m "feat: port ArcadeStage to Next.js with live state and modal hotkey lock"`

---

### Task 9: Arcade Modal Shell, Quest Modal & Quest Board Modal

**Files:**
- Create: `src/components/modals/ArcadeModalShell.tsx`
- Create: `src/components/modals/QuestModal.tsx`
- Create: `src/components/modals/QuestBoardModal.tsx`
- Modify: `src/components/ArcadeStage.tsx`

**Interfaces:**
- Consumes: `ArcadeAudioEngine`, `/api/jira/*`, `/api/micro-steps/*`, `/api/rpg/focus-complete`
- Produces: Reusable retro double-pixel bevel modal wrapper (`ArcadeModalShell`) + working `QuestModal` (FR-1 / Section 5) and `QuestBoardModal` (FR-4).

- [ ] **Step 1: Create `src/components/modals/ArcadeModalShell.tsx`**
  Dark arcade panel (`#0F172A`), crisp double-pixel bevel border (`#334155` / `#FACC15` / `#38BDF8`), `Silkscreen` header, `Plus Jakarta Sans` + `JetBrains Mono` body, `Escape` / backdrop close with `arcadeAudio` close SFX.
- [ ] **Step 2: Create `src/components/modals/QuestModal.tsx`**
  - Ticket header linking to `<base_url>/browse/<ISSUE_KEY>` in a new tab.
  - Status transition dropdown (`To Do` / `In Progress` / `Done`) + prominent **`✓ Complete Quest`** button (`POST /api/jira/transition` -> triggers Boss defeat explosion + `+XX XP` floating popup + fanfare via `onXpAwarded`).
  - Displays real JIRA sub-tasks if present; otherwise displays local `micro_steps` checklist, `✨ Split Quest (Local AI)` button (`POST /api/micro-steps/split`), and 1-line `+ Add micro-step` form (`POST /api/micro-steps`). Toggling a micro-step calls `PATCH /api/micro-steps` and triggers `+15 XP` popup + coin chime on first completion.
  - **Focus Timer ("Battle Turn"):** `15m` / `25m` countdown bar with Start/Pause/Reset; completing calls `POST /api/rpg/focus-complete` (`+25 XP`).
- [ ] **Step 3: Create `src/components/modals/QuestBoardModal.tsx`**
  Fetches `GET /api/jira/issues`, provides Search, Quick Wins (`⚡`), Epic, and Status filters, and **`[Pin as Next Quest]`** (`POST /api/jira/pin`) to replace the active Boss in the stage.
- [ ] **Step 4: Wire `QuestModal` and `QuestBoardModal` into `ArcadeStage.tsx`**
- [ ] **Step 5: Verify build & typecheck**
  Run: `npx tsc --noEmit && npm run build`
  Expected: PASS.
- [ ] **Step 6: Commit**
  `git add src/components/modals/ArcadeModalShell.tsx src/components/modals/QuestModal.tsx src/components/modals/QuestBoardModal.tsx src/components/ArcadeStage.tsx && git commit -m "feat: add ArcadeModalShell, QuestModal, and QuestBoardModal"`

---

### Task 10: Mind-Dump, Roadmap, Calendar, Stats & Settings Modals

**Files:**
- Create: `src/components/modals/MindDumpModal.tsx`
- Create: `src/components/modals/RoadmapModal.tsx`
- Create: `src/components/modals/CalendarModal.tsx`
- Create: `src/components/modals/StatsModal.tsx`
- Create: `src/components/modals/SettingsModal.tsx`
- Modify: `src/components/ArcadeStage.tsx`

**Interfaces:**
- Consumes: `/api/mind-dump/*`, `/api/roadmap`, `/api/calendar`, `/api/settings`, `/api/jira/test`, `/api/ai/*`
- Produces: Remaining 5 modals completing 100% of the v2 functional requirements.

- [ ] **Step 1: Create `src/components/modals/MindDumpModal.tsx`**
  Auto-focused quick-capture input (`Enter` submits to `POST /api/mind-dump`), toggleable/tabbed Notes list (`N` shortcut inside modal) with live search and delete, and **`⚡ Get Quick Task`** with `[5m] [15m] [30m]` buttons calling `POST /api/mind-dump/quick-task`.
- [ ] **Step 2: Create `src/components/modals/RoadmapModal.tsx`**
  Horizontal scrollable stepper (`Done` -> `Current` -> `Locked`) that auto-centers on the `Current` step via `scrollIntoView({ inline: 'center' })` on open. Supports `off`, `json` (paste/upload JSON), and `jira_sync` modes.
- [ ] **Step 3: Create `src/components/modals/CalendarModal.tsx` & `StatsModal.tsx`**
  - `CalendarModal`: lists today's chronological `.ics` events from `/api/calendar`, inline feed errors if any, and 1-click external calendar link.
  - `StatsModal`: displays Level, Total XP, Weekly EXP progress, Focus Streak + Streak Shields (`🛡️`), Quests Cleared, Epics Cleared, and Focus Turns Logged.
- [ ] **Step 4: Create `src/components/modals/SettingsModal.tsx`**
  Sections for Hero & Audio (Name, Mute/Test SFX), Campaign & Pacing (Weekly EXP Goal, Rest Days multi-select, Roadmap Mode + JSON editor), JIRA Connection (Base URL, Cloud/Server toggle, Email/Token/PAT, Test Connection, JQL Scope, Assignee filter), Calendars (ICS URLs textarea), and Local AI (Ollama live status badge, 1-click Install, SSE `qwen2.5:3b` Download progress bar, Start/Stop Local AI, `keep_alive` selector).
- [ ] **Step 5: Wire all 5 modals into `ArcadeStage.tsx`**
- [ ] **Step 6: Full verification**
  Run: `npx tsc --noEmit && npm run build`
  Start `npm run dev` and verify `GET http://localhost:3000/` returns `200` and `GET http://localhost:3000/api/state` returns valid JSON with Clean Base-Camp defaults.
- [ ] **Step 7: Commit**
  `git add src/components/modals src/components/ArcadeStage.tsx && git commit -m "feat: add MindDump, Roadmap, Calendar, Stats, and Settings modals"`
