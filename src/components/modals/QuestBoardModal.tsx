'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, Search, Settings, Zap } from 'lucide-react';
import { getIssuesAction, pinQuestAction } from '@/app/actions/jira';
import { arcadeAudio } from '@/lib/arcadeAudio';
import type { JiraIssueSummary } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface QuestBoardModalProps {
  jiraConfigured: boolean;
  activeQuestKey: string | null;
  onClose: () => void;
  onOpenSettings: () => void;
  onRefresh: () => Promise<void>;
}

const SEARCH_DEBOUNCE_MS = 300;

export const QuestBoardModal: React.FC<QuestBoardModalProps> = ({
  jiraConfigured,
  activeQuestKey,
  onClose,
  onOpenSettings,
  onRefresh,
}) => {
  const [issues, setIssues] = useState<JiraIssueSummary[]>([]);
  const [knownStatuses, setKnownStatuses] = useState<string[]>([]);
  const [knownEpics, setKnownEpics] = useState<Array<[string, string]>>([]);
  const [loading, setLoading] = useState<boolean>(jiraConfigured);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [quickWinsOnly, setQuickWinsOnly] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [epicFilter, setEpicFilter] = useState<string>('');

  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!jiraConfigured) return;
    const reqId = requestIdRef.current + 1;
    requestIdRef.current = reqId;
    setLoading(true);
    setError(null);

    void (async () => {
      const res = await getIssuesAction({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        epic: epicFilter || undefined,
      });
      if (requestIdRef.current !== reqId) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setIssues(res.issues);

      // Preserve unfiltered filter options so narrowing doesn't hide other statuses/epics
      if (!debouncedSearch.trim() && !statusFilter && !epicFilter) {
        setKnownStatuses(Array.from(new Set(res.issues.map((i) => i.status))).sort());
        const epicMap = new Map<string, string>();
        for (const i of res.issues) {
          if (i.epicKey) epicMap.set(i.epicKey, i.epicName ?? i.epicKey);
        }
        setKnownEpics(Array.from(epicMap.entries()));
      }
    })();
  }, [debouncedSearch, epicFilter, jiraConfigured, statusFilter]);

  const statuses = useMemo(() => {
    const merged = new Set(knownStatuses);
    for (const i of issues) merged.add(i.status);
    return Array.from(merged).sort();
  }, [issues, knownStatuses]);

  const epics = useMemo(() => {
    const map = new Map<string, string>(knownEpics);
    for (const i of issues) {
      if (i.epicKey) map.set(i.epicKey, i.epicName ?? i.epicKey);
    }
    return Array.from(map.entries());
  }, [issues, knownEpics]);

  const visibleIssues = useMemo(
    () => (quickWinsOnly ? issues.filter((i) => i.isQuickWin) : issues),
    [issues, quickWinsOnly]
  );

  const handlePin = async (issue: JiraIssueSummary): Promise<void> => {
    const res = await pinQuestAction({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      url: issue.url,
    });
    if (!res.ok) {
      setError(res.error ?? 'Failed to pin quest.');
      return;
    }
    arcadeAudio.playStationActivate();
    await onRefresh();
    onClose();
  };

  return (
    <ArcadeModalShell
      title="COMMAND CONSOLE — QUEST BOARD"
      subtitle="Pin one active Boss Quest to focus on."
      accentColor="cyan"
      maxWidthClass="max-w-3xl"
      onClose={onClose}
    >
      {!jiraConfigured ? (
        <div className="bg-[#1E293B] border border-slate-700 p-5 text-center space-y-3">
          <p className="text-sm text-slate-300">
            JIRA is not connected yet. Connect your JIRA workspace in Settings to load quests.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-300 font-pixel text-xs text-white cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Open Settings</span>
          </button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search key or summary..."
                className="w-full bg-slate-900 border border-slate-600 focus:border-cyan-400 outline-none pl-8 pr-3 py-1.5 text-sm text-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setQuickWinsOnly((q) => !q)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 border font-pixel text-xs cursor-pointer ${
                quickWinsOnly
                  ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300'
                  : 'bg-slate-900 border-slate-600 text-slate-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Quick Wins</span>
            </button>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-xs px-2 py-1.5 text-slate-200"
            >
              <option value="">All Statuses</option>
              {statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {epics.length > 0 && (
              <select
                value={epicFilter}
                onChange={(e) => setEpicFilter(e.target.value)}
                className="bg-slate-900 border border-slate-600 text-xs px-2 py-1.5 text-slate-200 max-w-[180px]"
              >
                <option value="">All Epics</option>
                {epics.map(([k, name]) => (
                  <option key={k} value={k}>
                    {k}: {name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="bg-rose-950/70 border border-rose-500 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          {loading ? (
            <p className="font-pixel text-xs text-cyan-300 py-6 text-center">
              SCANNING JIRA SECTOR...
            </p>
          ) : visibleIssues.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No matching quests found.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleIssues.map((issue) => {
                const isPinned = issue.key === activeQuestKey;
                return (
                  <li
                    key={issue.key}
                    className={`flex items-center justify-between gap-3 p-3 border ${
                      isPinned
                        ? 'bg-cyan-950/40 border-cyan-400'
                        : 'bg-[#1E293B] border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-code text-xs font-bold text-cyan-300">
                          {issue.key}
                        </span>
                        <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-slate-900 border border-slate-600 text-slate-300">
                          {issue.status}
                        </span>
                        {issue.isQuickWin && (
                          <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/60 text-yellow-300">
                            ⚡ QUICK WIN
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-100 truncate">{issue.summary}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handlePin(issue)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border font-pixel text-[11px] shrink-0 cursor-pointer ${
                        isPinned
                          ? 'bg-emerald-700/40 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 hover:bg-cyan-600 border-slate-500 hover:border-cyan-300 text-slate-100'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{isPinned ? 'Active Boss' : 'Pin as Next Quest'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </ArcadeModalShell>
  );
};
