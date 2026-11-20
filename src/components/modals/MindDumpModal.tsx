'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, Search, Sparkles, Trash2, Zap } from 'lucide-react';
import {
  addNoteAction,
  deleteNoteAction,
  estimateMindDumpTimesAction,
  getNotesAction,
  pickQuickTaskAction,
  type QuickTaskLookupResult,
} from '@/app/actions/mind-dump';
import { arcadeAudio } from '@/lib/arcadeAudio';
import type { StickyNoteRow } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface MindDumpModalProps {
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const formatEstimateBadge = (estMinutes: number | null): { label: string; className: string } => {
  const mins = estMinutes ?? 0;
  if (mins <= 0) {
    return {
      label: '0m',
      className: 'bg-slate-800 border-slate-600 text-slate-400',
    };
  }
  if (mins <= 5) {
    return {
      label: `${mins}m`,
      className: 'bg-emerald-950/70 border-emerald-500/70 text-emerald-300',
    };
  }
  if (mins <= 15) {
    return {
      label: `${mins}m`,
      className: 'bg-cyan-950/70 border-cyan-500/70 text-cyan-300',
    };
  }
  return {
    label: `${mins}m`,
    className: 'bg-amber-950/70 border-amber-500/70 text-amber-300',
  };
};

export const MindDumpModal: React.FC<MindDumpModalProps> = ({ onClose }) => {
  const [thought, setThought] = useState<string>('');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [notes, setNotes] = useState<StickyNoteRow[]>([]);
  const [quickResult, setQuickResult] = useState<QuickTaskLookupResult | null>(null);
  const [estimating, setEstimating] = useState<boolean>(false);
  const [lookingUp, setLookingUp] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef<number>(0);
  const noticeTimerRef = useRef<number | null>(null);

  const showTempNotice = (msg: string, durationMs = 2500): void => {
    setNotice(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const reqId = requestIdRef.current + 1;
    requestIdRef.current = reqId;

    void (async () => {
      const res = await getNotesAction(debouncedSearch);
      if (requestIdRef.current !== reqId) return;
      if (res.error) {
        setError(res.error);
        return;
      }
      setNotes(res.notes);
    })();
  }, [debouncedSearch]);

  const handleCapture = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = thought.trim();
    if (!trimmed) return;
    setError(null);
    const res = await addNoteAction({ content: trimmed });
    const savedNote = res.note;
    if (res.error || !savedNote) {
      setError(res.error ?? 'Could not save thought.');
      return;
    }
    arcadeAudio.playCoinChime();
    setNotes((prev) => [savedNote, ...prev]);
    setThought('');
    showTempNotice('Captured!', 1500);
  };

  const handleDelete = async (id: number): Promise<void> => {
    const res = await deleteNoteAction(id);
    if (!res.ok) {
      setError(res.error ?? 'Could not delete note.');
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setQuickResult((prev) => {
      if (!prev) return null;
      const remaining = prev.notes.filter((n) => n.id !== id);
      return remaining.length > 0 ? { ...prev, notes: remaining } : null;
    });
  };

  const handleEstimateTimes = async (): Promise<void> => {
    setEstimating(true);
    setError(null);
    const res = await estimateMindDumpTimesAction();
    setEstimating(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    arcadeAudio.playCoinChime();
    setNotes(res.notes);
    setQuickResult(null);
    showTempNotice(
      res.estimatedCount > 0
        ? `Assigned time estimates to ${res.estimatedCount} note(s).`
        : 'Ollama could not estimate any new notes (left at 0m).',
      3500
    );
  };

  const handleQuickTask = async (minutes: 5 | 15 | 30): Promise<void> => {
    setLookingUp(true);
    setError(null);
    const res = await pickQuickTaskAction(minutes);
    setLookingUp(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.notes.length > 0) {
      arcadeAudio.playStationActivate();
    }
    setQuickResult(res);
  };

  return (
    <ArcadeModalShell
      title="MIND-DUMP DATA POD"
      subtitle="Unload stray thoughts fast — keep your head clear."
      accentColor="cyan"
      onClose={onClose}
    >
      {error && (
        <div className="bg-rose-950/70 border border-rose-500 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Quick Capture */}
      <form onSubmit={(e) => void handleCapture(e)} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          placeholder="Dump any stray thought & press Enter..."
          className="flex-1 bg-slate-900 border-2 border-slate-600 focus:border-cyan-400 outline-none px-3 py-2 text-sm text-slate-100"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-300 font-pixel text-xs text-white cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Save</span>
        </button>
      </form>

      {notice && <p className="font-pixel text-xs text-emerald-300">{notice}</p>}

      {/* Time Picker & AI Time Estimation */}
      <div className="bg-[#0B1221] border border-slate-700 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-pixel text-xs text-yellow-300">
            <Zap className="w-4 h-4" />
            <span>GET QUICK TASK</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">I have:</span>
            {([5, 15, 30] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={lookingUp || estimating}
                onClick={() => void handleQuickTask(m)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-yellow-500/20 border border-slate-600 hover:border-yellow-400 font-pixel text-xs text-yellow-300 cursor-pointer disabled:opacity-50"
              >
                {m}m
              </button>
            ))}
            <button
              type="button"
              disabled={estimating || notes.length === 0}
              onClick={() => void handleEstimateTimes()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-900/50 hover:bg-cyan-800/60 border border-cyan-400/80 font-pixel text-[11px] text-cyan-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ml-1"
              title="Use Ollama to assign 5m, 15m, 30m, or 0m to your notes"
            >
              {estimating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Estimating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Estimate Times</span>
                </>
              )}
            </button>
          </div>
        </div>

        {estimating && (
          <p className="font-pixel text-xs text-cyan-300">
            ASSIGNING TIME ESTIMATES WITH OLLAMA...
          </p>
        )}

        {quickResult && quickResult.mode === 'match' && quickResult.notes[0] && (
          <div className="bg-emerald-950/40 border border-emerald-500/60 p-2.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-200">
              [{quickResult.minutes}m] {quickResult.notes[0].content}
            </p>
            <button
              type="button"
              onClick={() => void handleDelete(quickResult.notes[0].id)}
              className="text-emerald-300/70 hover:text-rose-400 p-1 cursor-pointer shrink-0"
              aria-label="Delete note"
              title="Remove note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {quickResult && quickResult.mode === 'unestimated' && (
          <div className="bg-amber-950/35 border border-amber-500/50 p-2.5 space-y-2">
            <p className="text-xs text-amber-200">
              No {quickResult.minutes}m tasks found — showing unestimated (0m) notes:
            </p>
            <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {quickResult.notes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-2 bg-slate-900/70 border border-slate-700 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-slate-100">[0m] {n.content}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(n.id)}
                    className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer shrink-0"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {quickResult && quickResult.mode === 'empty' && (
          <p className="text-xs text-slate-400 italic">
            No {quickResult.minutes}m or unestimated (0m) notes found.
          </p>
        )}
      </div>

      {/* Toggle Notes */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setShowNotes((s) => !s)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 font-pixel text-xs text-slate-200 cursor-pointer"
        >
          {showNotes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showNotes ? 'Hide Notes' : `Show Notes (${notes.length})`}</span>
        </button>
      </div>

      {showNotes && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter captured thoughts..."
              className="w-full bg-slate-900 border border-slate-600 focus:border-cyan-400 outline-none pl-8 pr-3 py-1.5 text-sm text-slate-100"
            />
          </div>

          {notes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No captured thoughts yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {notes.map((n) => {
                const badge = formatEstimateBadge(n.est_minutes);
                return (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-2 bg-[#1E293B] border border-slate-700 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-pixel text-[10px] px-1.5 py-0.5 border shrink-0 ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-slate-100 break-words">{n.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(n.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </ArcadeModalShell>
  );
};
