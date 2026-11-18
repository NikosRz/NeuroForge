# NeuroForge

> **A self-hosted, single-screen 16-bit retro arcade RPG wrapper for JIRA — built for ADHD brains.**

Instead of staring at an overwhelming corporate backlog, NeuroForge drops you into a compact, zero-scroll 16-bit cyber-commando stage. Your backlog lives inside physical room stations, and you face **one active Mecha Boss Enemy** representing your **Next Quest** — complete with laser/blaster combat, jumping `+XX XP` popups, Web Audio 8-bit synth SFX, local AI task splitting, and a zero-guilt stamina economy.

---

## Why NeuroForge?

- **Eliminate Backlog Paralysis:** Hide noisy lists behind interactive stations and focus on one pinned JIRA ticket at a time.
- **Kinetic Dopamine & Micro-Wins:** Shooting the Boss, checking off tiny micro-steps (`+15 XP`), finishing a `15m`/`25m` Battle Turn (`+25 XP`), and clearing quests (`+50 XP`) trigger immediate visual and 8-bit audio feedback.
- **Time-Blindness & Mind-Dump Anchors:** Keep your next `.ics` calendar meeting visible in the top HUD and unload stray thoughts in 1 keypress (`M`) without leaving the room.
- **Zero-Guilt Anti-Burnout Economy:** Unchecking a step or reopening a ticket **never deducts XP**. Missing days uses **Streak Shields** instead of wiping progress, and hitting `0` Stamina (or 7 consecutive non-rest days) gently halves new XP (`50%`) with a reminder to rest — or grab your **1x/week Energy Core Boost** to restore `100` Stamina.
- **100% Local & Private:** All progress, micro-steps, sticky notes, and credentials live in a local SQLite database (`data/neuroforge.db`), and AI task splitting / quick-task matching run locally via **Ollama** (`qwen2.5:3b`).

---

## Room Stations & Controls

| Station / HUD          | Hotkey / Trigger                      | What It Does                                                                                                                          |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Mecha Boss Enemy**   | Click Boss or `Space` / `E` near Boss | Opens **Quest Modal** (JIRA link, status transitions, `Complete Quest`, `15m`/`25m` Battle Turn timer, local AI micro-step splitter). |
| **Mind-Dump Data Pod** | `M` or click station                  | Quick-capture stray thoughts (`Enter`), search/delete notes, or ask local Ollama for a `5m` / `15m` / `30m` **Quick Task**.           |
| **Command Console**    | `B` or click station                  | Opens **Quest Board** to search JIRA issues, filter **Quick Wins (`⚡`)**, and pin your next Boss Quest.                              |
| **Energy Core**        | Jump/click station                    | **1x/week Power-Up** (resets Monday): restores Stamina to `100` and locks `100%` EXP for the rest of the day.                         |
| **Holo-Radar**         | `R` or click station                  | Horizontal scrollable **Roadmap** (`off`, pasted/uploaded `json`, or `jira_sync` Epics).                                              |
| **Next Meeting Pill**  | `C` or click HUD pill                 | Opens **Today's Schedule** parsed from Google/Outlook private `.ics` feeds.                                                           |
| **Level / EXP Bar**    | Click HUD bar                         | Opens **Stats & Streaks** (Weekly EXP Goal, Focus Streak, Streak Shields, Quests Cleared).                                            |
| **Settings**           | Click `⚙` in HUD                      | Configure Hero Name, Weekly EXP Goal, Rest Days, JIRA Cloud/Server credentials, `.ics` URLs, and **Local Ollama** lifecycle.          |

**Movement:** `A`/`D` or `←`/`→` to run · `W`/`↑` to jump between the 3 platform tiers · `S`/`↓` to drop down · `Space`/`E` to shoot laser or activate nearby station.  
_(All stage hotkeys automatically lock whenever any modal is open; press `ESC` to close.)_

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, Server Actions + Route Handlers, TypeScript)
- **UI & Audio:** React 19, Tailwind CSS v4, HTML5 `<canvas>` 16-bit pixel engine, pure Web Audio API 8-bit synth
- **Persistence:** SQLite (`better-sqlite3` in WAL mode) + centralized presets in `src/config/rpg-presets.json`
- **Integrations:** JIRA REST API (Cloud Basic Auth & Server/DC PAT), `node-ical` (`.ics` feeds), local **Ollama** (`qwen2.5:3b`)

---

## Installation & Running Locally

### Prerequisites

- **Node.js** `20+` and **npm**
- _(Optional)_ **Ollama** for local AI quest splitting & quick-task matching (can also be installed/started from the in-app **Settings** modal on macOS/Linux)

### Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/nikosrz/NeuroForge.git
   cd NeuroForge
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

   Or build and run in production mode:

   ```bash
   npm run build
   npm start
   ```

4. **Open NeuroForge:**
   Visit [http://localhost:3000](http://localhost:3000).  
   On first launch, you start in **Clean Base-Camp** mode — use **Mind-Dump (`M`)** right away, or click **`⚙` Settings** to connect JIRA, `.ics` calendars, and Ollama.

---

## Author

Created by **Nikos Rzewucki**

- Website: [https://nikos.click](https://nikos.click)

---

## License

Source-available for personal, non-commercial use and personal modification only. Commercial use and redistribution/rebranding are not permitted without written permission. See [LICENSE](LICENSE) for full terms.
