# NeuroForge — Functional Requirements Specification

**Version:** 2.0  
**Date:** 2026-11-17  
**Status:** Draft (Retro Arcade Redesign — Ready for Review)  
**Supersedes:** Layout/UI direction in `2026-11-14-adhd-jira-rpg-design.md` (retaining core backend/RPG/AI integrations)

---

## 1. Product Vision & Goals

**NeuroForge** is a self-hosted, single-screen **2D retro arcade RPG wrapper for JIRA** built specifically for ADHD brains. Instead of presenting another corporate task dashboard, opening NeuroForge drops the user into a compact, zero-scroll 16-bit retro action stage inspired by **80s *Contra* (shooting action)** and *Super Mario*—upgraded with crisp modern pixel-art polish while keeping the classic arcade vibe.

### Core ADHD Goals
* **Eliminate "Work Dread" & Backlog Paralysis:** Hide complex lists inside physical room stations; display only **one active Enemy** representing your Next Quest.
* **Create Kinetic Dopamine & Immediate Rewards:** Attacking the Enemy, checking off micro-steps, defeating quests, and picking up power-ups trigger jumping `+XX XP` numbers and browser-generated 8-bit arcade sounds.
* **Prevent Time Blindness & Lost Thoughts:** Keep subtle "object permanence" anchors in the top HUD (next calendar meeting) and 1-hotkey/1-click access to Mind-Dump capture.
* **Protect Against Burnout Without Guilt:** Use an HP/Stamina bar, customizable Rest Days, and a 1x/week Mushroom/Potion boost—never deducting XP or punishing missed days.
* **100% Local Data Privacy:** All AI task splitting and quick-task matching run locally via **Ollama** (`qwen2.5:3b`), with credentials and local progress stored in SQLite.

---

## 2. Visual Direction, Audio & Centralized Presets

### 2.1 Visual Theme (Retro 80s *Contra* 16-Bit Cyber-City Aesthetic)
* **Stage Atmosphere:** Starry night sky (`#05070E` / `#000000`) with a **16-bit Futuristic Cyber-City skyline** (dark steel/navy pixel skyscrapers with glowing cyan/amber windows, industrial girders, and neon towers), **3 steel catwalk/deck platforms**, and a **bubbling Toxic Green Acid pool** (`#22C55E` / `#84CC16`) at the bottom-left — elevated to crisp 16-bit pixel quality.
* **Arcade UI & Modal Surfaces:** Deep arcade panel dark (`#0F172A`), crisp double-pixel bevel borders (`#334155` / `#FACC15` / `#38BDF8`), high-contrast readable modal text (`#F8FAFC` / `#CBD5E1`).
* **Semantic Arcade Accents:**
  * **Hero / Action / Shooting Sparks:** Arcade Blue (`#3B82F6` / `#38BDF8`) & Muzzle Gold (`#FACC15`).
  * **Enemy / Boss HP / High Priority:** Arcade Red (`#EF4444` / `#F97316`).
  * **HP / Stamina & Toxic Acid Pool:** Neon Green (`#22C55E` / `#84CC16`).
  * **EXP / Coins / Level-Up:** Arcade Gold (`#FACC15` / `#F59E0B`).
* **Typography:** Retro pixel display font (`Silkscreen` or `Press Start 2P`) for the top arcade HUD (`SCORE / EXP`, `HP`, `LV.4`, Enemy tags, `+120 XP!` popups) paired with `Plus Jakarta Sans` + `JetBrains Mono` inside modals for zero-strain ticket reading.
* **Playable Hero & Avatar:** Retro Robot commando sprite (shooting laser/blaster bolts at the Enemy on `Space`/Click) paired with DiceBear `bottts` HTTPS avatar (`https://api.dicebear.com/9.x/bottts/svg?seed=<seed>`) in the HUD.

### 2.2 Browser-Generated Arcade Audio
* **Pure Web Audio API Synth:** No external MP3/WAV dependencies required.
* **Sound Events:** Attack/punch/shoot, Enemy hit, Micro-step coin chime (`+15 XP`), Quest Defeat explosion + fanfare (`+120 XP`), Level-Up arpeggio, Mushroom/Potion power-up, Modal open/close.
* **Controls:** Global `[🔊 Mute/Unmute]` toggle in the top HUD (persisted in SQLite).

### 2.3 Centralized Preset Configuration (`1` JSON File)
* File: `src/config/rpg-presets.json`
* Stores all tunable defaults in one place: Stamina max (`100`), Stamina costs per action, overnight recovery, XP awards per source, Leveling curve, default Weekly EXP goal (`600`), default Rest Days, default Robot avatar seed, and the **~30 Enemy Speech Bubble taunts**.

---

## 3. Persistent Top HUD (Object-Permanence Anchors)

Even though room stations hide detailed lists until opened, minimal anchors remain visible at the top of the screen:

* **Top-Left:**
  * Current Date (e.g., `TUE, NOV 17, 2026`)
  * Greeting: `Hello, <Name>!`
