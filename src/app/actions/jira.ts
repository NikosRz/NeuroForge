'use server';

import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import {
  fetchJiraIssueDetail,
  fetchJiraIssues,
  fetchJiraIssueStatus,
  fetchJiraStatuses,
  testJiraConnection,
} from '@/lib/jira-client';
import { getOllamaStatus, splitQuestWithOllama } from '@/lib/ollama-client';
import { getPresets } from '@/lib/presets';
import { awardXp, type AwardXpResult } from '@/lib/rpg-engine';
import { parseCompletedStatuses, validateJiraBaseUrl } from '@/lib/shared';
import type {
  AiConfigRow,
  JiraAuthType,
  JiraConfigRow,
  JiraIssueSummary,
  JiraStatusOption,
  MicroStepRow,
  ProfileRow,
} from '@/lib/types';

export const getIssuesAction = async (opts?: {
  search?: string;
  status?: string;
  epic?: string;
}): Promise<{ issues: JiraIssueSummary[]; error?: string }> => {
  try {
    const db = getDb();
    const cfg = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    return await fetchJiraIssues(cfg, opts);
  } catch (err) {
    return { issues: [], error: normalizeError(err, 'Failed to fetch JIRA issues.') };
  }
};

export const getIssueDetailAction = async (issueKey: string) => {
  try {
    const key = issueKey.trim();
    if (!key) {
      return { error: 'Missing issue key.' };
    }
    const db = getDb();
    const cfg = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    return await fetchJiraIssueDetail(cfg, key);
  } catch (err) {
    return { error: normalizeError(err, 'Failed to load JIRA issue details.') };
  }
};

export const getJiraStatusesAction = async (override?: {
  baseUrl?: string;
  authType?: JiraAuthType;
  email?: string;
  token?: string;
  jqlScope?: string;
}): Promise<{ statuses: JiraStatusOption[]; error?: string }> => {
  try {
    if (override?.baseUrl?.trim()) {
      const check = validateJiraBaseUrl(override.baseUrl);
      if (!check.valid) {
        return { statuses: [], error: check.error };
      }
    }

    const db = getDb();
    const saved = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    const cfg: JiraConfigRow = {
      ...saved,
      base_url: override?.baseUrl?.trim() || saved.base_url,
      auth_type: override?.authType ?? saved.auth_type,
      email: override?.email !== undefined ? override.email.trim() : saved.email,
      token: override?.token?.trim() || saved.token,
      jql_scope: override?.jqlScope !== undefined ? override.jqlScope.trim() : saved.jql_scope,
    };

    return await fetchJiraStatuses(cfg);
  } catch (err) {
    return { statuses: [], error: normalizeError(err, 'Failed to fetch JIRA statuses.') };
  }
};

export const pinQuestAction = async (input: {
  key: string;
  summary: string;
  status: string;
  url: string;
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    const key = input.key.trim();
    if (!key) return { ok: false, error: 'Issue key is required.' };

    const db = getDb();
    db.prepare(
      `UPDATE profile SET
        active_quest_key = ?,
        active_quest_summary = ?,
        active_quest_status = ?,
        active_quest_url = ?
      WHERE id = 1`
    ).run(key, input.summary.trim() || key, input.status.trim() || 'To Do', input.url.trim());

    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to pin quest.') };
  }
};

