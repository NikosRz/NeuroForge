'use client';

import React from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { validateJiraBaseUrl } from '@/lib/shared';
import type { JiraAssigneeFilter, JiraAuthType, JiraStatusOption, RoadmapMode } from '@/lib/types';
import type { SettingsHelpTopic } from './SettingsHelpPopup';

interface JiraSectionProps {
  baseUrl: string;
  onBaseUrlChange: (val: string) => void;
  authType: JiraAuthType;
  onAuthTypeChange: (val: JiraAuthType) => void;
  email: string;
  onEmailChange: (val: string) => void;
  token: string;
  onTokenChange: (val: string) => void;
  hasToken: boolean;
  jqlScope: string;
  onJqlScopeChange: (val: string) => void;
  assigneeFilter: JiraAssigneeFilter;
  onAssigneeFilterChange: (val: JiraAssigneeFilter) => void;
  roadmapMode: RoadmapMode;
  onRoadmapModeChange: (val: RoadmapMode) => void;
  icsUrls: string;
  onIcsUrlsChange: (val: string) => void;
  jiraTestMsg: string | null;
  onTestJira: () => Promise<void>;
  availableStatuses: JiraStatusOption[];
  completedStatuses: string[];
  loadingStatuses: boolean;
  statusError: string | null;
  onFetchStatuses: () => Promise<void>;
  onToggleCompletedStatus: (statusName: string) => void;
  onOpenHelp: (topic: SettingsHelpTopic) => void;
}

