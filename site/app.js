const STATIONS = {
  boss: {
    name: 'Mecha Boss Enemy',
    hotkey: 'Space / E',
    tag: 'ACTIVE JIRA TICKET',
    summary:
      'Every pinned JIRA issue manifests as a single Mecha Boss on your stage. Shoot it to open the JIRA ticket, click the Boss for the Quest Modal & 15m/25m Battle Turns, or hold Spacebar to trigger local AI micro-task splitting.',
    bullets: [
      'Focus on one pinned JIRA ticket at a time — zero backlog overwhelm',
      'Local micro-steps spawn as bite-sized Micro-Bots without altering JIRA',
      'Clear micro-steps to expose the Boss Core and close the real ticket',
    ],
  },
  minddump: {
    name: 'Mind-Dump Data Pod',
    hotkey: 'M',
    tag: 'IMPULSE CAPTURE',
    summary:
      'Got a random thought mid-focus? Hit M from anywhere in the room, dump it in one Enter press, and return straight to your Boss fight without losing flow.',
    bullets: [
      'Instant 1-keypress capture stored locally in SQLite',
      'Ask on-demand local Ollama for a 5m, 15m, or 30m Quick Task match',
      'Search and clear captured notes whenever you have bandwidth',
    ],
  },
  console: {
    name: 'Command Console',
    hotkey: 'B',
    tag: 'JIRA QUEST BOARD',
    summary:
      'Your full JIRA backlog stays tucked behind the Command Console instead of staring at you all day. Open it only when you are ready to pick your next Boss.',
    bullets: [
      'Search live issues from JIRA Cloud or JIRA Server / Data Center',
      'Filter Quick Wins for low-energy afternoons',
      'Pin any ticket as your active Mecha Boss in one click',
    ],
  },
  energy: {
    name: 'Energy Core',
    hotkey: 'Jump / Click',
    tag: 'ZERO-GUILT ECONOMY',
    summary:
      'Built to reward consistency without punishing bad days. Unchecking a micro-step never deducts XP, Streak Shields cover missed days, and the Energy Core gives you a 1x/week Stamina refill.',
    bullets: [
      'Restores Stamina to 100 and locks 100% EXP for the rest of the day',
      'Gentle 50% XP fatigue reminder after 7 non-rest days prevents burnout',
      'Configure your own Rest Days and Weekly EXP Goal in Settings',
    ],
  },
  radar: {
    name: 'Holo-Radar',
    hotkey: 'R',
    tag: 'EPIC ROADMAP',
    summary:
      'Zoom out when you need big-picture context. View a horizontal scrollable roadmap synced from JIRA Epics or loaded from a local JSON file.',
    bullets: [
      'Supports JIRA Epic sync, local JSON upload, or hidden mode',
      'Keeps long-term milestones accessible without cluttering daily focus',
      'Zero extra project management maintenance required',
    ],
  },
  calendar: {
    name: 'Next Meeting Pill',
    hotkey: 'C',
    tag: 'TIME-BLINDNESS ANCHOR',
    summary:
      'Always know how long until your next call. NeuroForge parses your private Google or Outlook .ics feeds locally and pins the next meeting right in the top HUD.',
    bullets: [
      'Private .ics URLs stay strictly in your local SQLite database',
      'Prevents hyperfocus from making you late to standup',
      'Press C anytime to inspect today’s full schedule',
    ],
  },
};

const initReducedMotionVideos = () => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('video[autoplay]').forEach((video) => {
    video.removeAttribute('autoplay');
    video.pause();
    video.controls = true;
  });
};

const initStationTabs = () => {
  const tabs = Array.from(document.querySelectorAll('[data-station]'));
  const titleEl = document.getElementById('station-detail-title');
  const tagEl = document.getElementById('station-detail-tag');
  const hotkeyEl = document.getElementById('station-detail-hotkey');
  const summaryEl = document.getElementById('station-detail-summary');
  const bulletsEl = document.getElementById('station-detail-bullets');

  if (!tabs.length || !titleEl || !summaryEl || !bulletsEl) return;

  const selectStation = (key) => {
    const data = STATIONS[key];
    if (!data) return;

    tabs.forEach((tab) => {
      const active = tab.dataset.station === key;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    titleEl.textContent = data.name;
    if (tagEl) tagEl.textContent = data.tag;
    if (hotkeyEl) hotkeyEl.textContent = data.hotkey;
    summaryEl.textContent = data.summary;

    bulletsEl.innerHTML = data.bullets
      .map(
        (item) => `
        <li>
          <svg class="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42 0l-3.25-3.27a1 1 0 1 1 1.42-1.41l2.54 2.557 6.54-6.585a1 1 0 0 1 1.414-.006Z" clip-rule="evenodd" />
          </svg>
          <span>${item}</span>
        </li>`,
      )
      .join('');
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => selectStation(tab.dataset.station));
  });

  selectStation('boss');
};

const initCopyButtons = () => {
  const buttons = document.querySelectorAll('[data-copy]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('is-copied');
        btn.setAttribute('aria-label', 'Copied to clipboard');
        window.setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.setAttribute('aria-label', 'Copy command');
        }, 1800);
      } catch {
        // Fallback ignored when clipboard API is unavailable
      }
    });
  });
};

const initMobileMenu = () => {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
};

initReducedMotionVideos();
initStationTabs();
initCopyButtons();
initMobileMenu();
