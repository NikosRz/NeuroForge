'use server';

import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import { testJiraConnection } from '@/lib/jira-client';
import { getPresets } from '@/lib/presets';
import { awardXp, useWeeklyPotion, type AwardXpResult } from '@/lib/rpg-engine';
import {
  isJiraConfigured,
  isValidHttpUrl,
  parseCompletedStatuses,
  parseRestDays,
  validateJiraBaseUrl,
} from '@/lib/shared';
import type {
  AiConfigRow,
  JiraAssigneeFilter,
  JiraAuthType,
  JiraConfigRow,
  ProfileRow,
  RoadmapMode,
} from '@/lib/types';

const VALID_AUTH_TYPES = new Set<JiraAuthType>(['cloud', 'server']);
const VALID_ASSIGNEE_FILTERS = new Set<JiraAssigneeFilter>([
  'me_and_unassigned',
  'me_only',
  'all',
]);
const VALID_ROADMAP_MODES = new Set<RoadmapMode>(['off', 'json', 'jira_sync']);
const VALID_KEEP_ALIVES = new Set<string>(['30s', '5m', '15m']);

export const triggerBoostAction = async (): Promise<{
  success: boolean;
  reason?: string;
  stamina: number;
  error?: string;
}> => {
  try {
    const db = getDb();
    return useWeeklyPotion(db);
  } catch (err) {
    return {
      success: false,
      stamina: 0,
      error: normalizeError(err, 'Failed to activate Energy Core Boost.'),
    };
  }
};

export const completeFocusTurnAction = async (input?: {
  jiraIssueKey?: string;
}): Promise<{ data?: AwardXpResult; error?: string }> => {
  try {
    const db = getDb();
    const presets = getPresets();
    const issueKey = input?.jiraIssueKey?.trim() || undefined;
    const result = awardXp(db, {
      sourceType: 'focus_turn',
      itemId: `focus-${randomUUID()}`,
      jiraIssueKey: issueKey,
      baseXp: presets.xpAwards.focus_turn,
    });
    return { data: result };
  } catch (err) {
    return { error: normalizeError(err, 'Failed to record Focus Turn.') };
  }
};

export interface SettingsSnapshot {
  profile: {
    name: string;
    weeklyXpGoal: number;
    restDays: number[];
    muted: boolean;
  };
  jira: {
    baseUrl: string;
    authType: JiraAuthType;
    email: string;
    hasToken: boolean;
    jqlScope: string;
    assigneeFilter: JiraAssigneeFilter;
    roadmapMode: RoadmapMode;
    icsUrls: string;
    completedStatuses: string[];
  };
  ai: {
    model: string;
    keepAlive: string;
    ollamaUrl: string;
  };
}

export const getSettingsAction = async (): Promise<{
  data?: SettingsSnapshot;
  error?: string;
}> => {
  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow;
    const jira = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    const ai = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;

    return {
      data: {
        profile: {
          name: profile.name,
          weeklyXpGoal: profile.weekly_xp_goal,
          restDays: parseRestDays(profile.rest_days),
          muted: profile.muted === 1,
        },
        jira: {
          baseUrl: jira.base_url,
          authType: jira.auth_type,
          email: jira.email,
          hasToken: Boolean(jira.token.trim()),
          jqlScope: jira.jql_scope,
          assigneeFilter: jira.assignee_filter,
          roadmapMode: jira.roadmap_mode,
          icsUrls: jira.ics_urls,
          completedStatuses: parseCompletedStatuses(jira.completed_statuses),
        },
        ai: {
          model: ai.model,
          keepAlive: ai.keep_alive,
          ollamaUrl: ai.ollama_url,
        },
      },
    };
  } catch (err) {
    return { error: normalizeError(err, 'Failed to load settings.') };
  }
};

export interface SaveSettingsInput {
  profile?: {
    name?: string;
    weeklyXpGoal?: number;
    restDays?: number[];
    muted?: boolean;
  };
  jira?: {
    baseUrl?: string;
    authType?: JiraAuthType;
    email?: string;
    token?: string;
    jqlScope?: string;
    assigneeFilter?: JiraAssigneeFilter;
    roadmapMode?: RoadmapMode;
    icsUrls?: string;
    completedStatuses?: string[];
  };
  ai?: {
    model?: string;
    keepAlive?: string;
    ollamaUrl?: string;
  };
}

