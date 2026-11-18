# NeuroForge v2.0 — Next.js Architecture & Design Specification

**Date:** 2026-11-18  
**Status:** Draft — Pending Approval  
**Supersedes / Consolidates:** `2026-11-17-neuroforge-functional-requirements-v2.md` (UI/functional spec) and `2026-11-16-adhd-jira-rpg-dashboard.md` (v1 backend plan), adapted to migrate the existing Vite `ArcadeStage` prototype to **Next.js 15 (App Router)**.

---

## 1. Intent & Why

NeuroForge is a self-hosted, single-screen **16-bit retro cyber-commando arcade RPG wrapper for JIRA** designed for ADHD brains. Instead of an overwhelming corporate backlog, it presents a single active Mecha Boss Enemy representing your Next Quest, hides lists inside physical 3-tier room stations, awards zero-guilt partial EXP with jumping `+XX XP` popups and Web Audio synth SFX, and keeps all AI task splitting and Mind-Dump matching 100% local via Ollama (`qwen2.5:3b`).

A working Vite + React 19 + Tailwind v4 frontend prototype (`src/components/ArcadeStage.tsx`, `src/lib/sprites.ts`, `src/lib/arcadeAudio.ts`) already exists with hardcoded demo values. This design migrates that prototype into a full-stack **Next.js 15 (App Router)** application backed by **SQLite (`better-sqlite3`)** and local Node API routes.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Migrate the existing 60fps `ArcadeStage`, `sprites.ts`, and `arcadeAudio.ts` into Next.js 15 App Router without losing visual fidelity, 3-tier platforming, or dual keyboard/mouse navigation.
- Implement full local SQLite persistence (`neuroforge.db`) and centralized RPG presets (`src/config/rpg-presets.json`).
- Implement the **Zero-Guilt RPG Engine**: XP idempotency, Stamina (`0–100`), Rest Days, 50% Fatigued mode, 1x/week Energy Core Boost, Focus Streaks, and Streak Shields.
- Connect live **JIRA** (Cloud Basic Auth & Server/DC PAT), **`.ics` Calendars** (`node-ical`), and **Local Ollama** (`qwen2.5:3b` with OS-aware install, SSE pull progress, start/stop, and `keep_alive: "30s"`).
- Build all 6 arcade-styled modals (**Quest**, **Mind-Dump**, **Quest Board**, **Roadmap**, **Calendar**, **Stats & Settings**) with automatic global hotkey locking whenever a modal or input is open.

### Non-Goals
- Multi-user SaaS, OAuth 2.0, or cloud-hosted databases.
- Writing local micro-steps back to JIRA (micro-steps stay strictly in local SQLite).
- DiceBear `bottts` avatar integration (deferred; keep the hard-coded canvas `drawRobotPortrait` for now).
- Automated test suite / TDD setup (explicitly excluded for this phase).

### Anti-Goals (Failure Conditions)
- Punishing missed days or deducting XP when unchecking micro-steps or reopening JIRA tickets.
- Blocking the game room when JIRA, `.ics`, or Ollama are offline or misconfigured.
- Allowing movement/action hotkeys (`A/D/W/S/Space/M/B/R/C/S`) to fire while typing inside any modal.

---

## 3. Constraints

- **Runtime:** Self-hosted local Next.js 15 (App Router, TypeScript, Tailwind CSS v4), running via `npm run dev` / `npm start`.
- **Database:** Local SQLite (`better-sqlite3` with WAL mode) stored on disk (`data/neuroforge.db` or configurable path).
- **Local AI:** Ollama (`qwen2.5:3b`, JSON Schema `format`, `keep_alive: "30s"`). No cloud AI APIs (`@google/genai` removed).
- **First-Run State:** Clean Base-Camp state when JIRA is unconfigured (*"No active quests — open Console [B] or Settings [⚙]"*), while Mind-Dump, Energy Core, and JSON Roadmap remain immediately usable.
- **Avatar:** Keep the existing canvas `drawRobotPortrait` in the HUD; ignore DiceBear `bottts` and avatar seed randomization.

---

## 4. Approaches Considered

1. **Full-Stack Next.js 15 (App Router) + Local Node API Routes (Selected):**
   - Port `ArcadeStage` (`'use client'`) into `src/app/page.tsx`, serve REST/SSE endpoints from `src/app/api/**`, and share TypeScript types across `src/lib/**`.
   - *Tradeoffs:* Requires replacing Vite/Express tooling with Next.js config (`next.config.ts`), but matches Section 7 of the v2 spec directly, keeps credentials/SQLite/Ollama server-side, and avoids CORS.
2. **Vite + Express Backend (Rejected):**
   - Keeps Vite untouched and adds a separate Express server. Rejected because the user explicitly chose to migrate to Next.js.
