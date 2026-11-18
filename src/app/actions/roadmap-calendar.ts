'use server';

import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import { fetchTodayCalendarEvents } from '@/lib/ics-client';
import { fetchJiraRoadmap } from '@/lib/jira-client';
import type { CalendarEvent, JiraConfigRow, RoadmapMode, RoadmapStepRow } from '@/lib/types';

const VALID_ROADMAP_MODES = new Set<RoadmapMode>(['off', 'json', 'jira_sync']);
const VALID_STEP_STATUSES = new Set<RoadmapStepRow['status']>(['done', 'current', 'locked']);

export const getRoadmapAction = async (): Promise<{
  mode: RoadmapMode;
  steps: RoadmapStepRow[];
  error?: string;
}> => {
  try {
    const db = getDb();
    const cfg = db.prepare('SELECT * FROM jira_config WHERE id = 1').get() as JiraConfigRow;
    const mode = (cfg.roadmap_mode || 'off') as RoadmapMode;

    if (mode === 'off') return { mode, steps: [] };
    if (mode === 'jira_sync') {
      const synced = await fetchJiraRoadmap(cfg);
      return { mode, steps: synced.steps, error: synced.error };
    }

    const steps = db
      .prepare('SELECT * FROM roadmap_steps ORDER BY sort_order ASC')
      .all() as RoadmapStepRow[];
    return { mode, steps };
  } catch (err) {
    return { mode: 'off', steps: [], error: normalizeError(err, 'Failed to load roadmap.') };
  }
};

export const saveRoadmapAction = async (input: {
  mode?: RoadmapMode;
  steps?: Array<{
    id?: string;
    title: string;
    status?: 'done' | 'current' | 'locked';
    subtitle?: string;
  }>;
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (input.mode !== undefined && !VALID_ROADMAP_MODES.has(input.mode)) {
      return { ok: false, error: 'Invalid roadmap mode.' };
    }

    const db = getDb();

    let normalized: RoadmapStepRow[] | null = null;
    if (Array.isArray(input.steps)) {
      const usedIds = new Set<string>();
      normalized = [];

      for (let idx = 0; idx < input.steps.length; idx += 1) {
        const item = input.steps[idx];
        if (!item || typeof item !== 'object') continue;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!title) continue;

        const baseId =
          typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `step-${idx + 1}`;
        let uniqueId = baseId;
        let suffix = 2;
        while (usedIds.has(uniqueId)) {
          uniqueId = `${baseId}-${suffix}`;
          suffix += 1;
        }
        usedIds.add(uniqueId);

        const status: RoadmapStepRow['status'] =
          item.status && VALID_STEP_STATUSES.has(item.status) ? item.status : 'locked';

        normalized.push({
          id: uniqueId,
          title,
          status,
          subtitle:
            typeof item.subtitle === 'string' && item.subtitle.trim()
              ? item.subtitle.trim()
              : undefined,
          sort_order: normalized.length,
        });
      }
    }

    db.transaction(() => {
      if (input.mode) {
        db.prepare('UPDATE jira_config SET roadmap_mode = ? WHERE id = 1').run(input.mode);
      }

      if (normalized) {
        db.prepare('DELETE FROM roadmap_steps').run();
        const stmt = db.prepare(
          'INSERT INTO roadmap_steps (id, title, status, subtitle, sort_order) VALUES (?, ?, ?, ?, ?)'
        );
        for (const r of normalized) {
          stmt.run(r.id, r.title, r.status, r.subtitle ?? null, r.sort_order);
        }
        if (!input.mode) {
          db.prepare("UPDATE jira_config SET roadmap_mode = 'json' WHERE id = 1").run();
        }
      }
    })();

    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to save roadmap.') };
  }
};

export const getCalendarEventsAction = async (): Promise<{
  events: CalendarEvent[];
  nextEvent: CalendarEvent | null;
  errors: string[];
}> => {
  try {
    const db = getDb();
    const cfg = db.prepare('SELECT ics_urls FROM jira_config WHERE id = 1').get() as Pick<
      JiraConfigRow,
      'ics_urls'
    >;
    return await fetchTodayCalendarEvents(cfg.ics_urls);
  } catch (err) {
    return {
      events: [],
      nextEvent: null,
      errors: [normalizeError(err, 'Failed to fetch calendar events.')],
    };
  }
};
