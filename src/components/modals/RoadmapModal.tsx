'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, MapPin, Upload } from 'lucide-react';
import { getRoadmapAction, saveRoadmapAction } from '@/app/actions/roadmap-calendar';
import type { RoadmapMode, RoadmapStepRow } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface RoadmapModalProps {
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export const RoadmapModal: React.FC<RoadmapModalProps> = ({ onClose, onRefresh }) => {
  const [mode, setMode] = useState<RoadmapMode>('off');
  const [steps, setSteps] = useState<RoadmapStepRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [jsonInput, setJsonInput] = useState<string>('');
  const [showImport, setShowImport] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentRef = useRef<HTMLDivElement | null>(null);

  const load = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const res = await getRoadmapAction();
    setLoading(false);
    setMode(res.mode);
    setSteps(res.steps);
    if (res.error) setError(res.error);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!loading && currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [loading, steps]);

  const handleImportJson = async (): Promise<void> => {
    setError(null);
    try {
      const parsed: unknown = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        setError('JSON must be an array of { title, status?, subtitle? }.');
        return;
      }
      const res = await saveRoadmapAction({
        mode: 'json',
        steps: parsed as Array<{
          id?: string;
          title: string;
          status?: 'done' | 'current' | 'locked';
          subtitle?: string;
        }>,
      });
      if (!res.ok) {
        setError(res.error ?? 'Failed to save roadmap.');
        return;
      }
      setShowImport(false);
      await load();
      await onRefresh();
    } catch {
      setError('Invalid JSON format.');
    }
  };

  return (
    <ArcadeModalShell
      title="HOLO-RADAR — SECTOR ROADMAP"
      subtitle={`Mode: ${mode.toUpperCase()}`}
      accentColor="emerald"
      maxWidthClass="max-w-4xl"
      onClose={onClose}
    >
      {error && (
        <div className="bg-rose-950/70 border border-rose-500 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          Scroll horizontally to inspect sector milestones.
        </span>
        <button
          type="button"
          onClick={() => setShowImport((s) => !s)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 font-pixel text-[11px] cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{showImport ? 'Close JSON' : 'Paste JSON'}</span>
        </button>
      </div>

      {showImport && (
        <div className="bg-[#0B1221] border border-slate-700 p-3 space-y-2">
          <textarea
            rows={4}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[{"title":"Auth","status":"done"},{"title":"RPG UI","status":"current"},{"title":"Launch","status":"locked"}]'
            className="w-full bg-slate-900 border border-slate-600 p-2 font-mono-code text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={() => void handleImportJson()}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-300 font-pixel text-xs cursor-pointer"
          >
            Save JSON Roadmap
          </button>
        </div>
      )}

      {loading ? (
        <p className="font-pixel text-xs text-emerald-300 py-8 text-center">
          CALIBRATING HOLO-RADAR...
        </p>
      ) : mode === 'off' ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          Roadmap is currently OFF. Enable JSON or JIRA Sync in Settings, or paste JSON above.
        </p>
      ) : steps.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No roadmap milestones found.</p>
      ) : (
        <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1">
          {steps.map((step) => {
            const isCurrent = step.status === 'current';
            const isDone = step.status === 'done';
            return (
              <div
                key={step.id}
                ref={isCurrent ? currentRef : undefined}
                className={`min-w-[200px] max-w-[220px] shrink-0 p-3 border-2 flex flex-col justify-between gap-2 ${
                  isCurrent
                    ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                    : isDone
                      ? 'bg-emerald-950/40 border-emerald-600'
                      : 'bg-slate-900/80 border-slate-700 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[10px] uppercase text-slate-300">
                    {step.status}
                  </span>
                  {isDone ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <MapPin className="w-4 h-4 text-cyan-300" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div>
                  {step.subtitle && (
                    <p className="font-mono-code text-[11px] text-cyan-300">{step.subtitle}</p>
                  )}
                  <p className="text-sm font-semibold text-slate-100 mt-0.5">{step.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ArcadeModalShell>
  );
};