export const saveSettingsAction = async (
  input: SaveSettingsInput
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (input.jira?.baseUrl !== undefined) {
      const check = validateJiraBaseUrl(input.jira.baseUrl);
      if (!check.valid) {
        return { ok: false, error: check.error };
      }
    }

    if (input.jira?.authType !== undefined && !VALID_AUTH_TYPES.has(input.jira.authType)) {
      return { ok: false, error: 'Invalid JIRA auth type.' };
    }

    if (
      input.jira?.assigneeFilter !== undefined &&
      !VALID_ASSIGNEE_FILTERS.has(input.jira.assigneeFilter)
    ) {
      return { ok: false, error: 'Invalid JIRA assignee filter.' };
    }

    if (
      input.jira?.roadmapMode !== undefined &&
      !VALID_ROADMAP_MODES.has(input.jira.roadmapMode)
    ) {
      return { ok: false, error: 'Invalid roadmap mode.' };
    }

    if (input.jira?.icsUrls !== undefined) {
      const lines = input.jira.icsUrls
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean);
      if (lines.some((u) => !isValidHttpUrl(u))) {
        return {
          ok: false,
          error: 'Every Calendar .ics URL must be a valid http:// or https:// URL.',
        };
      }
    }

    if (input.ai?.ollamaUrl !== undefined) {
      const trimmed = input.ai.ollamaUrl.trim();
      if (trimmed && !isValidHttpUrl(trimmed)) {
        return { ok: false, error: 'Ollama URL must be a valid http:// or https:// URL.' };
      }
    }

    if (input.ai?.keepAlive !== undefined && !VALID_KEEP_ALIVES.has(input.ai.keepAlive.trim())) {
      return { ok: false, error: 'Invalid Ollama keep-alive value.' };
    }

    const db = getDb();

    const saveTx = db.transaction((): { updatedJira: JiraConfigRow; updatedProfile: ProfileRow } => {
      if (input.profile) {
        const current = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow;
        const name = input.profile.name?.trim() || current.name;
        const weeklyXpGoal =
          typeof input.profile.weeklyXpGoal === 'number' &&
          Number.isFinite(input.profile.weeklyXpGoal) &&
          input.profile.weeklyXpGoal >= 50
            ? Math.round(input.profile.weeklyXpGoal)
            : current.weekly_xp_goal;
        const restDays = Array.isArray(input.profile.restDays)
          ? JSON.stringify(
              Array.from(
                new Set(
                  input.profile.restDays.filter(
                    (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6
                  )
                )
              ).sort((a, b) => a - b)
            )
          : current.rest_days;
        const muted =
          typeof input.profile.muted === 'boolean' ? (input.profile.muted ? 1 : 0) : current.muted;

        db.prepare(
          'UPDATE profile SET name = ?, weekly_xp_goal = ?, rest_days = ?, muted = ? WHERE id = 1'
        ).run(name, weeklyXpGoal, restDays, muted);
      }

      if (input.jira) {
        const current = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
        const baseUrl =
          input.jira.baseUrl !== undefined ? input.jira.baseUrl.trim() : current.base_url;
        const authType = input.jira.authType ?? current.auth_type;
        const email = input.jira.email !== undefined ? input.jira.email.trim() : current.email;
        const token = input.jira.token?.trim() ? input.jira.token.trim() : current.token;
        const jqlScope =
          input.jira.jqlScope !== undefined ? input.jira.jqlScope.trim() : current.jql_scope;
        const assigneeFilter = input.jira.assigneeFilter ?? current.assignee_filter;
        const roadmapMode = input.jira.roadmapMode ?? current.roadmap_mode;
        const icsUrls =
          input.jira.icsUrls !== undefined ? input.jira.icsUrls.trim() : current.ics_urls;
        const completedStatuses = Array.isArray(input.jira.completedStatuses)
          ? JSON.stringify(
              Array.from(
                new Set(
                  input.jira.completedStatuses
                    .filter((s): s is string => typeof s === 'string')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              )
            )
          : current.completed_statuses;

        db.prepare(
          `UPDATE jira_config SET
            base_url = ?, auth_type = ?, email = ?, token = ?,
            jql_scope = ?, assignee_filter = ?, roadmap_mode = ?, ics_urls = ?,
            completed_statuses = ?
          WHERE id = 1`
        ).run(
          baseUrl,
          authType,
          email,
          token,
          jqlScope,
          assigneeFilter,
          roadmapMode,
          icsUrls,
          completedStatuses
        );
      }

      if (input.ai) {
        const current = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
        const model = input.ai.model?.trim() || current.model;
        const keepAlive = input.ai.keepAlive?.trim() || current.keep_alive;
        const ollamaUrl = input.ai.ollamaUrl?.trim() || current.ollama_url;

        db.prepare('UPDATE ai_config SET model = ?, keep_alive = ?, ollama_url = ? WHERE id = 1').run(
          model,
          keepAlive,
          ollamaUrl
        );
      }

      const updatedJira = db
        .prepare('SELECT * FROM jira_config WHERE id = 1')
        .get() as JiraConfigRow;
      const updatedProfile = db
        .prepare('SELECT * FROM profile WHERE id = 1')
        .get() as ProfileRow;
      return { updatedJira, updatedProfile };
    });

    const { updatedJira, updatedProfile } = saveTx();

    // Best-effort sync of hero name from JIRA /myself when name is still the default placeholder
    const defaultName = getPresets().defaultProfile.name;
    if (
      input.jira &&
      isJiraConfigured(updatedJira) &&
      (!updatedProfile.name.trim() || updatedProfile.name.trim() === defaultName)
    ) {
      const check = await testJiraConnection(updatedJira);
      if (check.ok && check.user && check.user !== 'Connected') {
        db.prepare('UPDATE profile SET name = ? WHERE id = 1').run(check.user);
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to save settings.') };
  }
};
