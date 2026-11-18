import { normalizeError } from './errors';
import { isJiraConfigured } from './shared';
import type { JiraConfigRow, JiraIssueSummary, JiraStatusOption, RoadmapStepRow } from './types';

const REQUEST_TIMEOUT_MS = 10_000;
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/i;

interface JiraRawIssue {
  key?: unknown;
  fields?: {
    summary?: unknown;
    status?: {
      name?: unknown;
      statusCategory?: { key?: unknown };
    };
    priority?: { name?: unknown };
    parent?: {
      key?: unknown;
      fields?: { summary?: unknown };
    };
    subtasks?: Array<{
      key?: unknown;
      fields?: {
        summary?: unknown;
        status?: { statusCategory?: { key?: unknown } };
      };
    }>;
    customfield_10016?: unknown;
  };
}

interface JiraRawStatus {
  id?: unknown;
  name?: unknown;
  statusCategory?: { key?: unknown };
}

interface JiraRawProjectIssueTypeStatuses {
  statuses?: JiraRawStatus[];
}

const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/+$/, '');

const getApiPrefix = (cfg: JiraConfigRow): string =>
  cfg.auth_type === 'cloud' ? '/rest/api/3' : '/rest/api/2';

const buildAuthHeader = (cfg: JiraConfigRow): string => {
  if (cfg.auth_type === 'cloud') {
    const encoded = Buffer.from(`${cfg.email.trim()}:${cfg.token.trim()}`).toString('base64');
    return `Basic ${encoded}`;
  }
  return `Bearer ${cfg.token.trim()}`;
};

const escapeJqlString = (raw: string): string =>
  raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const extractSingleProjectKey = (jqlScope: string): string | null => {
  const matches = Array.from(jqlScope.matchAll(/\bproject\s*=\s*"?([A-Z][A-Z0-9_]+)"?/gi));
  if (matches.length !== 1) return null;
  if (/\bproject\s+in\b/i.test(jqlScope)) return null;
  return matches[0][1] ?? null;
};

