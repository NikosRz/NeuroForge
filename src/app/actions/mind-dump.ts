'use server';

import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import { estimateMindDumpTimesWithOllama, getOllamaStatus } from '@/lib/ollama-client';
import type { AiConfigRow, StickyNoteRow } from '@/lib/types';

const VALID_QUICK_MINUTES = new Set<number>([5, 15, 30]);

const escapeLike = (raw: string): string =>
  raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export const getNotesAction = async (
  query?: string
): Promise<{ notes: StickyNoteRow[]; error?: string }> => {
  try {
    const q = query?.trim() ?? '';
    const db = getDb();
    const notes = q
      ? (db
          .prepare("SELECT * FROM sticky_notes WHERE content LIKE ? ESCAPE '\\' ORDER BY id DESC")
          .all(`%${escapeLike(q)}%`) as StickyNoteRow[])
      : (db.prepare('SELECT * FROM sticky_notes ORDER BY id DESC').all() as StickyNoteRow[]);

    return { notes };
  } catch (err) {
    return { notes: [], error: normalizeError(err, 'Failed to fetch mind-dump notes.') };
  }
};

export const addNoteAction = async (input: {
  content: string;
  estMinutes?: number;
}): Promise<{ note?: StickyNoteRow; error?: string }> => {
  try {
    const content = input.content.trim();
    if (!content) {
      return { error: 'Thought cannot be empty.' };
    }

    const estMinutes =
      typeof input.estMinutes === 'number' && Number.isFinite(input.estMinutes)
        ? Math.max(0, Math.round(input.estMinutes))
        : 0;

    const db = getDb();
    const info = db
      .prepare('INSERT INTO sticky_notes (content, est_minutes) VALUES (?, ?)')
      .run(content, estMinutes);

    const note = db
      .prepare('SELECT * FROM sticky_notes WHERE id = ?')
      .get(info.lastInsertRowid) as StickyNoteRow;

    return { note };
  } catch (err) {
    return { error: normalizeError(err, 'Failed to save thought.') };
  }
};

export const deleteNoteAction = async (
  id: number
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: 'Invalid note ID.' };
    }
    const db = getDb();
    const info = db.prepare('DELETE FROM sticky_notes WHERE id = ?').run(id);
    if (info.changes === 0) {
      return { ok: false, error: 'Note not found.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to delete note.') };
  }
};

export const estimateMindDumpTimesAction = async (): Promise<{
  notes: StickyNoteRow[];
  estimatedCount: number;
  error?: string;
}> => {
  try {
    const db = getDb();
    const allNotes = db
      .prepare('SELECT * FROM sticky_notes ORDER BY id ASC')
      .all() as StickyNoteRow[];

    if (allNotes.length === 0) {
      return {
        notes: [],
        estimatedCount: 0,
        error: 'Your Mind-Dump is empty! Capture a thought first.',
      };
    }

    const aiCfg = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
    const ollamaState = await getOllamaStatus(aiCfg.ollama_url, aiCfg.model);
    if (ollamaState.status === 'not_installed') {
      return {
        notes: allNotes,
        estimatedCount: 0,
        error: 'Ollama is not installed yet. Open Settings [⚙] → Local AI to install it first.',
      };
    }
    if (ollamaState.status === 'stopped') {
      return {
        notes: allNotes,
        estimatedCount: 0,
        error: 'Ollama is not running. Open Settings [⚙] → Local AI and click Start first.',
      };
    }
    if (!ollamaState.modelInstalled) {
      return {
        notes: allNotes,
        estimatedCount: 0,
        error: `Model "${aiCfg.model}" is not downloaded yet. Open Settings [⚙] → Local AI to pull it.`,
      };
    }

    const unestimated = allNotes.filter((n) => !n.est_minutes || n.est_minutes <= 0);
    const targetNotes = unestimated.length > 0 ? unestimated : allNotes;

    const result = await estimateMindDumpTimesWithOllama(aiCfg, targetNotes);
    if (result.error) {
      return { notes: allNotes, estimatedCount: 0, error: result.error };
    }

    const updateStmt = db.prepare('UPDATE sticky_notes SET est_minutes = ? WHERE id = ?');
    const applyEstimates = db.transaction(
      (rows: Array<{ noteId: number; minutes: 0 | 5 | 15 | 30 }>) => {
        for (const row of rows) {
          updateStmt.run(row.minutes, row.noteId);
        }
      }
    );
    applyEstimates(result.estimates);

    const updatedNotes = db
      .prepare('SELECT * FROM sticky_notes ORDER BY id DESC')
      .all() as StickyNoteRow[];
    const assignedNonZero = result.estimates.filter((e) => e.minutes > 0).length;

    return { notes: updatedNotes, estimatedCount: assignedNonZero };
  } catch (err) {
    return {
      notes: [],
      estimatedCount: 0,
      error: normalizeError(err, 'Failed to estimate Mind-Dump task times.'),
    };
  }
};

export interface QuickTaskLookupResult {
  mode: 'match' | 'unestimated' | 'empty';
  minutes: 5 | 15 | 30;
  notes: StickyNoteRow[];
  error?: string;
}

export const pickQuickTaskAction = async (
  minutes: 5 | 15 | 30
): Promise<QuickTaskLookupResult> => {
  try {
    if (!VALID_QUICK_MINUTES.has(minutes)) {
      return {
        mode: 'empty',
        minutes,
        notes: [],
        error: 'Duration must be 5, 15, or 30 minutes.',
      };
    }

    const db = getDb();
    const oldestMatch = db
      .prepare('SELECT * FROM sticky_notes WHERE est_minutes = ? ORDER BY id ASC LIMIT 1')
      .get(minutes) as StickyNoteRow | undefined;

    if (oldestMatch) {
      return { mode: 'match', minutes, notes: [oldestMatch] };
    }

    const unestimated = db
      .prepare(
        'SELECT * FROM sticky_notes WHERE est_minutes IS NULL OR est_minutes = 0 ORDER BY id ASC'
      )
      .all() as StickyNoteRow[];

    if (unestimated.length > 0) {
      return { mode: 'unestimated', minutes, notes: unestimated };
    }

    return { mode: 'empty', minutes, notes: [] };
  } catch (err) {
    return {
      mode: 'empty',
      minutes,
      notes: [],
      error: normalizeError(err, 'Failed to look up quick task.'),
    };
  }
};
