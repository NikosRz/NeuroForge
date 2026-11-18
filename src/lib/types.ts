export type XpSourceType = 'micro_step' | 'focus_turn' | 'quest_clear';

export type RoadmapMode = 'off' | 'json' | 'jira_sync';

export type JiraAuthType = 'cloud' | 'server';

export type JiraAssigneeFilter = 'me_and_unassigned' | 'me_only' | 'all';

export interface JiraStatusOption {
  id: string;
  name: string;
  categoryKey: 'new' | 'indeterminate' | 'done';
}

export interface RpgPresets {
  defaultProfile: {
    name: string;
    weeklyXpGoal: number;
    staminaMax: number;
    overnightRecovery: number;
    restDays: number[];
  };
  staminaCosts: Record<XpSourceType, number>;
  xpAwards: {
    micro_step: number;
    focus_turn: number;
    quest_clear_base: number;
  };
  levelBaseXp: number;
  levelGrowthFactor: number;
  bossTaunts: string[];
}

export interface ProfileRow {
  id: number;
  name: string;
  total_xp: number;
  weekly_xp: number;
  weekly_xp_goal: number;
  weekly_reset_at: string;
  stamina: number;
  rest_days: string; // JSON array of weekday numbers 0..6 (0=Sun)
  streak_days: number;
  streak_shields: number;
  consecutive_work_days: number;
  last_active_date: string | null;
  last_reset_date: string;
  last_potion_week: string | null;
  potion_boost_date: string | null;
  muted: number; // 0 or 1
  active_quest_key: string | null;
  active_quest_summary: string | null;
  active_quest_status: string | null;
  active_quest_url: string | null;
}

export interface JiraConfigRow {
  id: number;
  base_url: string;
  auth_type: JiraAuthType;
  email: string;
  token: string;
  jql_scope: string;
  assignee_filter: JiraAssigneeFilter;
  roadmap_mode: RoadmapMode;
  ics_urls: string;
  completed_statuses: string; // JSON array of JIRA status names
}

export interface AiConfigRow {
  id: number;
  model: string;
  keep_alive: string;
  ollama_url: string;
}

export interface MicroStepRow {
  id: number;
  jira_issue_key: string;
  title: string;
  done: number; // 0 or 1
  sort_order: number;
  created_at: string;
}

export interface StickyNoteRow {
  id: number;
  content: string;
  est_minutes: number | null;
  created_at: string;
}

export interface RoadmapStepRow {
  id: string;
  title: string;
  status: 'done' | 'current' | 'locked';
  subtitle?: string;
  sort_order: number;
}

export interface CalendarEvent {
  uid: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  statusCategory: 'new' | 'indeterminate' | 'done';
  priority: string;
  epicKey?: string | null;
  epicName?: string | null;
  storyPoints?: number | null;
  url: string;
  isQuickWin: boolean;
}

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
}

export interface RpgStatsSnapshot {
  totalXp: number;
  weeklyXp: number;
  weeklyXpGoal: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  stamina: number;
  maxStamina: number;
  fatigued: boolean;
  boostAvailable: boolean;
  boostActiveToday: boolean;
  streakDays: number;
  streakShields: number;
  questsCleared: number;
  focusTurns: number;
}

export interface HydratedState {
  profile: {
    name: string;
    muted: boolean;
    restDays: number[];
    weeklyXpGoal: number;
  };
  stats: RpgStatsSnapshot;
  activeQuest: {
    key: string;
    summary: string;
    status: string;
    url: string;
  } | null;
  microSteps: MicroStepRow[];
  nextEvent: CalendarEvent | null;
  roadmapMode: RoadmapMode;
  roadmapSteps: RoadmapStepRow[];
  jiraConfigured: boolean;
  taunts: string[];
}
