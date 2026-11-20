'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  addMicroStepAction,
  deleteMicroStepAction,
  getIssueDetailAction,
  splitQuestAction,
  toggleMicroStepAction,
} from '@/app/actions/jira';
import { arcadeAudio } from '@/lib/arcadeAudio';
import type { MicroStepRow } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface QuestModalProps {
  activeQuest: {
    key: string;
    summary: string;
    status: string;
    url: string;
  };
  initialMicroSteps: MicroStepRow[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onXpCelebration: (amount: number, label: string, leveledUp?: boolean, newLevel?: number) => void;
}

export const QuestModal: React.FC<QuestModalProps> = ({
  activeQuest,
  initialMicroSteps,
  onClose,
  onRefresh,
  onXpCelebration,
}) => {
  const [steps, setSteps] = useState<MicroStepRow[]>(initialMicroSteps);
  const [jiraSubtasks, setJiraSubtasks] = useState<
    Array<{ key: string; summary: string; done: boolean }>
  >([]);
  const [newStepTitle, setNewStepTitle] = useState<string>('');
  const [splitting, setSplitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSteps(initialMicroSteps);
  }, [initialMicroSteps]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const detail = await getIssueDetailAction(activeQuest.key);
      if (!active) return;
      if (detail.issue) {
        setJiraSubtasks(detail.issue.subtasks);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeQuest.key]);

  const handleAddStep = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = newStepTitle.trim();
    if (!trimmed) return;
    setError(null);
    const res = await addMicroStepAction({ jiraIssueKey: activeQuest.key, title: trimmed });
    const savedStep = res.step;
    if (res.error || !savedStep) {
      setError(res.error ?? 'Could not add micro-step.');
      return;
    }
    setSteps((prev) => [...prev, savedStep]);
    setNewStepTitle('');
    await onRefresh();
  };

  const handleToggleStep = async (step: MicroStepRow): Promise<void> => {
    setError(null);
    const nextDone = step.done !== 1;
    const res = await toggleMicroStepAction({ id: step.id, done: nextDone });
    const updatedStep = res.step;
    if (res.error || !updatedStep) {
      setError(res.error ?? 'Could not update micro-step.');
      return;
    }
    setSteps((prev) => prev.map((s) => (s.id === step.id ? updatedStep : s)));
    if (res.xpResult && !res.xpResult.duplicate && res.xpResult.awardedXp > 0) {
      arcadeAudio.playCoinChime();
      onXpCelebration(
        res.xpResult.awardedXp,
        `+${res.xpResult.awardedXp} XP!`,
        res.xpResult.leveledUp,
        res.xpResult.newLevel
      );
    }
    await onRefresh();
  };

  const handleDeleteStep = async (id: number): Promise<void> => {
    const res = await deleteMicroStepAction(id);
    if (!res.ok) {
      setError(res.error ?? 'Could not delete micro-step.');
      return;
    }
    setSteps((prev) => prev.filter((s) => s.id !== id));
    await onRefresh();
  };

  const handleSplitAi = async (): Promise<void> => {
    setSplitting(true);
    setError(null);
    const res = await splitQuestAction({
      jiraIssueKey: activeQuest.key,
      summary: activeQuest.summary,
    });
    setSplitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSteps((prev) => [...prev, ...res.steps]);
    arcadeAudio.playStationActivate();
    await onRefresh();
  };

  return (
    <ArcadeModalShell
      title={`QUEST: ${activeQuest.key}`}
      subtitle={activeQuest.summary}
      accentColor="rose"
      onClose={onClose}
    >
      {error && (
        <div className="bg-rose-950/70 border border-rose-500 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Ticket Info & Open in JIRA (status must be changed directly in JIRA) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E293B] border border-slate-700 p-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-pixel text-xs px-2 py-1 bg-slate-900 border border-slate-600 text-cyan-300">
            {activeQuest.status}
          </span>
          <span className="text-xs text-slate-400">
            Finish this task in JIRA, then shoot the Boss to defeat it &amp; claim XP.
          </span>
        </div>

        {activeQuest.url && (
          <a
            href={activeQuest.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400 text-xs text-cyan-200 font-pixel shrink-0"
          >
            <span>Open in JIRA</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Subtasks or Local Micro-Steps */}
      {jiraSubtasks.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-pixel text-xs text-slate-300">JIRA SUB-TASKS</h3>
          <ul className="space-y-1.5">
            {jiraSubtasks.map((st) => (
              <li
                key={st.key}
                className="flex items-center gap-2 bg-[#1E293B] border border-slate-700 px-3 py-2 text-sm"
              >
                <span className={st.done ? 'text-emerald-400' : 'text-slate-500'}>
                  {st.done ? '✓' : '○'}
                </span>
                <span className="font-mono-code text-xs text-cyan-300">{st.key}</span>
                <span className={st.done ? 'line-through text-slate-400' : 'text-slate-100'}>
                  {st.summary}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-pixel text-xs text-slate-300">
              LOCAL MICRO-STEPS ({steps.filter((s) => s.done === 1).length}/{steps.length})
            </h3>
            <button
              type="button"
              disabled={splitting}
              onClick={() => void handleSplitAi()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-400 font-pixel text-[11px] text-cyan-200 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{splitting ? 'Splitting...' : 'Split Quest (Local AI)'}</span>
            </button>
          </div>

          <form onSubmit={(e) => void handleAddStep(e)} className="flex gap-2">
            <input
              type="text"
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              placeholder="+ Add a tiny micro-step (awards +15 XP)..."
              className="flex-1 bg-slate-900 border border-slate-600 focus:border-cyan-400 outline-none px-3 py-1.5 text-sm text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-500 font-pixel text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {steps.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No micro-steps yet. Add one above or click Split Quest (Local AI).
            </p>
          ) : (
            <ul className="space-y-1.5">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center justify-between gap-2 bg-[#1E293B] border border-slate-700 px-3 py-2"
                >
                  <label className="flex items-center gap-2.5 flex-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={step.done === 1}
                      onChange={() => void handleToggleStep(step)}
                      className="accent-emerald-400 w-4 h-4 cursor-pointer"
                    />
                    <span className={step.done === 1 ? 'line-through text-slate-400' : 'text-slate-100'}>
                      {step.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleDeleteStep(step.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    aria-label="Delete micro-step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ArcadeModalShell>
  );
};