* **Top-Right (Player HUD):**
  * **DiceBear `bottts` Robot Avatar**, Character Name, **Level**, and Level XP progress.
  * **Weekly EXP Meter** (toward weekly goal, resets weekly).
  * **HP / Stamina Bar (`0–100`)** + Fatigued warning indicator (`50% EXP`) when at `0` or after 7 consecutive non-rest days.
  * **Next Calendar Event Pill:** e.g. `📅 13:30 Design Review (in 22m)` — clicking opens the Calendar modal (or launches Google/Outlook).
  * `[🔊 Mute]` and `[⚙ Settings]` buttons.

---

## 4. Single-Screen Interactive Game Room (Functional Requirements)

### 4.1 Stage, Multi-Level Platforms & Dual-Input Navigation
* **Single Static Screen with 3 Jumpable Platform Tiers:** Non-scrolling `16:9` responsive *Contra*-style stage featuring **3 distinct vertical levels** (Ground Steel Deck above bubbling green acid, Mid Steel Catwalk Bridge, Upper High-Ground Ledge) so the Robot Hero can run, drop down (`S`/`↓`), and jump (`W`/`↑`) between tiers.
* **Cohesive 16-Bit Sci-Fi / *Contra* Props:** Every interactive station matches the sci-fi commando aesthetic (no fantasy chests, parchment scrolls, or wizard potions).
* **Movement & Keyboard Controls:**
  * `A` / `D` or `←` / `→` walks/runs left/right; `W` / `↑` jumps up to higher platforms; `S` / `↓` drops down through upper platforms; `Space` / `E` shoots/punches or activates the nearest station.
  * **Global Hotkeys (when no modal is open):** `M` (Mind-Dump), `B` (Quest Board), `R` (Roadmap), `C` (Calendar), `S` (Stats).
  * **Modal Keyboard Lock (Critical):** Whenever any modal/input field is open, all game movement/action hotkeys **automatically suspend** so typing never moves the hero.
* **Direct Mouse Interaction (Anti-Chore Guardrail):**
  * Clicking any room object (Mecha Boss, Energy Core, Data Pod, Command Console, Holo-Radar) triggers the Hero to auto-dash/jump/fire at it and immediately open its modal—zero forced platforming on low-energy days.

### 4.2 Interactive 3-Tier Room Stations

```text
+-----------------------------------------------------------------------------+
| TUE, NOV 17, 2026        [🤖 Alex Lv.4 | EXP 420/600 | HP 80/100]           |
| Hello, Alex!             [📅 13:30 Design Review (22m)] [🔊] [⚙]            |
+-----------------------------------------------------------------------------+
| TIER 3 (Upper Ledge):  [📡 Holo-Radar: ROADMAP [R]]    💬 "I'm waiting!"    |
|                        ============================   ┌───────────────────┐ |
| TIER 2 (Mid Bridge):   [🔋 Energy Boost (1/wk)]       │ PROJ-142: Auth... │ |
|                        ========================       │ HP: [████░░] 50%  │ |
| TIER 1 (Ground Deck):  [🗄 Data Pod [M]] [🖥 Console [B]]  🤖 ─► 💥  👾 Boss |
|=============================================================================|
```

#### FR-1: Mecha Boss Enemy (Right Side) — Active "Next Quest"
* Displays a retro mecha/alien enemy sprite named with the truncated active JIRA issue (`PROJ-142: Implement Auth...`) and an Enemy HP bar reflecting completed vs. total micro-steps/sub-tasks.
* **Enemy Speech Bubble ("Speaking Cloud"):** Replaces static motivational quotes. Displays random playful challenges from ~30 built-in taunts in `rpg-presets.json` (e.g., *"HaHa! I'm waiting for you!"*, *"I'm unbreakable!"*, *"Too scared to split me?"*). Cycles periodically or on click/hover.
* **Interaction:** Shooting, punching, or clicking the Enemy plays a blaster SFX/hit animation and opens the **Quest Modal**.
* **Combat Feedback:** Completing micro-steps inside the Quest Modal visibly damages the Enemy HP bar; completing the JIRA ticket triggers a defeat explosion, `+XX XP!` jumping text + fanfare, and spawns the next recommended Quest Enemy.
* **Empty / Rest States:**
  * If no open tasks exist (or JIRA is not configured): shows a calm base-camp / *"No active quests — check Console or Settings"* state.
  * On a configured **Rest Day**: Hero sits/recharges at base and Stamina restores to `100`.

#### FR-2: Energy Core / Power Capsule (Mid Bridge)
* Sci-fi **Energy Cell / *Contra*-style Power Capsule** representing the **1x/week Stamina Boost** (resets every Monday).
* Jumping into or clicking it triggers an arcade power-up sound, restores HP/Stamina to `100`, and locks **100% EXP** for the rest of that calendar day.
* Visually pulses/glows when Stamina reaches `0` (Fatigued state).

#### FR-3: Mind-Dump Data Pod (Ground Left)
* Sci-fi **Memory Vault / Data Pod**. Entering/clicking (or pressing `M`) opens the **Mind-Dump Modal**:
  * **Quick Capture:** Focused text input — type any stray thought and press `Enter` to save immediately (stored in SQLite; hidden from main room by default).
  * **Show Notes (`N`):** Toggleable/tabbed list inside the modal with live search and delete.
  * **Get Quick Task (`⚡`):** Button opening `"I have [5] [15] [30] mins free"` buttons; queries local Ollama (using cached/estimated durations) to return a matching saved note (e.g., `"Pay mobile bill"` for `5 mins`).