3. **Next.js Static Export / Browser-Only (Rejected):**
   - Cannot run `better-sqlite3`, cannot spawn/manage Ollama processes, exposes JIRA tokens in client state, and hits CORS on JIRA/ICS feeds.

---

## 5. Architecture & Decided Components

### 5.1 Directory & Module Structure
- `src/config/rpg-presets.json` — Single source of truth for Stamina max (`100`), stamina costs (`micro_step: 5`, `subtask: 5`, `focus_turn: 15`, `quest_clear: 20`), overnight recovery (`30`), XP awards (`micro_step: 15`, `subtask: 15`, `focus_turn: 25`, `quest_clear_base: 50`, `quest_clear_max: 150`, `epic_clear: 300`), leveling curve (`levelBaseXp: 150`, `levelGrowthFactor: 1.35`), weekly EXP goal (`600`), default rest days (`[0, 6]`), and ~30 Enemy taunts.
- `src/lib/db.ts` — `better-sqlite3` connection + schema (`profile`, `jira_config`, `ai_config`, `micro_steps`, `roadmap_steps`, `sticky_notes`, `xp_events` with `UNIQUE(source_type, item_id)`).
- `src/lib/rpg-engine.ts` — `calculateLevel`, `awardXp`, `useWeeklyPotion`, `applyDailyResetIfNeeded`, `getProfileSnapshot`.
- `src/lib/jira-client.ts` — JIRA Cloud (Basic Auth) & Server/DC (PAT) client: test connection, fetch issues (default JQL `assignee = currentUser() OR assignee IS EMPTY`), transition status, fetch epics/sprints/versions for Roadmap.
- `src/lib/ics-client.ts` — `node-ical` fetcher/parser returning today's chronological events + next upcoming event for the Top HUD pill.
- `src/lib/ollama-client.ts` — Ollama HTTP client (`/api/tags`, `/api/generate` with JSON schema `format` and `keep_alive: "30s"`) + OS-aware lifecycle helpers (detect installed, install, pull `qwen2.5:3b` with SSE progress, start/stop `ollama serve`).

### 5.2 API Routes (`src/app/api/`)
- `GET /api/state` — Hydrates HUD, active quest, next calendar event, weekly boost availability, and roadmap summary in one call (running `applyDailyResetIfNeeded`).
- `POST /api/rpg/boost` — Triggers the 1x/week Energy Core Boost.
- `POST /api/rpg/focus-complete` — Awards Focus Turn XP (`+25` base) and deducts Stamina (`15`).
- `GET/POST /api/mind-dump` & `DELETE /api/mind-dump/[id]` — CRUD for sticky notes; `POST /api/mind-dump/quick-task` matches a `5`/`15`/`30` min window via Ollama.
- `GET /api/jira/issues`, `POST /api/jira/pin`, `POST /api/jira/transition`, `POST /api/jira/test` — Quest Board listing, pinning active Boss quest, status transitions/completion (`+XP`), and connection test.
- `GET/POST/PATCH /api/micro-steps` — Local micro-step CRUD, completion toggle (`+15 XP` idempotent), and `POST /api/micro-steps/split` (Ollama task splitter).
- `GET/POST /api/roadmap` — Serves `off`, `json`, or `jira_sync` roadmap steps.
- `GET /api/calendar` — Parses configured `.ics` URLs for today's events.
- `GET/POST /api/settings` — Updates profile, campaign pacing, JIRA config, ICS URLs, mute flag, and Ollama settings.
- `GET/POST /api/ai/status`, `/api/ai/install`, `/api/ai/pull` (SSE), `/api/ai/start`, `/api/ai/stop` — Local Ollama management.

### 5.3 Frontend (`src/app/page.tsx`, `src/components/`)
- `ArcadeStage.tsx` (`'use client'`) — Retains the 3-tier retro game canvas stage, 60fps simulation, `drawRobotPortrait`, and `arcadeAudio`, wired to `/api/state` and modal callbacks. Suspends all canvas/global hotkeys whenever `activeModal !== null`.
- `src/components/modals/` — `QuestModal.tsx`, `MindDumpModal.tsx`, `QuestBoardModal.tsx`, `RoadmapModal.tsx`, `CalendarModal.tsx`, `StatsModal.tsx`, `SettingsModal.tsx` styled with the v2 dark arcade bevel aesthetic (`#0F172A`, `#334155`/`#FACC15`/`#38BDF8` borders, `Plus Jakarta Sans` + `JetBrains Mono` body copy).

---

## 6. Left to the Builder (Implementation Plan)
- Exact Next.js dependency versions (`next`, `react`, `better-sqlite3`, `node-ical`, `lucide-react`, `@tailwindcss/postcss`) and `next.config.ts` (`serverExternalPackages: ['better-sqlite3']`).
- Exact SQLite column definitions, API request/response payloads, and modal UI layout details.
- Ordered task-by-task migration & build sequence.
