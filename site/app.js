const STATIONS = {
  boss: {
    name: 'Mecha Boss',
    hotkey: 'Space / E',
    tag: 'ACTIVE JIRA TICKET',
    summary:
      'Kills the "wall of awful" by turning one pinned JIRA ticket into a single Mecha Boss on your stage. Click the Boss for the Quest Modal, hold Space to split it into Mini-bots with local Ollama, and shoot it once you close the ticket in JIRA to defeat it and claim XP.',
    bullets: [
      'Focus on one pinned JIRA ticket at a time — zero backlog overwhelm',
      'Private micro-steps spawn as bite-sized Mini-bots without altering JIRA',
      'Clear Mini-bots for +15 XP momentum hits, then finish the ticket in JIRA to defeat the Boss',
    ],
  },
  minddump: {
    name: 'Mind-Dump Data Pod',
    hotkey: 'M',
    tag: 'DISTRACTION GUARD',
    summary:
      'Stops distraction spirals before they derail your focus. Hit M from anywhere in the Command Room, park a stray thought in one Enter press, and return straight to your Boss — or ask for a 5m Quick Task when you are stuck procrastinating.',
    bullets: [
      'Instant 1-keypress capture stored locally in SQLite',
      'Ask on-demand local Ollama for a 5m, 15m, or 30m Quick Task match',
      'Filter and clear captured thoughts whenever you have bandwidth',
    ],
  },
  console: {
    name: 'Command Console',
    hotkey: 'B',
    tag: 'JIRA QUEST BOARD',
    summary:
      'Keeps backlog anxiety out of sight until you are actually ready to pick your next fight. Open the Quest Board only when you want to search tickets or swap your active Boss.',
    bullets: [
      'Search live tickets from JIRA Cloud & Server / Data Center',
      'Filter Quick Wins for low-energy or distracted afternoons',
      'Pin any JIRA ticket as your active Mecha Boss in one click',
    ],
  },
  energy: {
    name: 'Energy Core',
    hotkey: 'Jump / Click',
    tag: 'STAMINA & RECOVERY',
    summary:
      'Your in-room 1x/week Stamina refill station. Built so a low-energy day never snowballs into burnout or abandoning your workflow.',
    bullets: [
      'Jump into or click the Energy Core to restore Stamina to 100 and lock 100% XP for the day',
      'Gentle 50% XP fatigue reminder after 7 non-rest days encourages recovery',
      'Configure your own Rest Days and Weekly XP Goal in Settings',
    ],
  },
  radar: {
    name: 'Holo-Radar',
    hotkey: 'R',
    tag: 'EPIC ROADMAP',
    summary:
      'Zoom out only when you need big-picture context — without letting long-term deadlines clutter your daily focus. View a horizontal roadmap synced from JIRA Epics or a local JSON file.',
    bullets: [
      'Supports JIRA Epic sync, local JSON upload, or hidden mode',
      'Keeps milestones accessible without triggering daily overwhelm',
      'Zero extra project management maintenance required',
    ],
  },
  calendar: {
    name: 'Next Meeting Pill',
    hotkey: 'C',
    tag: 'TIME-BLINDNESS ANCHOR',
    summary:
      'Built for ADHD time-blindness so hyperfocus never makes you late. NeuroForge parses your private Google or Outlook .ics feeds locally and keeps your next meeting visible in the top HUD.',
    bullets: [
      'Private .ics URLs stay strictly in your local SQLite database',
      'Always see the countdown to your next standup or call at a glance',
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
    const originalLabel = btn.getAttribute('aria-label') || 'Copy command';
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('is-copied');
        btn.setAttribute('aria-label', 'Copied to clipboard');
        window.setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.setAttribute('aria-label', originalLabel);
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