export const JiraSection: React.FC<JiraSectionProps> = ({
  baseUrl,
  onBaseUrlChange,
  authType,
  onAuthTypeChange,
  email,
  onEmailChange,
  token,
  onTokenChange,
  hasToken,
  jqlScope,
  onJqlScopeChange,
  assigneeFilter,
  onAssigneeFilterChange,
  roadmapMode,
  onRoadmapModeChange,
  icsUrls,
  onIcsUrlsChange,
  jiraTestMsg,
  onTestJira,
  availableStatuses,
  completedStatuses,
  loadingStatuses,
  statusError,
  onFetchStatuses,
  onToggleCompletedStatus,
  onOpenHelp,
}) => {
  const baseUrlValidation = validateJiraBaseUrl(baseUrl);
  const selectedSet = new Set(completedStatuses.map((s) => s.toLowerCase()));

  // Include any previously saved statuses even before "Fetch JIRA Statuses" is clicked
  const displayStatuses: Array<{ name: string; categoryKey?: JiraStatusOption['categoryKey'] }> =
    availableStatuses.length > 0
      ? availableStatuses
      : completedStatuses.map((name) => ({ name }));

  return (
    <>
      {/* JIRA Connection */}
      <section className="bg-[#1E293B] border border-slate-700 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-pixel text-xs text-cyan-300">JIRA CONNECTION</h3>
          <button
            type="button"
            onClick={() => void onTestJira()}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-cyan-500/60 font-pixel text-[10px] text-cyan-300 cursor-pointer"
          >
            Test Connection
          </button>
        </div>
        {jiraTestMsg && <p className="text-xs text-cyan-200">{jiraTestMsg}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs space-y-1">
            <span className="text-slate-300">JIRA Base URL</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="https://your-org.atlassian.net"
              className={`w-full bg-slate-900 border px-2.5 py-1.5 text-sm text-slate-100 ${
                !baseUrlValidation.valid ? 'border-rose-500' : 'border-slate-600'
              }`}
            />
            {!baseUrlValidation.valid && baseUrlValidation.error && (
              <p className="text-[11px] text-rose-300 leading-snug">{baseUrlValidation.error}</p>
            )}
          </label>

          <label className="block text-xs space-y-1">
            <span className="text-slate-300">Auth Type</span>
            <select
              value={authType}
              onChange={(e) => onAuthTypeChange(e.target.value as JiraAuthType)}
              className="w-full bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-100"
            >
              <option value="cloud">JIRA Cloud (Email + API Token)</option>
              <option value="server">JIRA Server / DC (PAT)</option>
            </select>
          </label>

          {authType === 'cloud' && (
            <label className="block text-xs space-y-1">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-100"
              />
            </label>
          )}

          <div className="block text-xs space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-300">
                {authType === 'cloud' ? 'API Token' : 'Personal Access Token'}{' '}
                {hasToken && <span className="text-emerald-400">(Saved)</span>}
              </span>
              <button
                type="button"
                onClick={() => onOpenHelp('jira-token')}
                aria-label="How to get a JIRA API token"
                title="How to get a JIRA API token"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-600 hover:border-cyan-400 text-[10px] text-cyan-300 font-pixel cursor-pointer"
              >
                <Info className="w-3 h-3" />
                <span>Help</span>
              </button>
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder={hasToken ? 'Leave blank to keep saved token' : 'Paste token'}
              className="w-full bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-100"
            />
          </div>

          <label className="block text-xs space-y-1">
            <span className="text-slate-300">Scope JQL (optional)</span>
            <input
              type="text"
              value={jqlScope}
              onChange={(e) => onJqlScopeChange(e.target.value)}
              placeholder="project = NF"
              className="w-full bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs space-y-1">
              <span className="text-slate-300">Assignee Filter</span>
              <select
                value={assigneeFilter}
                onChange={(e) => onAssigneeFilterChange(e.target.value as JiraAssigneeFilter)}
                className="w-full bg-slate-900 border border-slate-600 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="me_and_unassigned">Me + Unassigned</option>
                <option value="me_only">Me Only</option>
                <option value="all">All</option>
              </select>
            </label>

            <label className="block text-xs space-y-1">
              <span className="text-slate-300">Roadmap Mode</span>
              <select
                value={roadmapMode}
                onChange={(e) => onRoadmapModeChange(e.target.value as RoadmapMode)}
                className="w-full bg-slate-900 border border-slate-600 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="off">Off</option>
                <option value="json">JSON</option>
                <option value="jira_sync">JIRA Epics</option>
              </select>
            </label>
          </div>
        </div>

        {/* Completed Statuses (Boss Kill) */}
        <div className="pt-2 border-t border-slate-700/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-pixel text-[11px] text-emerald-300">
                COMPLETED STATUSES (BOSS DEFEAT)
              </span>
              <p className="text-[11px] text-slate-400">
                Select which JIRA statuses defeat the Boss. If none selected, any JIRA &quot;Done&quot;
                category status counts.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingStatuses}
              onClick={() => void onFetchStatuses()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-emerald-500/60 font-pixel text-[10px] text-emerald-300 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingStatuses ? 'animate-spin' : ''}`} />
              <span>{loadingStatuses ? 'Fetching...' : 'Fetch JIRA Statuses'}</span>
            </button>
          </div>

          {statusError && <p className="text-[11px] text-rose-300">{statusError}</p>}

          {displayStatuses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayStatuses.map((st) => {
                const active = selectedSet.has(st.name.toLowerCase());
                return (
                  <button
                    key={st.name}
                    type="button"
                    onClick={() => onToggleCompletedStatus(st.name)}
                    className={`px-2 py-1 border font-pixel text-[10px] cursor-pointer transition-colors ${
                      active
                        ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {active ? '✓ ' : ''}
                    {st.name}
                    {st.categoryKey === 'done' ? ' (Done)' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Calendars (.ics) */}
      <section className="bg-[#1E293B] border border-slate-700 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-pixel text-xs text-cyan-300">CALENDARS (.ICS PRIVATE URLS)</h3>
          <button
            type="button"
            onClick={() => onOpenHelp('ics-calendars')}
            aria-label="How to get Google or Outlook .ics links"
            title="How to get Google or Outlook .ics links"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-600 hover:border-cyan-400 text-[10px] text-cyan-300 font-pixel cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>Help</span>
          </button>
        </div>
        <textarea
          rows={2}
          value={icsUrls}
          onChange={(e) => onIcsUrlsChange(e.target.value)}
          placeholder="One .ics URL per line (Google / Outlook)"
          className="w-full bg-slate-900 border border-slate-600 p-2 font-mono-code text-xs text-slate-100"
        />
      </section>
    </>
  );
};
