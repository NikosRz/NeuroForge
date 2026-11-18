import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getPresets } from './presets';
import { getIsoWeekKey, toLocalDateStr } from './shared';

interface DbSingleton {
  db: Database.Database;
  dbPath: string;
}

const globalForDb = globalThis as typeof globalThis & {
  __neuroforgeDb?: DbSingleton | null;
};

export const initSchema = (db: Database.Database): void => {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      total_xp INTEGER NOT NULL DEFAULT 0,
      weekly_xp INTEGER NOT NULL DEFAULT 0,
      weekly_xp_goal INTEGER NOT NULL DEFAULT 600,
      weekly_reset_at TEXT NOT NULL,
      stamina INTEGER NOT NULL DEFAULT 100,
      rest_days TEXT NOT NULL DEFAULT '[0,6]',
      streak_days INTEGER NOT NULL DEFAULT 0,
      streak_shields INTEGER NOT NULL DEFAULT 1,
      consecutive_work_days INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT,
      last_reset_date TEXT NOT NULL,
      last_potion_week TEXT,
      potion_boost_date TEXT,
      muted INTEGER NOT NULL DEFAULT 0,
      active_quest_key TEXT,
      active_quest_summary TEXT,
      active_quest_status TEXT,
      active_quest_url TEXT
    );

    CREATE TABLE IF NOT EXISTS jira_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT NOT NULL DEFAULT '',
      auth_type TEXT NOT NULL DEFAULT 'cloud',
      email TEXT NOT NULL DEFAULT '',
      token TEXT NOT NULL DEFAULT '',
      jql_scope TEXT NOT NULL DEFAULT '',
      assignee_filter TEXT NOT NULL DEFAULT 'me_and_unassigned',
      roadmap_mode TEXT NOT NULL DEFAULT 'off',
      ics_urls TEXT NOT NULL DEFAULT '',
      completed_statuses TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      model TEXT NOT NULL DEFAULT 'qwen2.5:3b',
      keep_alive TEXT NOT NULL DEFAULT '30s',
      ollama_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:11434'
    );

    CREATE TABLE IF NOT EXISTS micro_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jira_issue_key TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_micro_steps_issue ON micro_steps (jira_issue_key, sort_order);

    CREATE TABLE IF NOT EXISTS roadmap_steps (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      subtitle TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sticky_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      est_minutes INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      item_id TEXT,
      jira_issue_key TEXT,
      awarded_xp INTEGER NOT NULL,
      multiplier REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_type, item_id)
    );
  `);

  // Idempotent migration for existing databases created before completed_statuses existed
  const jiraCols = db.prepare('PRAGMA table_info(jira_config)').all() as Array<{ name: string }>;
  if (!jiraCols.some((c) => c.name === 'completed_statuses')) {
    db.exec(`ALTER TABLE jira_config ADD COLUMN completed_statuses TEXT NOT NULL DEFAULT '[]'`);
  }

  const presets = getPresets();
  const now = new Date();
  const today = toLocalDateStr(now);
  const weekKey = getIsoWeekKey(now);

  db.prepare(
    `INSERT OR IGNORE INTO profile (
      id, name, total_xp, weekly_xp, weekly_xp_goal, weekly_reset_at,
      stamina, rest_days, streak_days, streak_shields, consecutive_work_days,
      last_reset_date, muted
    ) VALUES (1, ?, 0, 0, ?, ?, ?, ?, 0, 1, 0, ?, 0)`
  ).run(
    presets.defaultProfile.name,
    presets.defaultProfile.weeklyXpGoal,
    weekKey,
    presets.defaultProfile.staminaMax,
    JSON.stringify(presets.defaultProfile.restDays),
    today
  );

  db.prepare(`INSERT OR IGNORE INTO jira_config (id) VALUES (1)`).run();
  db.prepare(`INSERT OR IGNORE INTO ai_config (id) VALUES (1)`).run();
};

export const getDb = (dbPath?: string): Database.Database => {
  const resolved =
    dbPath ||
    process.env.NEUROFORGE_DB_PATH ||
    path.join(process.cwd(), 'data', 'neuroforge.db');

  const existing = globalForDb.__neuroforgeDb;
  if (existing && existing.dbPath === resolved && existing.db.open) {
    return existing.db;
  }

  if (existing && existing.db.open) {
    try {
      existing.db.close();
    } catch {
      // Ignore close errors on stale handle.
    }
    globalForDb.__neuroforgeDb = null;
  }

  if (resolved !== ':memory:') {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  const db = new Database(resolved);
  initSchema(db);
  globalForDb.__neuroforgeDb = { db, dbPath: resolved };
  return db;
};