export const checkBossCompletionAction = async (
  issueKey: string
): Promise<{
  ok: boolean;
  completed: boolean;
  currentStatus?: string;
  xpResult?: AwardXpResult;
  nextQuestKey?: string | null;
  error?: string;
}> => {
  try {
    const key = issueKey.trim();
    if (!key) {
      return { ok: false, completed: false, error: 'Issue key is required.' };
    }

    const db = getDb();
    const cfg = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    const live = await fetchJiraIssueStatus(cfg, key);
    if (live.error || !live.status) {
      return { ok: false, completed: false, error: live.error ?? 'Could not check JIRA status.' };
    }

    const configuredCompleted = parseCompletedStatuses(cfg.completed_statuses);
    const isCompleted =
      configuredCompleted.length > 0
        ? configuredCompleted.some((s) => s.toLowerCase() === live.status?.toLowerCase())
        : live.statusCategory === 'done';

    if (!isCompleted) {
      db.prepare(
        'UPDATE profile SET active_quest_status = ? WHERE id = 1 AND active_quest_key = ?'
      ).run(live.status, key);
      return { ok: true, completed: false, currentStatus: live.status };
    }

    const presets = getPresets();
    const xpResult = awardXp(db, {
      sourceType: 'quest_clear',
      itemId: key,
      jiraIssueKey: key,
      baseXp: presets.xpAwards.quest_clear_base,
    });

    const nextList = await fetchJiraIssues(cfg);
    const completedSet = new Set(configuredCompleted.map((s) => s.toLowerCase()));
    const nextIssue = nextList.error
      ? null
      : (nextList.issues.find(
          (i) => i.key !== key && !completedSet.has(i.status.toLowerCase())
        ) ?? null);

    if (nextIssue) {
      db.prepare(
        `UPDATE profile SET
          active_quest_key = ?,
          active_quest_summary = ?,
          active_quest_status = ?,
          active_quest_url = ?
        WHERE id = 1`
      ).run(nextIssue.key, nextIssue.summary, nextIssue.status, nextIssue.url);
    } else {
      db.prepare(
        `UPDATE profile SET
          active_quest_key = NULL,
          active_quest_summary = NULL,
          active_quest_status = NULL,
          active_quest_url = NULL
        WHERE id = 1`
      ).run();
    }

    return {
      ok: true,
      completed: true,
      currentStatus: live.status,
      xpResult,
      nextQuestKey: nextIssue?.key ?? null,
    };
  } catch (err) {
    return { ok: false, completed: false, error: normalizeError(err, 'Failed to check JIRA status.') };
  }
};

export const testJiraAction = async (input?: {
  baseUrl?: string;
  authType?: JiraAuthType;
  email?: string;
  token?: string;
}): Promise<{ ok: boolean; user?: string; error?: string }> => {
  try {
    if (input?.baseUrl?.trim()) {
      const check = validateJiraBaseUrl(input.baseUrl);
      if (!check.valid) {
        return { ok: false, error: check.error };
      }
    }

    const db = getDb();
    const saved = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    const cfg: JiraConfigRow = {
      ...saved,
      base_url: input?.baseUrl?.trim() || saved.base_url,
      auth_type: input?.authType ?? saved.auth_type,
      email: input?.email !== undefined ? input.email.trim() : saved.email,
      token: input?.token?.trim() || saved.token,
    };

    const res = await testJiraConnection(cfg);
    if (res.ok && res.user && res.user !== 'Connected') {
      const profile = db.prepare('SELECT name FROM profile WHERE id = 1').get() as Pick<
        ProfileRow,
        'name'
      >;
      const defaultName = getPresets().defaultProfile.name;
      if (!profile.name.trim() || profile.name.trim() === defaultName) {
        db.prepare('UPDATE profile SET name = ? WHERE id = 1').run(res.user);
      }
    }

    return res;
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'JIRA connection test failed.') };
  }
};

export const addMicroStepAction = async (input: {
  jiraIssueKey: string;
  title: string;
}): Promise<{ step?: MicroStepRow; error?: string }> => {
  try {
    const jiraIssueKey = input.jiraIssueKey.trim();
    const title = input.title.trim();
    if (!jiraIssueKey || !title) {
      return { error: 'Issue key and step title are required.' };
    }

    const db = getDb();
    const maxRow = db
      .prepare(
        'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM micro_steps WHERE jira_issue_key = ?'
      )
      .get(jiraIssueKey) as { maxOrder: number };

    const info = db
      .prepare('INSERT INTO micro_steps (jira_issue_key, title, done, sort_order) VALUES (?, ?, 0, ?)')
      .run(jiraIssueKey, title, maxRow.maxOrder + 1);

    const step = db
      .prepare('SELECT * FROM micro_steps WHERE id = ?')
      .get(info.lastInsertRowid) as MicroStepRow;

    return { step };
  } catch (err) {
    return { error: normalizeError(err, 'Failed to add micro-step.') };
  }
};

