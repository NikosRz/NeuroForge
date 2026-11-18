# NeuroForge — Fixes & Improvements Backlog

Tracked list of bugs, UX fixes, and behavior adjustments to be turned into an implementation plan.

---

## Fix #1: Boss Robot Combat Tied to Real JIRA Status (No Auto-XP / No In-App Override)

### Problem
- Currently, shooting the Boss robot in `src/components/ArcadeStage.tsx` grants client-side `+15 XP` and drains boss HP on every laser hit, allowing the robot to be defeated without completing the task in JIRA.
- `QuestModal` currently exposes in-app JIRA status transition buttons, allowing status changes from inside NeuroForge.

### Expected Behavior
1. **No automatic XP or HP drain on shot:** Regular laser hits must not grant XP or kill the robot while the JIRA task is still open.
2. **1st shot on a pinned quest (per quest key):**
   - Synchronously opens the pinned JIRA issue URL in a new browser tab (`window.open`, triggered on the keypress/click so browser popup blockers don't block it).
   - Marks the quest as opened/engaged for this session.
3. **Subsequent shots on the engaged quest:**
   - Queries live status from JIRA (`GET /rest/api/3/issue/{key}?fields=status`, with an in-flight lock / short cooldown to avoid spamming the API).
   - **If the issue status matches the configured "Completed" status(es):**
     - Robot explodes (`triggerBossDefeat`).
     - Real XP is awarded and persisted in SQLite (deduplicated by `issueKey`).
     - Active quest advances to the next open JIRA issue.
   - **If not yet completed:**
     - Shot deflects off the robot's shield (no XP, no kill).
     - Robot displays a taunt such as `"HaHa, you need to finish the task first!"` (and optionally its current JIRA status).
4. **Configurable Completed Statuses in Settings:**
   - Pull actual statuses from JIRA in **System Settings** (`GET /rest/api/3/project/{projectKey}/statuses` when a project is scoped, falling back to `GET /rest/api/3/status`).
   - Allow selecting one or more statuses that count as completed/killable (defaulting to JIRA `done` status category if none are explicitly selected).
   - Persist selected completed statuses in `jira_config`.
5. **No in-app status override:**
   - Remove status transition buttons from `QuestModal`. Status must be changed directly in JIRA.
   - Keep the **"Open in JIRA"** link in `QuestModal` (accessible via clicking the robot or pressing `E`) so the user can re-open the JIRA tab if they closed it.

### Likely Files Affected
- `src/lib/types.ts` & `src/lib/db.ts` (persist completed status list in `jira_config`)
- `src/lib/jira-client.ts` (fetch project/workspace statuses + lightweight live issue status check)
- `src/app/actions/jira.ts` & `src/app/actions/rpg.ts` (status fetch action, boss-check/kill action, settings save/load)
- `src/components/modals/SettingsModal.tsx` (pull & multi-select completed statuses)
- `src/components/modals/QuestModal.tsx` (remove transition override buttons; keep "Open in JIRA")
- `src/components/ArcadeStage.tsx` (1st-shot open JIRA, subsequent-shot live status check, shield deflect + taunt, explosion + XP on verified completion)

---

## Fix #2: Replace Hardcoded Hero Name with Name from JIRA

### Problem
- The hero name defaults to a hardcoded placeholder (`Alex`) instead of using the connected JIRA user's display name.

### Expected Behavior
- When JIRA is connected (on test/save or state hydration), pull the authenticated user's display name from JIRA (`/myself`) and use it as the hero name (updating `profile.name` when not explicitly customized or syncing it on JIRA connect).

---

## Fix #3: Instant Click Activation on Arcade Screen Elements

### Problem
- Clicking on screen stations/elements currently triggers hero auto-pilot walking before opening/activating the target.

### Expected Behavior
- Clicking any interactive element/station on the arcade stage triggers/opens it immediately without waiting for the hero robot to walk over to it.

---

## Fix #4: JIRA Base URL Pattern Validation & Placeholder

### Problem
- Users can paste full JIRA board/project URLs containing sub-paths (e.g., `https://org.atlassian.net/jira/software/projects/RES/boards/2`), which breaks REST API calls.

### Expected Behavior
- Validate the JIRA Base URL field so it rejects/warns on URLs containing sub-paths (detect `/` after the origin/host and show a clear inline warning).
- Keep/refine a clear placeholder showing the expected root format (e.g., `https://your-org.atlassian.net`).

---

## Fix #5: Settings Help `(i)` Popups for JIRA API Token & Calendar `.ics` Links

### Problem
- Users need clear in-app guidance on where to generate JIRA API tokens and how to obtain Google Calendar / Outlook Calendar `.ics` links.

### Expected Behavior
- Add `(i)` info buttons in **System Settings** that open a help popup/modal with step-by-step instructions:
  - **JIRA API Token**: Link to `https://id.atlassian.com/manage-profile/security/api-tokens` + step-by-step instructions on generating and copying the API token.
  - **Calendars (`.ics`)**: Step-by-step instructions on how to get the private `.ics` link from **Google Calendar** and **Outlook Calendar**.

---

## Fix #6: "Save Settings" Should Close the Settings Dialog

### Problem
- Clicking **Save Settings** saves the config and shows a notice, but leaves the Settings modal open.

### Expected Behavior
- After **Save Settings** succeeds, automatically close the Settings modal (while still refreshing the stage state and keeping it open if validation/save fails).

---

## Fix #7: Improve Visibility & Readability of Boss Task Name

### Problem
- The active JIRA task name above the Boss robot is hard to read (font size too small / cramped).

### Expected Behavior
- Increase the font size and improve contrast/readability of the task label above the Boss robot.
- Support wrapping across up to 2 lines cleanly so longer task summaries remain legible.

---

## Fix #8: Increase Size of Calendar Next Event HUD Pill

### Problem
- The upcoming calendar event indicator on the main screen HUD is slightly too small to read comfortably.

### Expected Behavior
- Increase the font size and padding/legibility of the top-right Calendar next-event pill on the main screen.

---

## Fix #9: Long Spacebar Hold (>3s) Charged Shot Triggers AI Task Split

### Problem
- Currently, splitting a quest into micro-steps with local AI (Ollama) is only accessible inside the Quest modal.

### Expected Behavior
- Holding **Spacebar** for more than **3 seconds** charges the hero's gun with a dedicated charge-up animation (visual energy buildup / progress indicator around the hero/blaster).
- Releasing (or reaching full charge >3s) fires a charged super-shot at the Boss robot.
- The charged shot triggers the AI task split (`splitQuestAction` / AI boot) to break the active quest into smaller micro-steps.
- Display a clear ongoing visual indicator on the stage while the AI split process is running (and feedback/result when complete).

---

## Fix #10: Arcade Info & Author Modal (`[i]` Button on Bottom Right)

### Problem
- There is no in-app guide explaining what NeuroForge is, how its mechanics work, or author credits.

### Expected Behavior
- Add an `[i]` button at the bottom-right of the arcade stage.
- Clicking `[i]` opens a modal with:
  - **Scrollable upper content**: Explanation of what the app is for, how it works, and all game/productivity mechanics (XP, HP/Stamina, Rest Days, Boss/JIRA loop, Charged AI Split, Quest Board, Mind Dump, Roadmap, Calendar).
  - **Fixed footer at the bottom of the modal**:
    ```text
    Designed and developed by Nikos Rzewucki
    www.nikos.click, https://github.com/NikosRz
    ```
    (with clickable links for `www.nikos.click` and `https://github.com/NikosRz`).

---

## Fix #11: Decouple Calendar Fetching from `/api/state` and Remove `globalThis` Cache

### Problem
- `loadHydratedState()` in `src/lib/state-loader.ts` currently fetches external `.ics` calendar feeds on every `/api/state` refresh, which required an in-memory `globalThis` cache to avoid slowing down every UI action (toggling micro-steps, pinning quests, etc.).

### Expected Behavior
- Remove `.ics` fetching and the `globalThis` `calendarCache` / `invalidateCalendarCache` completely from `src/lib/state-loader.ts` (and `src/app/actions/rpg.ts`).
- Keep `/api/state` strictly for fast local SQLite state (no external calendar network calls).
- In `src/components/ArcadeStage.tsx`, fetch `nextEvent` independently via `getCalendarEventsAction()`:
  - Once on initial mount
  - Every 5 minutes via `window.setInterval` (with proper cleanup on unmount)
  - When Settings are saved (so newly added/edited `.ics` URLs apply immediately)
  - When `CalendarModal` loads fresh events

---

## Code Review Findings (Architecture, Correctness & Clean Code)

> *Note: Client-side fake XP / boss kill and JIRA transition override are already covered under **Fix #1** (plus gating `K`/`L` debug hotkeys below), and removing the `globalThis` calendar cache is already covered under **Fix #11**.*

---

## Fix #12: Gate Production Debug Hotkeys & Remove Client-Side Fake Progression Math

### Problem
- `ArcadeStage.tsx` exposes debug hotkeys `K` (`triggerBossDefeat(true)`) and `L` (`triggerLevelUp(true)`) in production builds, logs `[DEBUG]` / `[ACTION]` to console, and uses a fake linear level-up formula (`maxExp + 150`) that contradicts `src/lib/rpg-engine.ts`.

### Expected Behavior
- Remove `grantXp()` and all client-side XP/level calculation; drive HUD XP/level and level-up banners strictly from persisted server state / `xpResult`.
- Gate `K`/`L` debug shortcuts behind `process.env.NODE_ENV === 'development'` (or remove them cleanly) and remove leftover debug `console.log` calls.

---

## Fix #13: Fix StrictMode Double-XP Bug in Focus Turn Timer

### Problem
- In `src/components/modals/QuestModal.tsx`, `handleFinishFocusTurn()` (which invokes `completeFocusTurnAction` with a fresh `randomUUID()`) is called directly inside the `setSecondsLeft((prev) => ...)` state updater. In React 19 StrictMode, updaters run twice, which can award double XP and deduct double stamina.

### Expected Behavior
- Keep the interval state updater pure (`setSecondsLeft((prev) => Math.max(0, prev - 1))`).
- Trigger `handleFinishFocusTurn()` from a dedicated `useEffect` when `timerRunning && secondsLeft === 0`, guarded by a ref so it fires at most once per completed turn.

---

## Fix #14: Fix JIRA Keyword Search JQL & Proper JQL Escaping

### Problem
- `buildJql` in `src/lib/jira-client.ts` always appends `OR key = "${safeSearch}"`, causing JIRA to return HTTP 400 on any keyword search that isn't a valid issue key (e.g., `"auth"`).
- String escaping only escapes `"` without escaping `\` first.

### Expected Behavior
- Escape backslashes before quotes (`raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')`).
- Only append `OR key = "${safeSearch}"` when the search query matches issue key format (`/^[A-Z][A-Z0-9_]+-\d+$/i`).

---

## Fix #15: Fix UTC vs. Local Timezone Mismatch & Deduplicate Date/Config Helpers

### Problem
- `src/lib/db.ts` seeds `last_reset_date` using UTC (`toISOString().slice(0, 10)`), while `src/lib/rpg-engine.ts` compares against local dates (`toLocalDateStr`), causing spurious daily resets outside UTC.
- `parseRestDays`, `getIsoWeekKey`, and `isJiraConfigured` are duplicated across `db.ts`, `rpg-engine.ts`, `state-loader.ts`, and `jira-client.ts` (with diverging validation).

### Expected Behavior
- Extract shared utilities (`toLocalDateStr`, `getIsoWeekKey`, `parseRestDays`, `isJiraConfigured`, `DEFAULT_OLLAMA_MODEL`) into a clean shared helper module and reuse them everywhere.
- Use `toLocalDateStr` consistently in both `db.ts` and `rpg-engine.ts`.

---

## Fix #16: Eliminate SSR / Client Hydration Mismatch on Dates & Relative Times

### Problem
- `ArcadeStage.tsx` computes `todayLabel` (`new Date().toLocaleDateString(...)`) and `formatNextEventLabel` (`toLocaleTimeString` + `Date.now()`) directly during render, causing React 19 hydration mismatches across timezones or minute boundaries.

### Expected Behavior
- Render date/relative time labels safely without SSR/client divergence (e.g., pass formatted date from server or compute locale/relative strings after client mount).

---

## Fix #17: Sanitize Errors at Server Action & API Boundaries (No Secret / SQLite Leakage)

### Problem
- Catch blocks across `src/app/actions/*`, `src/app/api/*`, and `src/lib/ics-client.ts` return raw `err.message`, which can leak private `.ics` URLs from `undici`/`fetch` errors or internal SQLite constraint errors.

### Expected Behavior
- Introduce a small error-normalization helper so every Server Action and Route Handler returns clean, actionable, user-facing `{ error }` messages without leaking URLs, credentials, stack traces, or SQLite internals.

---

## Fix #18: Add Runtime Input Validation & Atomic SQLite Transactions

### Problem
- Server Actions (`saveSettingsAction`, `saveRoadmapAction`) and `/api/ai/pull` trust client-supplied TypeScript types at runtime without validating enum allow-lists, URL protocols, or deduplicating roadmap step IDs.
- Multi-statement mutations (`toggleMicroStepAction`, `saveSettingsAction`, `useWeeklyPotion`) execute without `db.transaction(...)`.
- `loadHydratedState()` runs `applyDailyResetIfNeeded(db)` twice per load (directly and again inside `getRpgStats`).

### Expected Behavior
- Validate all inputs (enums, URLs, strings, roadmap items + unique IDs) at Server Action / Route Handler boundaries.
- Wrap `toggleMicroStepAction`, `saveSettingsAction`, and `useWeeklyPotion` in `db.transaction(...)`.
- Avoid redundant `applyDailyResetIfNeeded` calls and redundant `SELECT * FROM profile` queries.

---

## Fix #19: Clean Up Module Singletons, Static Preset Import & Unsafe Process Stop

### Problem
- `src/lib/presets.ts` uses `fs.readFileSync(path.join(process.cwd(), ...))` instead of a static JSON import, which is fragile if `cwd` changes or in standalone builds.
- `src/lib/db.ts` uses a plain module-level `singletonDb` that can leak open SQLite handles on dev HMR and doesn't close old handles if `dbPath` changes.
- `src/lib/ollama-client.ts` falls back to `pkill -f 'ollama serve'`, which can match unrelated processes; `motion` in `package.json` is unused.

### Expected Behavior
- Replace `fs.readFileSync` in `presets.ts` with a static JSON import of `@/config/rpg-presets.json`.
- Close the previous SQLite handle cleanly if `dbPath` changes and manage the DB singleton cleanly for Next.js dev HMR.
- Replace `pkill -f 'ollama serve'` with exact process matching (`pkill -x ollama`), and remove the unused `motion` dependency from `package.json`.

---

## Fix #20: Debounce & Cancel In-Flight Searches, Propagate SSE Abort & Use `next/font/google`

### Problem
- `QuestBoardModal` and `MindDumpModal` fire Server Actions on every keystroke with no debounce and no stale-response cancellation guard.
- `SettingsModal` doesn't abort the `/api/ai/pull` SSE stream on unmount, and `/api/ai/pull` doesn't forward `req.signal` to `pullOllamaModelStream`.
- `src/app/layout.tsx` loads Google Fonts via raw `<link>` tags instead of `next/font/google`.

### Expected Behavior
- Add ~300ms debounce and request-ID / cancellation guards to `QuestBoardModal` and `MindDumpModal` searches (and preserve unfiltered status/epic filter options in `QuestBoardModal`).
- Add `AbortController` cleanup on unmount in `SettingsModal` and pass `AbortSignal.any([req.signal, AbortSignal.timeout(...)])` in `/api/ai/pull`.
- Switch `src/app/layout.tsx` to `next/font/google`.

---

## Fix #21: Handle Recurring `.ics` Exceptions (`exdate` & `recurrences`)

### Problem
- `src/lib/ics-client.ts` expands `entry.rrule.between(...)` without checking `entry.exdate` (cancelled instances) or `entry.recurrences` (rescheduled instances), so cancelled meetings still appear.

### Expected Behavior
- Skip occurrences excluded by `entry.exdate` and apply overrides from `entry.recurrences` per `node-ical` conventions.

---

## Fix #22: Decompose Oversized God Files & Clean Up Style/UX Polish

### Problem
- `src/lib/sprites.ts` (1,802 lines), `src/components/ArcadeStage.tsx` (1,446 lines), `src/components/modals/SettingsModal.tsx` (584 lines), and `src/components/modals/QuestModal.tsx` (441 lines) mix too many responsibilities in single files.
- Minor cleanliness issues: remaining `function` declarations (violating `AGENTS.md` §1), refs used before declaration in `ArcadeStage.tsx`, uncleaned `setTimeout`s, non-null assertions (`res.step!`, `res.note!`), `SettingsModal` "Test SFX" silently muted when unchecking Mute before saving, missing `aria-labelledby` in `ArcadeModalShell`, and unused RPG contract fields (`subtask`, `epic_clear`, `quest_clear_max`).

### Expected Behavior
- Split oversized files into focused modules:
  - `src/lib/sprites.ts` → `src/lib/arcade/{types,world,primitives,background,stations,hero,boss,effects}.ts`
  - `src/components/ArcadeStage.tsx` → extract HUD/modal/input/simulation helpers
  - `src/components/modals/SettingsModal.tsx` → extract domain section components (`ProfileSection`, `JiraSection`, `OllamaSection`)
- Convert remaining `function` declarations to arrow functions, clean up `setTimeout` refs on unmount, narrow optional responses without `!`, fix `Test SFX` preview when unmuting, add `aria-labelledby` to `ArcadeModalShell`, and align/prune unused preset/type fields.
