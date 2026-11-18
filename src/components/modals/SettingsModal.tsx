'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { getOllamaStatusAction } from '@/app/actions/ai';
import { getJiraStatusesAction, testJiraAction } from '@/app/actions/jira';
import { getSettingsAction, saveSettingsAction } from '@/app/actions/rpg';
import { arcadeAudio } from '@/lib/arcadeAudio';
import { DEFAULT_OLLAMA_MODEL, validateJiraBaseUrl } from '@/lib/shared';
import type {
  JiraAssigneeFilter,
  JiraAuthType,
  JiraStatusOption,
  RoadmapMode,
} from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';
import { JiraSection } from './settings/JiraSection';
import { OllamaSection } from './settings/OllamaSection';
import { ProfileSection } from './settings/ProfileSection';
import { SettingsHelpPopup, type SettingsHelpTopic } from './settings/SettingsHelpPopup';

interface SettingsModalProps {
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onCalendarRefresh?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  onRefresh,
  onCalendarRefresh,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpTopic, setHelpTopic] = useState<SettingsHelpTopic | null>(null);

  // Profile
  const [name, setName] = useState<string>('Alex');
  const [weeklyXpGoal, setWeeklyXpGoal] = useState<number>(600);
  const [restDays, setRestDays] = useState<number[]>([0, 6]);
  const [muted, setMuted] = useState<boolean>(false);

  // JIRA + Calendar + Roadmap
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [authType, setAuthType] = useState<JiraAuthType>('cloud');
  const [email, setEmail] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [jqlScope, setJqlScope] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<JiraAssigneeFilter>('me_and_unassigned');
  const [roadmapMode, setRoadmapMode] = useState<RoadmapMode>('off');
  const [icsUrls, setIcsUrls] = useState<string>('');
  const [completedStatuses, setCompletedStatuses] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<JiraStatusOption[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [jiraTestMsg, setJiraTestMsg] = useState<string | null>(null);

  // Local AI (Ollama)
  const [model, setModel] = useState<string>(DEFAULT_OLLAMA_MODEL);
  const [keepAlive, setKeepAlive] = useState<string>('30s');
  const [ollamaUrl, setOllamaUrl] = useState<string>('http://127.0.0.1:11434');
  const [aiStatus, setAiStatus] = useState<'not_installed' | 'stopped' | 'ready'>('stopped');
  const [modelInstalled, setModelInstalled] = useState<boolean>(false);

  const refreshAiStatus = useCallback(async () => {
    const res = await getOllamaStatusAction();
    setAiStatus(res.status);
    setModelInstalled(res.modelInstalled);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [settingsRes] = await Promise.all([getSettingsAction(), refreshAiStatus()]);
      if (!active) return;
      if (settingsRes.data) {
        const { profile, jira, ai } = settingsRes.data;
        setName(profile.name);
        setWeeklyXpGoal(profile.weeklyXpGoal);
        setRestDays(profile.restDays);
        setMuted(profile.muted);

        setBaseUrl(jira.baseUrl);
        setAuthType(jira.authType);
        setEmail(jira.email);
        setHasToken(jira.hasToken);
        setJqlScope(jira.jqlScope);
        setAssigneeFilter(jira.assigneeFilter);
        setRoadmapMode(jira.roadmapMode);
        setIcsUrls(jira.icsUrls);
        setCompletedStatuses(jira.completedStatuses);

        setModel(ai.model);
        setKeepAlive(ai.keepAlive);
        setOllamaUrl(ai.ollamaUrl);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshAiStatus]);

  const toggleRestDay = (dayIdx: number): void => {
    setRestDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const toggleCompletedStatus = (statusName: string): void => {
    setCompletedStatuses((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === statusName.toLowerCase());
      return exists
        ? prev.filter((s) => s.toLowerCase() !== statusName.toLowerCase())
        : [...prev, statusName];
    });
  };

  const handleFetchStatuses = async (): Promise<void> => {
    setLoadingStatuses(true);
    setStatusError(null);
    const res = await getJiraStatusesAction({
      baseUrl,
      authType,
      email,
      token: token.trim() || undefined,
      jqlScope,
    });
    setLoadingStatuses(false);
    if (res.error) {
      setStatusError(res.error);
      return;
    }
    setAvailableStatuses(res.statuses);
  };

  const handleTestJira = async (): Promise<void> => {
    const check = validateJiraBaseUrl(baseUrl);
    if (!check.valid) {
      setJiraTestMsg(`Failed: ${check.error ?? 'Invalid Base URL'}`);
      return;
    }

    setJiraTestMsg('Testing...');
    const res = await testJiraAction({
      baseUrl,
      authType,
      email,
      token: token.trim() || undefined,
    });
    if (res.ok && res.user && res.user !== 'Connected') {
      if (!name.trim() || name.trim() === 'Alex') {
        setName(res.user);
      }
    }
    setJiraTestMsg(
      res.ok ? `Connected as ${res.user ?? 'OK'}` : `Failed: ${res.error ?? 'Unknown error'}`
    );
  };

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const urlCheck = validateJiraBaseUrl(baseUrl);
    if (!urlCheck.valid) {
      setError(urlCheck.error ?? 'Invalid JIRA Base URL.');
      return;
    }

    setSaving(true);
    const res = await saveSettingsAction({
      profile: { name, weeklyXpGoal, restDays, muted },
      jira: {
        baseUrl,
        authType,
        email,
        token: token.trim() || undefined,
        jqlScope,
        assigneeFilter,
        roadmapMode,
        icsUrls,
        completedStatuses,
      },
      ai: { model, keepAlive, ollamaUrl },
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? 'Failed to save settings.');
      return;
    }

    arcadeAudio.playCoinChime();
    if (token.trim()) {
      setHasToken(true);
      setToken('');
    }
    await onRefresh();
    await onCalendarRefresh?.();
    onClose();
  };

  return (
    <>
      <ArcadeModalShell
        title="SYSTEM SETTINGS"
        subtitle="Configure Hero, JIRA, Calendars, and Local Ollama AI."
        accentColor="cyan"
        maxWidthClass="max-w-3xl"
        onClose={onClose}
      >
        {loading ? (
          <p className="font-pixel text-xs text-cyan-300 py-8 text-center">LOADING CONFIG...</p>
        ) : (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
            {error && (
              <div className="bg-rose-950/70 border border-rose-500 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}
            {notice && (
              <div className="bg-emerald-950/70 border border-emerald-500 px-3 py-2 text-xs text-emerald-200">
                {notice}
              </div>
            )}

            <ProfileSection
              name={name}
              onNameChange={setName}
              weeklyXpGoal={weeklyXpGoal}
              onWeeklyXpGoalChange={setWeeklyXpGoal}
              restDays={restDays}
              onToggleRestDay={toggleRestDay}
              muted={muted}
              onMutedChange={setMuted}
            />

            <JiraSection
              baseUrl={baseUrl}
              onBaseUrlChange={setBaseUrl}
              authType={authType}
              onAuthTypeChange={setAuthType}
              email={email}
              onEmailChange={setEmail}
              token={token}
              onTokenChange={setToken}
              hasToken={hasToken}
              jqlScope={jqlScope}
              onJqlScopeChange={setJqlScope}
              assigneeFilter={assigneeFilter}
              onAssigneeFilterChange={setAssigneeFilter}
              roadmapMode={roadmapMode}
              onRoadmapModeChange={setRoadmapMode}
              icsUrls={icsUrls}
              onIcsUrlsChange={setIcsUrls}
              jiraTestMsg={jiraTestMsg}
              onTestJira={handleTestJira}
              availableStatuses={availableStatuses}
              completedStatuses={completedStatuses}
              loadingStatuses={loadingStatuses}
              statusError={statusError}
              onFetchStatuses={handleFetchStatuses}
              onToggleCompletedStatus={toggleCompletedStatus}
              onOpenHelp={setHelpTopic}
            />

            <OllamaSection
              model={model}
              onModelChange={setModel}
              keepAlive={keepAlive}
              onKeepAliveChange={setKeepAlive}
              ollamaUrl={ollamaUrl}
              onOllamaUrlChange={setOllamaUrl}
              aiStatus={aiStatus}
              modelInstalled={modelInstalled}
              onRefreshAiStatus={refreshAiStatus}
              onNotice={setNotice}
              onError={setError}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 font-pixel text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-300 font-pixel text-xs text-white cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </ArcadeModalShell>

      {helpTopic && <SettingsHelpPopup topic={helpTopic} onClose={() => setHelpTopic(null)} />}
    </>
  );
};
