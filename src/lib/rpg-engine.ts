import type Database from 'better-sqlite3';
import { getPresets } from './presets';
import { getIsoWeekKey, parseLocalDate, parseRestDays, toLocalDateStr } from './shared';
import type { LevelInfo, ProfileRow, RpgStatsSnapshot, XpSourceType } from './types';

export { getIsoWeekKey };

export const calculateLevel = (totalXp: number): LevelInfo => {
  const { levelBaseXp, levelGrowthFactor } = getPresets();
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let threshold = Math.round(levelBaseXp);

  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(levelBaseXp * Math.pow(levelGrowthFactor, level - 1));
  }

  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: threshold,
  };
};

const isFatiguedProfile = (profile: ProfileRow, todayStr: string): boolean => {
  if (profile.potion_boost_date === todayStr) return false;
  return profile.stamina <= 0 || profile.consecutive_work_days >= 7;
};

const countMissedNonRestDays = (
  lastActiveDate: string | null,
  todayStr: string,
  restDays: number[]
): number => {
  if (!lastActiveDate) return 0;

  const cursor = parseLocalDate(lastActiveDate);
  cursor.setDate(cursor.getDate() + 1);
  const todayMidnight = parseLocalDate(todayStr);

  let missed = 0;
  while (cursor < todayMidnight) {
    if (!restDays.includes(cursor.getDay())) {
      missed += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return missed;
};

export const applyDailyResetIfNeeded = (
  db: Database.Database,
  now: Date = new Date()
): ProfileRow => {
  const { defaultProfile } = getPresets();
  const todayStr = toLocalDateStr(now);
  const currentWeek = getIsoWeekKey(now);
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow;
  const restDays = parseRestDays(profile.rest_days);

  let {
    stamina,
    streak_days,
    streak_shields,
    consecutive_work_days,
    weekly_xp,
    weekly_reset_at,
    last_reset_date,
  } = profile;

  let changed = false;

  if (last_reset_date !== todayStr) {
    changed = true;
    const missedNonRest = countMissedNonRestDays(profile.last_active_date, todayStr, restDays);

    if (missedNonRest > 0) {
      consecutive_work_days = 0;
      const shieldsUsed = Math.min(streak_shields, missedNonRest);
      streak_shields -= shieldsUsed;
      if (missedNonRest > shieldsUsed) {
        streak_days = 0;
      }
    }

    if (restDays.includes(now.getDay())) {
      stamina = defaultProfile.staminaMax;
      consecutive_work_days = 0;
    } else {
      stamina = Math.min(defaultProfile.staminaMax, stamina + defaultProfile.overnightRecovery);
    }

    last_reset_date = todayStr;
  }

  if (weekly_reset_at !== currentWeek) {
    changed = true;
    weekly_xp = 0;
    weekly_reset_at = currentWeek;
  }

  if (!changed) {
    return profile;
  }

  db.prepare(
    `UPDATE profile SET
      stamina = ?,
      streak_days = ?,
      streak_shields = ?,
      consecutive_work_days = ?,
      weekly_xp = ?,
      weekly_reset_at = ?,
      last_reset_date = ?
    WHERE id = 1`
  ).run(
    stamina,
    streak_days,
    streak_shields,
    consecutive_work_days,
    weekly_xp,
    weekly_reset_at,
    last_reset_date
  );

  return {
    ...profile,
    stamina,
    streak_days,
    streak_shields,
    consecutive_work_days,
    weekly_xp,
    weekly_reset_at,
    last_reset_date,
  };
};

export interface AwardXpInput {
  sourceType: XpSourceType;
  itemId?: string;
  jiraIssueKey?: string;
  baseXp: number;
  now?: Date;
}

export interface AwardXpResult {
  awardedXp: number;
  multiplier: number;
  leveledUp: boolean;
  newLevel: number;
  stamina: number;
  fatigued: boolean;
  duplicate: boolean;
}

export const awardXp = (db: Database.Database, input: AwardXpInput): AwardXpResult => {
  const now = input.now ?? new Date();
  const todayStr = toLocalDateStr(now);
  const { staminaCosts } = getPresets();

  const runTx = db.transaction((): AwardXpResult => {
    const profile = applyDailyResetIfNeeded(db, now);
    const oldLevel = calculateLevel(profile.total_xp).level;
    const fatigued = isFatiguedProfile(profile, todayStr);

    if (input.itemId) {
      const existing = db
        .prepare('SELECT id FROM xp_events WHERE source_type = ? AND item_id = ?')
        .get(input.sourceType, input.itemId);

      if (existing) {
        return {
          awardedXp: 0,
          multiplier: 1,
          leveledUp: false,
          newLevel: oldLevel,
          stamina: profile.stamina,
          fatigued,
          duplicate: true,
        };
      }
    }

    const multiplier = fatigued ? 0.5 : 1.0;
    const awardedXp = Math.max(1, Math.floor(input.baseXp * multiplier));
    const staminaCost = staminaCosts[input.sourceType] ?? 0;
    const newStamina = Math.max(0, profile.stamina - staminaCost);
    const newTotalXp = profile.total_xp + awardedXp;
    const newWeeklyXp = profile.weekly_xp + awardedXp;
    const newLevelInfo = calculateLevel(newTotalXp);

    const restDays = parseRestDays(profile.rest_days);
    const isNewActiveDay = profile.last_active_date !== todayStr;
    const streakDays = isNewActiveDay ? profile.streak_days + 1 : profile.streak_days;
    const consecutiveWorkDays =
      isNewActiveDay && !restDays.includes(now.getDay())
        ? profile.consecutive_work_days + 1
        : profile.consecutive_work_days;
    const lastActiveDate = isNewActiveDay ? todayStr : profile.last_active_date;

    const hitWeeklyGoal =
      profile.weekly_xp < profile.weekly_xp_goal && newWeeklyXp >= profile.weekly_xp_goal;
    const streakShields = hitWeeklyGoal
      ? Math.min(3, profile.streak_shields + 1)
      : profile.streak_shields;

    db.prepare(
      `INSERT INTO xp_events (source_type, item_id, jira_issue_key, awarded_xp, multiplier)
       VALUES (?, ?, ?, ?, ?)`
    ).run(input.sourceType, input.itemId ?? null, input.jiraIssueKey ?? null, awardedXp, multiplier);

    db.prepare(
      `UPDATE profile SET
        total_xp = ?,
        weekly_xp = ?,
        stamina = ?,
        streak_days = ?,
        streak_shields = ?,
        consecutive_work_days = ?,
        last_active_date = ?
      WHERE id = 1`
    ).run(
      newTotalXp,
      newWeeklyXp,
      newStamina,
      streakDays,
      streakShields,
      consecutiveWorkDays,
      lastActiveDate
    );

    return {
      awardedXp,
      multiplier,
      leveledUp: newLevelInfo.level > oldLevel,
      newLevel: newLevelInfo.level,
      stamina: newStamina,
      fatigued,
      duplicate: false,
    };
  });

  return runTx();
};

export const useWeeklyPotion = (
  db: Database.Database,
  now: Date = new Date()
): { success: boolean; reason?: string; stamina: number } => {
  const { defaultProfile } = getPresets();
  const currentWeek = getIsoWeekKey(now);
  const todayStr = toLocalDateStr(now);

  const runTx = db.transaction((): { success: boolean; reason?: string; stamina: number } => {
    const profile = applyDailyResetIfNeeded(db, now);

    if (profile.last_potion_week === currentWeek) {
      return {
        success: false,
        reason: 'Energy Core Boost already used this week (resets Monday).',
        stamina: profile.stamina,
      };
    }

    const maxStamina = defaultProfile.staminaMax;
    db.prepare(
      `UPDATE profile SET
        stamina = ?,
        last_potion_week = ?,
        potion_boost_date = ?
      WHERE id = 1`
    ).run(maxStamina, currentWeek, todayStr);

    return { success: true, stamina: maxStamina };
  });

  return runTx();
};

export const getRpgStats = (
  db: Database.Database,
  now: Date = new Date(),
  existingProfile?: ProfileRow
): RpgStatsSnapshot => {
  const { defaultProfile } = getPresets();
  const profile = existingProfile ?? applyDailyResetIfNeeded(db, now);
  const todayStr = toLocalDateStr(now);
  const currentWeek = getIsoWeekKey(now);
  const levelInfo = calculateLevel(profile.total_xp);

  const counts = db
    .prepare(
      `SELECT
        SUM(CASE WHEN source_type = 'quest_clear' THEN 1 ELSE 0 END) AS questsCleared,
        SUM(CASE WHEN source_type = 'focus_turn' THEN 1 ELSE 0 END) AS focusTurns
      FROM xp_events`
    )
    .get() as { questsCleared: number | null; focusTurns: number | null } | undefined;

  return {
    totalXp: profile.total_xp,
    weeklyXp: profile.weekly_xp,
    weeklyXpGoal: profile.weekly_xp_goal,
    level: levelInfo.level,
    currentLevelXp: levelInfo.currentLevelXp,
    nextLevelXp: levelInfo.nextLevelXp,
    stamina: profile.stamina,
    maxStamina: defaultProfile.staminaMax,
    fatigued: isFatiguedProfile(profile, todayStr),
    boostAvailable: profile.last_potion_week !== currentWeek,
    boostActiveToday: profile.potion_boost_date === todayStr,
    streakDays: profile.streak_days,
    streakShields: profile.streak_shields,
    questsCleared: counts?.questsCleared ?? 0,
    focusTurns: counts?.focusTurns ?? 0,
  };
};
