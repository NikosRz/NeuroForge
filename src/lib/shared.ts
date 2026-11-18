import type { JiraConfigRow } from './types';

export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';

export const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const getIsoWeekKey = (date: Date): string => {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const parseRestDays = (raw: string): number[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [0, 6];
    return Array.from(
      new Set(
        parsed.filter(
          (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6
        )
      )
    ).sort((a, b) => a - b);
  } catch {
    return [0, 6];
  }
};

export const parseCompletedStatuses = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    for (const item of parsed) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) unique.add(trimmed);
      }
    }
    return Array.from(unique);
  } catch {
    return [];
  }
};

export const isValidHttpUrl = (raw: string): boolean => {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateJiraBaseUrl = (raw: string): { valid: boolean; error?: string } => {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'JIRA Base URL must be a valid http:// or https:// URL (e.g. https://your-org.atlassian.net).',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'JIRA Base URL must start with http:// or https://.',
    };
  }

  if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
    return {
      valid: false,
      error: 'Use only the root JIRA domain without board or project sub-paths (e.g. https://your-org.atlassian.net).',
    };
  }

  return { valid: true };
};

export const isJiraConfigured = (
  cfg: Pick<JiraConfigRow, 'base_url' | 'token' | 'auth_type' | 'email'>
): boolean =>
  Boolean(
    cfg.base_url.trim() &&
      cfg.token.trim() &&
      (cfg.auth_type === 'server' || cfg.email.trim())
  );
