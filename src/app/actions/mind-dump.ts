'use server';

import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import { pickQuickTaskWithOllama } from '@/lib/ollama-client';
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
        ? Math.max(1, Math.round(input.estMinutes))
        : null;

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

export const pickQuickTaskAction = async (
  minutes: 5 | 15 | 30
): Promise<{ noteId?: number; text?: string; reason?: string; error?: string }> => {
  try {
    if (!VALID_QUICK_MINUTES.has(minutes)) {
      return { error: 'Duration must be 5, 15, or 30 minutes.' };
    }
    const db = getDb();
    const notes = db.prepare('SELECT * FROM sticky_notes ORDER BY id DESC').all() as StickyNoteRow[];
    const aiCfg = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
    return await pickQuickTaskWithOllama(aiCfg, minutes, notes);
  } catch (err) {
    return { error: normalizeError(err, 'Failed to match quick task.') };
  }
};
