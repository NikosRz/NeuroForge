'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Cpu, Download, Play, Square } from 'lucide-react';
import {
  installOllamaAction,
  startOllamaAction,
  stopOllamaAction,
} from '@/app/actions/ai';

interface OllamaSectionProps {
  model: string;
  onModelChange: (val: string) => void;
  keepAlive: string;
  onKeepAliveChange: (val: string) => void;
  ollamaUrl: string;
  onOllamaUrlChange: (val: string) => void;
  aiStatus: 'not_installed' | 'stopped' | 'ready';
  modelInstalled: boolean;
  onRefreshAiStatus: () => Promise<void>;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}

export const OllamaSection: React.FC<OllamaSectionProps> = ({
  model,
  onModelChange,
  keepAlive,
  onKeepAliveChange,
  ollamaUrl,
  onOllamaUrlChange,
  aiStatus,
  modelInstalled,
  onRefreshAiStatus,
  onNotice,
  onError,
}) => {
  const [pullProgress, setPullProgress] = useState<number | null>(null);
  const [pullLabel, setPullLabel] = useState<string | null>(null);
  const pullAbortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      pullAbortRef.current?.abort();
    },
    []
  );

  const handlePullModel = async (): Promise<void> => {
    pullAbortRef.current?.abort();
    const controller = new AbortController();
    pullAbortRef.current = controller;

    onError(null);
    setPullProgress(0);
    setPullLabel('Starting download...');

    try {
      const res = await fetch('/api/ai/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError('Could not start model download.');
        setPullProgress(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            status?: string;
            completed?: number;
            total?: number;
            error?: string;
          };
          if (payload.error) {
            onError(payload.error);
            setPullProgress(null);
            return;
          }
          if (payload.status === 'done') {
            setPullProgress(100);
            setPullLabel('Model ready!');
            await onRefreshAiStatus();
            return;
          }
          setPullLabel(payload.status ?? 'Downloading...');
          if (payload.completed && payload.total) {
            setPullProgress(Math.round((payload.completed / payload.total) * 100));
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err.message : 'Model download interrupted.');
      setPullProgress(null);
    } finally {
      if (pullAbortRef.current === controller) {
        pullAbortRef.current = null;
      }
    }
  };

  return (
    <section className="bg-[#1E293B] border border-slate-700 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-300" />
          <h3 className="font-pixel text-xs text-emerald-300">LOCAL AI (OLLAMA)</h3>
          <span
            className={`font-pixel text-[10px] px-2 py-0.5 border ${
              aiStatus === 'ready'
                ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                : aiStatus === 'stopped'
                  ? 'bg-amber-950 border-amber-400 text-amber-300'
                  : 'bg-rose-950 border-rose-400 text-rose-300'
            }`}
          >
            {aiStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {aiStatus === 'not_installed' && (
            <button
              type="button"
              onClick={() =>
                void installOllamaAction().then((r) => {
                  if (r.error) onError(r.error);
                  else onNotice(r.message ?? 'Installed.');
                  void onRefreshAiStatus();
                })
              }
              className="px-2.5 py-1 bg-cyan-700 border border-cyan-400 font-pixel text-[10px] cursor-pointer"
            >
              Install Ollama
            </button>
          )}

          {aiStatus === 'stopped' && (
            <button
              type="button"
              onClick={() =>
                void startOllamaAction().then((r) => {
                  if (r.error) onError(r.error);
                  void onRefreshAiStatus();
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 border border-emerald-400 font-pixel text-[10px] cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Start</span>
            </button>
          )}

          {aiStatus === 'ready' && (
            <>
              <button
                type="button"
                onClick={() =>
                  void stopOllamaAction().then((r) => {
                    if (r.error) onError(r.error);
                    void onRefreshAiStatus();
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-500 font-pixel text-[10px] cursor-pointer"
              >
                <Square className="w-3 h-3" />
                <span>Stop</span>
              </button>
              {!modelInstalled && (
                <button
                  type="button"
                  onClick={() => void handlePullModel()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-600/30 border border-yellow-400 font-pixel text-[10px] text-yellow-200 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download {model}</span>
                </button>
              )}
              {modelInstalled && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  <span>{model} ready</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {pullProgress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>{pullLabel}</span>
            <span>{pullProgress}%</span>
          </div>
          <div className="h-2 bg-slate-900 border border-slate-700 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-[width]"
              style={{ width: `${pullProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block text-xs space-y-1">
          <span className="text-slate-300">Model</span>
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-slate-100"
          />
        </label>

        <label className="block text-xs space-y-1">
          <span className="text-slate-300">Keep Alive</span>
          <select
            value={keepAlive}
            onChange={(e) => onKeepAliveChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-slate-100"
          >
            <option value="30s">30s (Low RAM)</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
          </select>
        </label>

        <label className="block text-xs space-y-1">
          <span className="text-slate-300">Ollama URL</span>
          <input
            type="url"
            value={ollamaUrl}
            onChange={(e) => onOllamaUrlChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-slate-100"
          />
        </label>
      </div>
    </section>
  );
};