const jiraFetch = async <T>(
  cfg: JiraConfigRow,
  path: string,
  init?: RequestInit
): Promise<{ data?: T; status?: number; error?: string }> => {
  if (!isJiraConfigured(cfg)) {
    return { error: 'JIRA is not configured yet. Open Settings [⚙] to connect.' };
  }

  const url = `${normalizeBaseUrl(cfg.base_url)}${getApiPrefix(cfg)}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: buildAuthHeader(cfg),
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          status: res.status,
          error: `JIRA authentication failed (${res.status}). Check your token or email.`,
        };
      }
      return { status: res.status, error: `JIRA request failed with HTTP ${res.status}.` };
    }

    if (res.status === 204) {
      return { data: undefined, status: 204 };
    }

    const data = (await res.json()) as T;
    return { data, status: res.status };
  } catch (err) {
    return { error: normalizeError(err, 'Could not reach JIRA') };
  }
};

const mapStatusCategory = (raw: unknown): 'new' | 'indeterminate' | 'done' => {
  if (raw === 'done') return 'done';
  if (raw === 'indeterminate') return 'indeterminate';
  return 'new';
};

const mapIssueSummary = (baseUrl: string, raw: JiraRawIssue): JiraIssueSummary | null => {
  const key = typeof raw.key === 'string' ? raw.key : null;
  if (!key) return null;

  const fields = raw.fields ?? {};
  const summary = typeof fields.summary === 'string' ? fields.summary : key;
  const statusName = typeof fields.status?.name === 'string' ? fields.status.name : 'To Do';
  const statusCategory = mapStatusCategory(fields.status?.statusCategory?.key);
  const priority = typeof fields.priority?.name === 'string' ? fields.priority.name : 'Medium';
  const storyPoints =
    typeof fields.customfield_10016 === 'number' ? fields.customfield_10016 : null;
  const epicKey = typeof fields.parent?.key === 'string' ? fields.parent.key : null;
  const epicName =
    typeof fields.parent?.fields?.summary === 'string' ? fields.parent.fields.summary : null;

  const isQuickWin =
    (storyPoints !== null && storyPoints <= 1) ||
    priority.toLowerCase() === 'low' ||
    priority.toLowerCase() === 'lowest';

  return {
    key,
    summary,
    status: statusName,
    statusCategory,
    priority,
    epicKey,
    epicName,
    storyPoints,
    url: `${normalizeBaseUrl(baseUrl)}/browse/${encodeURIComponent(key)}`,
    isQuickWin,
  };
};

const buildJql = (
  cfg: JiraConfigRow,
  opts?: { search?: string; status?: string; epic?: string }
): string => {
  const clauses: string[] = [];

  if (cfg.jql_scope.trim()) {
    clauses.push(`(${cfg.jql_scope.trim()})`);
  }

  if (cfg.assignee_filter === 'me_and_unassigned') {
    clauses.push('(assignee = currentUser() OR assignee IS EMPTY)');
  } else if (cfg.assignee_filter === 'me_only') {
    clauses.push('assignee = currentUser()');
  }

  if (opts?.status?.trim()) {
    const safeStatus = escapeJqlString(opts.status.trim());
    clauses.push(`status = "${safeStatus}"`);
  } else {
    clauses.push('statusCategory != Done');
  }

  if (opts?.epic?.trim()) {
    const safeEpic = escapeJqlString(opts.epic.trim());
    clauses.push(`parent = "${safeEpic}"`);
  }

  if (opts?.search?.trim()) {
    const trimmed = opts.search.trim();
    const safeSearch = escapeJqlString(trimmed);
    if (ISSUE_KEY_RE.test(trimmed)) {
      clauses.push(`(summary ~ "${safeSearch}" OR key = "${safeSearch}")`);
    } else {
      clauses.push(`summary ~ "${safeSearch}"`);
    }
  }

  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
};

const normalizeStatusList = (rawStatuses: JiraRawStatus[]): JiraStatusOption[] => {
  const byName = new Map<string, JiraStatusOption>();
  for (const raw of rawStatuses) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name || byName.has(name.toLowerCase())) continue;
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : name;
    byName.set(name.toLowerCase(), {
      id,
      name,
      categoryKey: mapStatusCategory(raw.statusCategory?.key),
    });
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const testJiraConnection = async (
  cfg: JiraConfigRow
): Promise<{ ok: boolean; user?: string; error?: string }> => {
  const res = await jiraFetch<{ displayName?: unknown; name?: unknown }>(cfg, '/myself');
  if (res.error) return { ok: false, error: res.error };

  const user =
    (typeof res.data?.displayName === 'string' && res.data.displayName.trim()) ||
    (typeof res.data?.name === 'string' && res.data.name.trim()) ||
    'Connected';

  return { ok: true, user };
};

export const fetchJiraStatuses = async (
  cfg: JiraConfigRow
): Promise<{ statuses: JiraStatusOption[]; error?: string }> => {
  const projectKey = extractSingleProjectKey(cfg.jql_scope);
  if (projectKey) {
    const projRes = await jiraFetch<JiraRawProjectIssueTypeStatuses[]>(
      cfg,
      `/project/${encodeURIComponent(projectKey)}/statuses`
    );
    if (!projRes.error && Array.isArray(projRes.data)) {
      const flattened = projRes.data.flatMap((issueType) =>
        Array.isArray(issueType.statuses) ? issueType.statuses : []
      );
      const statuses = normalizeStatusList(flattened);
      if (statuses.length > 0) {
        return { statuses };
      }
    }
  }

  const globalRes = await jiraFetch<JiraRawStatus[]>(cfg, '/status');
  if (globalRes.error) {
    return { statuses: [], error: globalRes.error };
  }
  const rawList = Array.isArray(globalRes.data) ? globalRes.data : [];
  return { statuses: normalizeStatusList(rawList) };
};

export const fetchJiraIssueStatus = async (
  cfg: JiraConfigRow,
  issueKey: string
): Promise<{
  status?: string;
  statusCategory?: 'new' | 'indeterminate' | 'done';
  error?: string;
}> => {
  const res = await jiraFetch<JiraRawIssue>(
    cfg,
    `/issue/${encodeURIComponent(issueKey)}?fields=status`
  );
  if (res.error || !res.data) {
    return { error: res.error ?? 'Could not fetch live issue status.' };
  }
  const statusName =
    typeof res.data.fields?.status?.name === 'string' ? res.data.fields.status.name.trim() : '';
  if (!statusName) {
    return { error: 'JIRA returned an unknown issue status.' };
  }
  return {
    status: statusName,
    statusCategory: mapStatusCategory(res.data.fields?.status?.statusCategory?.key),
  };
};

export const fetchJiraIssues = async (
  cfg: JiraConfigRow,
  opts?: { search?: string; status?: string; epic?: string }
): Promise<{ issues: JiraIssueSummary[]; error?: string }> => {
  const jql = buildJql(cfg, opts);
  const fields = 'summary,status,priority,parent,customfield_10016';
  const params = new URLSearchParams({ jql, fields, maxResults: '40' });

  const searchPath =
    cfg.auth_type === 'cloud'
      ? `/search/jql?${params.toString()}`
      : `/search?${params.toString()}`;

  const res = await jiraFetch<{ issues?: JiraRawIssue[] }>(cfg, searchPath);
  if (res.error) return { issues: [], error: res.error };

  const rawList = Array.isArray(res.data?.issues) ? res.data.issues : [];
  const issues = rawList
    .map((item) => mapIssueSummary(cfg.base_url, item))
    .filter((item): item is JiraIssueSummary => item !== null);

  return { issues };
};

export const fetchJiraIssueDetail = async (
  cfg: JiraConfigRow,
  issueKey: string
): Promise<{
  issue?: JiraIssueSummary & {
    subtasks: Array<{ key: string; summary: string; done: boolean }>;
  };
  error?: string;
}> => {
  const safeKey = encodeURIComponent(issueKey);
  const issueRes = await jiraFetch<JiraRawIssue>(
    cfg,
    `/issue/${safeKey}?fields=summary,status,priority,parent,subtasks,customfield_10016`
  );

  if (issueRes.error || !issueRes.data) {
    return { error: issueRes.error ?? 'Issue not found.' };
  }

  const baseSummary = mapIssueSummary(cfg.base_url, issueRes.data);
  if (!baseSummary) {
    return { error: 'Malformed JIRA issue response.' };
  }

  const rawSubtasks = Array.isArray(issueRes.data.fields?.subtasks)
    ? issueRes.data.fields.subtasks
    : [];

  const subtasks = rawSubtasks
    .map((st) => {
      const key = typeof st.key === 'string' ? st.key : null;
      if (!key) return null;
      return {
        key,
        summary: typeof st.fields?.summary === 'string' ? st.fields.summary : key,
        done: st.fields?.status?.statusCategory?.key === 'done',
      };
    })
    .filter((st): st is { key: string; summary: string; done: boolean } => st !== null);

  return {
    issue: { ...baseSummary, subtasks },
  };
};

export const fetchJiraRoadmap = async (
  cfg: JiraConfigRow
): Promise<{ steps: RoadmapStepRow[]; error?: string }> => {
  const scopeClause = cfg.jql_scope.trim() ? `(${cfg.jql_scope.trim()}) AND ` : '';
  const jql = `${scopeClause}issuetype = Epic ORDER BY created ASC`;
  const params = new URLSearchParams({ jql, fields: 'summary,status', maxResults: '25' });
  const searchPath =
    cfg.auth_type === 'cloud'
      ? `/search/jql?${params.toString()}`
      : `/search?${params.toString()}`;

  const res = await jiraFetch<{ issues?: JiraRawIssue[] }>(cfg, searchPath);
  if (res.error) return { steps: [], error: res.error };

  const rawList = Array.isArray(res.data?.issues) ? res.data.issues : [];
  let foundCurrent = false;

  const steps: RoadmapStepRow[] = rawList
    .map((raw, idx): RoadmapStepRow | null => {
      const key = typeof raw.key === 'string' ? raw.key : null;
      if (!key) return null;
      const cat = mapStatusCategory(raw.fields?.status?.statusCategory?.key);
      let status: RoadmapStepRow['status'] = 'locked';
      if (cat === 'done') {
        status = 'done';
      } else if (!foundCurrent && cat === 'indeterminate') {
        status = 'current';
        foundCurrent = true;
      }
      return {
        id: key,
        title: typeof raw.fields?.summary === 'string' ? raw.fields.summary : key,
        subtitle: key,
        status,
        sort_order: idx,
      };
    })
    .filter((s): s is RoadmapStepRow => s !== null);

  if (!foundCurrent) {
    const firstNonDone = steps.find((s) => s.status !== 'done');
    if (firstNonDone) firstNonDone.status = 'current';
  }

  return { steps };
};
