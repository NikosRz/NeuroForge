'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Info, Settings, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { CalendarEvent } from '@/lib/types';

export interface HudSnapshot {
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  fatigued: boolean;
}

interface ArcadeHudProps {
  profileName: string;
  hud: HudSnapshot;
  muted: boolean;
  nextEvent: CalendarEvent | null;
  toastMsg: string | null;
  aiSplitting: boolean;
  portraitCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onOpenStats: () => void;
  onOpenInfo: () => void;
}

const formatTodayLabel = (now: Date): string =>
  now
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();

const formatNextEventLabel = (ev: CalendarEvent | null, nowMs: number): string => {
  if (!ev) return 'No upcoming meetings';
  const start = new Date(ev.start);
  const timeStr = ev.allDay
    ? 'ALL DAY'
    : start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const diffMins = Math.round((start.getTime() - nowMs) / 60_000);
  const rel = diffMins > 0 ? ` (${diffMins}m)` : diffMins > -60 ? ' (now)' : '';
  const title = ev.title.length > 28 ? `${ev.title.slice(0, 25)}...` : ev.title;
  return `${timeStr} ${title}${rel}`;
};

export const ArcadeHud: React.FC<ArcadeHudProps> = ({
  profileName,
  hud,
  muted,
  nextEvent,
  toastMsg,
  aiSplitting,
  portraitCanvasRef,
  onToggleMute,
  onOpenSettings,
  onOpenCalendar,
  onOpenStats,
  onOpenInfo,
}) => {
  // Computed client-side after mount so SSR and client hydration never diverge across timezones/minutes
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
    setClientNow(new Date());
    const id = window.setInterval(() => {
      setClientNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const expPct = Math.min(100, Math.round((hud.exp / Math.max(1, hud.maxExp)) * 100));
  const hpPct = Math.min(100, Math.round((hud.hp / Math.max(1, hud.maxHp)) * 100));
  const todayLabel = clientNow ? formatTodayLabel(clientNow) : '\u00A0';
  const nextEventLabel = clientNow
    ? formatNextEventLabel(nextEvent, clientNow.getTime())
    : 'Checking schedule...';

  return (
    <>
      {/* Top Arcade HUD Overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-5 flex items-start justify-between gap-4">
        {/* Top-Left Greeting */}
        <div className="flex flex-col gap-0.5 drop-shadow-[0_2px_0_rgba(5,7,14,1)]">
          <span className="font-pixel text-[11px] sm:text-sm tracking-wider text-slate-300 leading-none min-h-[1em]">
            {todayLabel}
          </span>
          <h1 className="font-arcade text-base sm:text-2xl tracking-tight text-white leading-tight mt-1">
            HELLO, {profileName.toUpperCase()}!
          </h1>
        </div>

        {/* Top-Right Status Cluster */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2.5">
            {/* Pixel Robot Portrait Badge */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#0F172A] border-2 border-slate-500 p-0.5 shrink-0 shadow-[0_3px_0_#020617]">
              <canvas
                ref={portraitCanvasRef}
                width={40}
                height={40}
                className="w-full h-full block pixelated"
              />
            </div>

            {/* Level, EXP & HP/Stamina Bars */}
            <div className="flex flex-col gap-1 min-w-[180px] sm:min-w-[235px]">
              <button
                type="button"
                onClick={onOpenStats}
                className="pointer-events-auto flex flex-col gap-0.5 text-left cursor-pointer group"
                title="Open Player Stats"
              >
                <div className="flex items-center justify-between w-full font-pixel text-[11px] sm:text-xs tabular-nums leading-none drop-shadow-[0_2px_0_#05070E]">
                  <span className="text-yellow-400 font-bold group-hover:text-yellow-300">
                    LV.{hud.level}
                  </span>
                  <span className="text-yellow-300">
                    EXP {hud.exp}/{hud.maxExp}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#0B1221] border border-slate-700 group-hover:border-yellow-400 overflow-hidden flex">
                  <div
                    className="h-full bg-yellow-400 transition-transform duration-150 origin-left"
                    style={{
                      width: `${expPct}%`,
                      backgroundImage:
                        'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(15,23,42,0.45) 10px, rgba(15,23,42,0.45) 12px)',
                    }}
                  />
                </div>
              </button>

              {/* HP/STAMINA emerald segmented bar */}
              <div className="relative h-5 sm:h-6 w-full bg-[#092216] border-2 border-slate-700 overflow-hidden shadow-[0_2px_0_#020617]">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    hud.fatigued ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${hpPct}%`,
                    backgroundImage:
                      'repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(6,78,59,0.45) 12px, rgba(6,78,59,0.45) 14px)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] sm:text-xs text-white font-bold tabular-nums tracking-wide drop-shadow-[0_1px_0_#05070E]">
                  {hud.fatigued ? 'FATIGUED (50% EXP)' : `HP/STAMINA ${hud.hp}/${hud.maxHp}`}
                </div>
              </div>
            </div>

            {/* Mute & Settings Buttons */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute arcade audio' : 'Mute arcade audio'}
                title={muted ? 'Unmute Sound' : 'Mute Sound'}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border-2 border-slate-600 text-slate-200 transition-colors cursor-pointer shadow-[0_2px_0_#020617]"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                )}
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Open settings"
                title="Settings"
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border-2 border-slate-600 text-slate-200 transition-colors cursor-pointer shadow-[0_2px_0_#020617]"
              >
                <Settings className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Clickable Calendar Action (Fix #8: larger & more legible) */}
          <button
            type="button"
            onClick={onOpenCalendar}
            className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 bg-[#0F172A]/95 hover:bg-slate-800 active:translate-y-0.5 border-2 border-slate-500 hover:border-cyan-400 text-slate-100 font-pixel text-xs sm:text-sm transition-colors cursor-pointer shadow-[0_3px_0_#020617] whitespace-nowrap"
          >
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{nextEventLabel}</span>
          </button>
        </div>
      </div>

      {/* Ongoing AI Split Indicator (Fix #9) */}
      {aiSplitting && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-cyan-950/95 border-2 border-cyan-400 px-4 py-2 font-pixel text-xs text-cyan-200 shadow-lg z-30 animate-pulse">
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>AI SPLITTING ACTIVE QUEST INTO MICRO-STEPS...</span>
        </div>
      )}

      {/* Gentle Toast Banner */}
      {toastMsg && (
        <div className="pointer-events-none absolute top-32 left-1/2 -translate-x-1/2 bg-[#0F172A]/95 border-2 border-yellow-400 px-4 py-2 font-pixel text-xs text-yellow-300 shadow-lg z-30">
          {toastMsg}
        </div>
      )}

      {/* Bottom-Right Control Hint + [i] Info Button (Fix #10) */}
      <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-2.5 z-20">
        <span className="font-pixel text-[10px] sm:text-[11px] text-slate-400/85 tracking-wide hidden sm:inline">
          WASD/Arrows Move · Space Shoot · Hold Space 3s AI Split · Click Targets
        </span>
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="About NeuroForge AI (Beta) and game guide"
          title="About NeuroForge AI (Beta) & Guide"
          className="pointer-events-auto w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#0F172A]/95 hover:bg-slate-800 active:translate-y-0.5 border-2 border-slate-500 hover:border-cyan-400 text-cyan-300 cursor-pointer shadow-[0_2px_0_#020617]"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </>
  );
};