#### FR-4: Command Console (Ground Mid-Left)
* Retro sci-fi **Tactical Terminal / Command Console**. Entering/clicking (or pressing `B`) opens the **Quest Board Modal**:
  * Lists JIRA issues matching the configured scope (default: `assignee = currentUser() OR assignee IS EMPTY`).
  * Filters: Search, **Quick Wins (`⚡`)**, Epic, and Status.
  * **`[Pin as Next Quest]`:** Replaces the current Enemy in the stage with the chosen ticket.

#### FR-5: Holo-Radar Display (Upper Ledge — Optional)
* Sci-fi **Tactical Holo-Radar / Sector Map** on the top platform. Can be enabled/disabled in Settings. Entering/clicking (or pressing `R`) opens the **Roadmap Modal**:
  * Horizontal stepper (`Done` → `Current` → `Locked`) **scrollable left and right**, automatically scrolled/centered on the **Current Step** by default.
  * **Modes:** `off`, `json` (upload/paste JSON roadmap definition), or `jira_sync` (Epics, Sprints, or Fix Versions/Releases).

#### FR-6: Stats & Calendar Access
* **Today's Calendar Modal:** Opened by clicking the Top HUD `Next Meeting` pill (or pressing `C`). Displays chronological events parsed from Google/Outlook private `.ics` feed URLs, with a 1-click link to open the external calendar.
* **Stats Modal / Drawer:** Opened via `[S]` or clicking Level/Weekly EXP in HUD. Displays Focus Streak (+ Streak Shields), Quests Cleared, Quick Wins Ready, Epics/Bosses Cleared, and Focus Turns Logged.

---

## 5. Quest Modal Requirements (Opened from Enemy)

1. **Ticket Header:** Full JIRA key + summary; clicking opens the real JIRA ticket in a new tab (`<base_url>/browse/<ISSUE_KEY>`).
2. **Status & Completion:** Status transition dropdown (`To Do` / `In Progress` / `Done`) + prominent **`✓ Complete Quest`** button.
3. **Sub-Tasks / AI Splitting:**
   * If the JIRA ticket has real JIRA sub-tasks, display those.
   * Otherwise, display local micro-steps with a **`[✨ Split Quest (Local AI)]`** button (calls local Ollama `qwen2.5:3b` using JSON Schema `format` + `keep_alive: "30s"`) and a manual 1-line `+ Add micro-step` input.
   * Micro-steps stay in local SQLite only (never written back to JIRA).
4. **Focus Timer ("Battle Turn"):** Visual shrinking countdown bar (`15m` / `25m`) awarding `+25 XP` on completion.

---

## 6. RPG Rules, Local AI & Settings

### 6.1 Zero-Guilt RPG Economy
* **XP Idempotency:** XP is awarded once per unique `(source_type, item_id)` pair; unchecking or reopening never deducts XP and never double-awards.
* **Jumping `+XX XP!` Celebration:** Every EXP gain renders a floating/jumping `+XX XP` overlay for ~2–3 seconds alongside arcade audio.
* **Stamina & Rest Days:** Configurable Rest Days in Settings (minimum 1/week recommended). Working at `0` Stamina or 7 consecutive non-rest days halves new XP (`50%`) with a gentle prompt until rest or Potion use.
* **Focus Streaks & Shields:** Any XP event counts as an active day; Rest Days preserve streaks; start with `1` Shield (max `3`), earning `+1` per Weekly EXP Goal reached.

### 6.2 Settings Modal
* **Hero & Audio:** Character Name, DiceBear `bottts` Randomize Seed, Sound Mute/Test.
* **Campaign & Pacing:** Weekly EXP Goal, Rest Days picker, Roadmap mode (`off` / `json` upload-paste / `jira_sync`).
* **JIRA Connection:** Base URL, Cloud (Email + API Token) or Server/DC (PAT), Test Connection, Project/Sprint/Epic/JQL scope, Assignee filter (`me_and_unassigned` default).
* **Calendars (ICS):** Add/remove Google & Outlook private `.ics` URLs + external calendar link.
* **Local AI (Ollama):** Live status (`Not Installed` / `Stopped` / `Ready`), 1-click **Install Ollama** (OS-aware), **Download Model (`qwen2.5:3b`)** with live progress bar, **Start / Stop Local AI**, and `keep_alive` (`30s` default).

---

## 7. Non-Functional & Technical Constraints

* **Stack:** Next.js (App Router, TypeScript), Tailwind CSS, `better-sqlite3`, `node-ical`, Web Audio API, Vitest.
* **Persistence:** All state (`profile`, `jira_config`, `ai_config`, `micro_steps`, `roadmap_steps`, `sticky_notes`, `xp_events`) stored in local SQLite.
* **Graceful Failures:** Invalid `.ics` URLs, offline JIRA, or stopped/malformed Ollama responses must surface clear inline messages without crashing the game room.
