'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Plus, Search, Trash2, Zap } from 'lucide-react';
import {
  addNoteAction,
  deleteNoteAction,
  getNotesAction,
  pickQuickTaskAction,
} from '@/app/actions/mind-dump';
import { arcadeAudio } from '@/lib/arcadeAudio';
import type { StickyNoteRow } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface MindDumpModalProps {
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export const MindDumpModal: React.FC<MindDumpModalProps> = ({ onClose }) => {
  const [thought, setThought] = useState<string>('');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [notes, setNotes] = useState<StickyNoteRow[]>([]);
  const [quickMatch, setQuickMatch] = useState<{
    text: string;
    reason?: string;
    minutes: number;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef<number>(0);
  const noticeTimerRef = useRef<number | null>(null);

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
    setSavedNotice('Captured!');
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setSavedNotice(null);
      noticeTimerRef.current = null;
    }, 1500);
  };

  const handleDelete = async (id: number): Promise<void> => {
    const res = await deleteNoteAction(id);
    if (!res.ok) {
      setError(res.error ?? 'Could not delete note.');
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleQuickTask = async (minutes: 5 | 15 | 30): Promise<void> => {
    setAiLoading(true);
    setError(null);
    setQuickMatch(null);
    const res = await pickQuickTaskAction(minutes);
    setAiLoading(false);
    if (res.error || !res.text) {
      setError(res.error ?? 'No matching quick task found.');
      return;
    }
    arcadeAudio.playStationActivate();
    setQuickMatch({ text: res.text, reason: res.reason, minutes });
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

      {savedNotice && <p className="font-pixel text-xs text-emerald-300">{savedNotice}</p>}

      {/* Quick Task Picker (Local AI) */}
      <div className="bg-[#0B1221] border border-slate-700 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-pixel text-xs text-yellow-300">
            <Zap className="w-4 h-4" />
            <span>GET QUICK TASK (LOCAL AI)</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">I have:</span>
            {([5, 15, 30] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={aiLoading}
                onClick={() => void handleQuickTask(m)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-yellow-500/20 border border-slate-600 hover:border-yellow-400 font-pixel text-xs text-yellow-300 cursor-pointer disabled:opacity-50"
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {aiLoading && (
          <p className="font-pixel text-xs text-cyan-300">MATCHING A TASK WITH OLLAMA...</p>
        )}

        {quickMatch && (
          <div className="bg-emerald-950/40 border border-emerald-500/60 p-2.5 space-y-1">
            <p className="text-sm font-semibold text-emerald-200">
              [{quickMatch.minutes}m] {quickMatch.text}
            </p>
            {quickMatch.reason && (
              <p className="text-xs text-emerald-300/80">{quickMatch.reason}</p>
            )}
          </div>
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
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-2 bg-[#1E293B] border border-slate-700 px-3 py-2 text-sm"
                >
                  <span className="text-slate-100">{n.content}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(n.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                    aria-label="Delete note"
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
