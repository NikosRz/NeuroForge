import { getDb } from './db';
import { fetchJiraRoadmap } from './jira-client';
import { getPresets } from './presets';
import { applyDailyResetIfNeeded, getRpgStats } from './rpg-engine';
import { isJiraConfigured, parseRestDays } from './shared';
import type {
  HydratedState,
  JiraConfigRow,
  MicroStepRow,
  RoadmapMode,
  RoadmapStepRow,
} from './types';

export const loadHydratedState = async (): Promise<HydratedState> => {
  const db = getDb();
  const presets = getPresets();
  const now = new Date();
  const profile = applyDailyResetIfNeeded(db, now);
  const stats = getRpgStats(db, now, profile);
  const jiraCfg = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;

  const microSteps = profile.active_quest_key
    ? (db
        .prepare(
          'SELECT * FROM micro_steps WHERE jira_issue_key = ? ORDER BY sort_order ASC, id ASC'
        )
        .all(profile.active_quest_key) as MicroStepRow[])
    : [];

  const roadmapMode = (jiraCfg.roadmap_mode || 'off') as RoadmapMode;
  let roadmapSteps: RoadmapStepRow[] = [];
  if (roadmapMode === 'json') {
    roadmapSteps = db
      .prepare('SELECT * FROM roadmap_steps ORDER BY sort_order ASC')
      .all() as RoadmapStepRow[];
  } else if (roadmapMode === 'jira_sync') {
    const synced = await fetchJiraRoadmap(jiraCfg);
    roadmapSteps = synced.steps;
  }

  return {
    profile: {
      name: profile.name,
      muted: profile.muted === 1,
      restDays: parseRestDays(profile.rest_days),
      weeklyXpGoal: profile.weekly_xp_goal,
    },
    stats,
    activeQuest: profile.active_quest_key
      ? {
          key: profile.active_quest_key,
          summary: profile.active_quest_summary ?? profile.active_quest_key,
          status: profile.active_quest_status ?? 'To Do',
          url: profile.active_quest_url ?? '',
        }
      : null,
    microSteps,
    nextEvent: null,
    roadmapMode,
    roadmapSteps,
    jiraConfigured: isJiraConfigured(jiraCfg),
    taunts: presets.bossTaunts,
  };
};
