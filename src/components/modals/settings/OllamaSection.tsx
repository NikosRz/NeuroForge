'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Cpu, Download, Loader2, Play, Square, X } from 'lucide-react';
import { startOllamaAction, stopOllamaAction } from '@/app/actions/ai';

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

interface InstallStreamPayload {
  status?: string;
  progress?: number;
  detail?: string;
  done?: boolean;
  error?: string;
}

interface PullStreamPayload {
  status?: string;
  completed?: number;
  total?: number;
  error?: string;
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
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<number | null>(null);
  const [installLabel, setInstallLabel] = useState<string | null>(null);
  const [installDetail, setInstallDetail] = useState<string | null>(null);

  const [busyAction, setBusyAction] = useState<'starting' | 'stopping' | null>(null);

  const [pullProgress, setPullProgress] = useState<number | null>(null);
  const [pullLabel, setPullLabel] = useState<string | null>(null);

  const installAbortRef = useRef<AbortController | null>(null);
  const pullAbortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      installAbortRef.current?.abort();
      pullAbortRef.current?.abort();
    },
    []
  );

  const handleInstallOllama = async (): Promise<void> => {
    installAbortRef.current?.abort();
    const controller = new AbortController();
    installAbortRef.current = controller;

    onError(null);
    onNotice(null);
    setInstalling(true);
    setInstallProgress(5);
    setInstallLabel('Starting Ollama installation...');
    setInstallDetail(null);

    try {
      const res = await fetch('/api/ai/install', {
        method: 'POST',
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError('Could not start Ollama installation.');
        setInstallProgress(null);
        setInstallLabel(null);
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
          const payload = JSON.parse(line.slice(5).trim()) as InstallStreamPayload;

          if (payload.error) {
            onError(payload.error);
            setInstallProgress(null);
            setInstallLabel(null);
            setInstallDetail(null);
            return;
          }

          if (typeof payload.progress === 'number') {
            setInstallProgress(Math.max(0, Math.min(100, Math.round(payload.progress))));
          }
          if (payload.status) {
            setInstallLabel(payload.status);
          }
          if (payload.detail) {
            setInstallDetail(payload.detail);
          }

          if (payload.done) {
            setInstallProgress(100);
            onNotice(payload.status ?? 'Ollama installed! Click Start to launch the server.');
            await onRefreshAiStatus();
            return;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err.message : 'Ollama installation interrupted.');
      setInstallProgress(null);
      setInstallLabel(null);
      setInstallDetail(null);
    } finally {
      if (installAbortRef.current === controller) {
        installAbortRef.current = null;
      }
      setInstalling(false);
    }
  };

  const handleCancelInstall = (): void => {
    installAbortRef.current?.abort();
    installAbortRef.current = null;
    setInstalling(false);
    setInstallProgress(null);
    setInstallLabel(null);
    setInstallDetail(null);
    onNotice('Ollama installation cancelled.');
  };

  const handleStartOllama = async (): Promise<void> => {
    onError(null);
    onNotice(null);
    setBusyAction('starting');
    try {
      const r = await startOllamaAction();
      if (r.error) onError(r.error);
      else if (r.message) onNotice(r.message);
      await onRefreshAiStatus();
    } finally {
      setBusyAction(null);
    }
  };

  const handleStopOllama = async (): Promise<void> => {
    onError(null);
    onNotice(null);
    setBusyAction('stopping');
    try {
      const r = await stopOllamaAction();
      if (r.error) onError(r.error);
      else if (r.message) onNotice(r.message);
      await onRefreshAiStatus();
    } finally {
      setBusyAction(null);
    }
  };

  const handlePullModel = async (): Promise<void> => {
    pullAbortRef.current?.abort();
    const controller = new AbortController();
    pullAbortRef.current = controller;

    onError(null);
    onNotice(null);
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
          const payload = JSON.parse(line.slice(5).trim()) as PullStreamPayload;
          if (payload.error) {
            onError(payload.error);
            setPullProgress(null);
            return;
          }
          if (payload.status === 'done') {
            setPullProgress(100);
            setPullLabel('Model ready!');
            onNotice(`Model ${model} downloaded and ready.`);
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

  const handleCancelPull = (): void => {
    pullAbortRef.current?.abort();
    pullAbortRef.current = null;
    setPullProgress(null);
    setPullLabel(null);
    onNotice('Model download cancelled.');
  };

  const isPulling = pullProgress !== null && pullProgress < 100;

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
            {installing ? 'INSTALLING' : aiStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {aiStatus === 'not_installed' && (
            <>
              <button
                type="button"
                disabled={installing}
                onClick={() => void handleInstallOllama()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 border border-cyan-400 font-pixel text-[10px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {installing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <span>Install Ollama</span>
                )}
              </button>
              {installing && (
                <button
                  type="button"
                  onClick={handleCancelInstall}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-500 font-pixel text-[10px] text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              )}
            </>
          )}

          {aiStatus === 'stopped' && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleStartOllama()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 font-pixel text-[10px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busyAction === 'starting' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Start</span>
                </>
              )}
            </button>
          )}

          {aiStatus === 'ready' && (
            <>
              <button
                type="button"
                disabled={busyAction !== null || isPulling}
                onClick={() => void handleStopOllama()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-500 font-pixel text-[10px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busyAction === 'stopping' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Stopping...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3 h-3" />
                    <span>Stop</span>
                  </>
                )}
              </button>
              {!modelInstalled && (
                <>
                  <button
                    type="button"
                    disabled={isPulling}
                    onClick={() => void handlePullModel()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-600/30 hover:bg-yellow-600/40 border border-yellow-400 font-pixel text-[10px] text-yellow-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPulling ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        <span>Download {model}</span>
                      </>
                    )}
                  </button>
                  {isPulling && (
                    <button
                      type="button"
                      onClick={handleCancelPull}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-500 font-pixel text-[10px] text-slate-200 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}
                </>
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

      {!installing && aiStatus === 'not_installed' && (
        <p className="text-[11px] text-slate-400">
          Setup steps: 1. Install Ollama → 2. Start server → 3. Download {model}
        </p>
      )}

      {aiStatus === 'stopped' && busyAction === null && (
        <p className="text-[11px] text-amber-200/80">
          Ollama is installed. Click <span className="font-semibold text-amber-200">Start</span> to launch the local server.
        </p>
      )}

      {aiStatus === 'ready' && !modelInstalled && pullProgress === null && (
        <p className="text-[11px] text-yellow-200/80">
          Ollama server is running. Click{' '}
          <span className="font-semibold text-yellow-200">Download {model}</span> to pull the AI model.
        </p>
      )}

      {installProgress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between gap-2 text-[11px] text-slate-200">
            <span className="truncate">{installLabel ?? 'Installing Ollama...'}</span>
            <span className="shrink-0 font-mono">{installProgress}%</span>
          </div>
          <div className="h-2 bg-slate-900 border border-slate-700 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-[width] duration-300"
              style={{ width: `${installProgress}%` }}
            />
          </div>
          {installDetail && (
            <p className="text-[10px] font-mono text-slate-400 truncate" title={installDetail}>
              {installDetail}
            </p>
          )}
        </div>
      )}

      {pullProgress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between gap-2 text-[11px] text-slate-300">
            <span className="truncate">{pullLabel}</span>
            <span className="shrink-0 font-mono">{pullProgress}%</span>
          </div>
          <div className="h-2 bg-slate-900 border border-slate-700 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-[width] duration-300"
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