export const toggleMicroStepAction = async (input: {
  id: number;
  done: boolean;
}): Promise<{ step?: MicroStepRow; xpResult?: AwardXpResult | null; error?: string }> => {
  try {
    if (!Number.isInteger(input.id) || input.id <= 0) {
      return { error: 'Valid micro-step id is required.' };
    }

    const db = getDb();
    const runTx = db.transaction(
      (): { step?: MicroStepRow; xpResult?: AwardXpResult | null; error?: string } => {
        const existing = db.prepare('SELECT * FROM micro_steps WHERE id = ?').get(input.id) as
          | MicroStepRow
          | undefined;
        if (!existing) {
          return { error: 'Micro-step not found.' };
        }

        const doneVal = input.done ? 1 : 0;
        db.prepare('UPDATE micro_steps SET done = ? WHERE id = ?').run(doneVal, input.id);

        let xpResult: AwardXpResult | null = null;
        if (doneVal === 1) {
          const presets = getPresets();
          xpResult = awardXp(db, {
            sourceType: 'micro_step',
            itemId: String(input.id),
            jiraIssueKey: existing.jira_issue_key,
            baseXp: presets.xpAwards.micro_step,
          });
        }

        const updated = db
          .prepare('SELECT * FROM micro_steps WHERE id = ?')
          .get(input.id) as MicroStepRow;
        return { step: updated, xpResult };
      }
    );

    return runTx();
  } catch (err) {
    return { error: normalizeError(err, 'Failed to update micro-step.') };
  }
};

export const deleteMicroStepAction = async (
  id: number
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: 'Valid micro-step id is required.' };
    }
    const db = getDb();
    const info = db.prepare('DELETE FROM micro_steps WHERE id = ?').run(id);
    if (info.changes === 0) {
      return { ok: false, error: 'Micro-step not found.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to delete micro-step.') };
  }
};

export const splitQuestAction = async (input: {
  jiraIssueKey: string;
  summary: string;
  description?: string;
}): Promise<{ steps: MicroStepRow[]; error?: string }> => {
  try {
    const jiraIssueKey = input.jiraIssueKey.trim();
    const summary = input.summary.trim();
    if (!jiraIssueKey || !summary) {
      return { steps: [], error: 'Issue key and summary are required.' };
    }

    const db = getDb();
    const aiCfg = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
    const ollamaState = await getOllamaStatus(aiCfg.ollama_url, aiCfg.model);
    if (ollamaState.status === 'not_installed') {
      return {
        steps: [],
        error: 'Ollama is not installed yet. Open Settings [⚙] → Local AI to install it first.',
      };
    }
    if (ollamaState.status === 'stopped') {
      return {
        steps: [],
        error: 'Ollama is not running. Open Settings [⚙] → Local AI and click Start first.',
      };
    }
    if (!ollamaState.modelInstalled) {
      return {
        steps: [],
        error: `Local AI model "${aiCfg.model}" is not downloaded yet. Open Settings [⚙] → Local AI to download it first.`,
      };
    }

    const split = await splitQuestWithOllama(aiCfg, summary, input.description);
    if (split.error || split.steps.length === 0) {
      return { steps: [], error: split.error ?? 'Local AI could not split this quest.' };
    }

    const maxRow = db
      .prepare(
        'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM micro_steps WHERE jira_issue_key = ?'
      )
      .get(jiraIssueKey) as { maxOrder: number };

    const insertStmt = db.prepare(
      'INSERT INTO micro_steps (jira_issue_key, title, done, sort_order) VALUES (?, ?, 0, ?)'
    );

    const steps = db.transaction((titles: string[]): MicroStepRow[] =>
      titles.map((title, idx) => {
        const info = insertStmt.run(jiraIssueKey, title, maxRow.maxOrder + 1 + idx);
        return db
          .prepare('SELECT * FROM micro_steps WHERE id = ?')
          .get(info.lastInsertRowid) as MicroStepRow;
      })
    )(split.steps);

    return { steps };
  } catch (err) {
    return { steps: [], error: normalizeError(err, 'Failed to split quest.') };
  }
};
