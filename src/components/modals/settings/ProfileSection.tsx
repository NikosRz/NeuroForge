'use client';

import React from 'react';
import { Volume2 } from 'lucide-react';
import { arcadeAudio } from '@/lib/arcadeAudio';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ProfileSectionProps {
  name: string;
  onNameChange: (val: string) => void;
  weeklyXpGoal: number;
  onWeeklyXpGoalChange: (val: number) => void;
  restDays: number[];
  onToggleRestDay: (dayIdx: number) => void;
  muted: boolean;
  onMutedChange: (val: boolean) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  name,
  onNameChange,
  weeklyXpGoal,
  onWeeklyXpGoalChange,
  restDays,
  onToggleRestDay,
  muted,
  onMutedChange,
}) => {
  const handleTestSfx = (): void => {
    const prevMuted = arcadeAudio.isMuted();
    arcadeAudio.setMuted(false);
    arcadeAudio.unlock();
    arcadeAudio.playCoinChime();
    if (muted && prevMuted) {
      // Restore mute state after preview if checkbox is still checked
      window.setTimeout(() => arcadeAudio.setMuted(true), 300);
    }
  };

  return (
    <section className="bg-[#1E293B] border border-slate-700 p-3.5 space-y-3">
      <h3 className="font-pixel text-xs text-yellow-300">HERO, PACING &amp; AUDIO</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs space-y-1">
          <span className="text-slate-300">Character Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Synced from JIRA on connect"
            className="w-full bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-100"
          />
        </label>

        <label className="block text-xs space-y-1">
          <span className="text-slate-300">Weekly EXP Goal</span>
          <input
            type="number"
            min={50}
            step={50}
            value={weeklyXpGoal}
            onChange={(e) => onWeeklyXpGoalChange(Number(e.target.value) || 600)}
            className="w-full bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-100"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="block text-xs text-slate-300">Rest Days (100 HP recovery)</span>
          <div className="flex gap-1">
            {WEEKDAYS.map((day, idx) => (
              <button
                key={day}
                type="button"
                onClick={() => onToggleRestDay(idx)}
                className={`px-2 py-1 font-pixel text-[10px] border cursor-pointer ${
                  restDays.includes(idx)
                    ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                    : 'bg-slate-900 border-slate-600 text-slate-400'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => {
                const next = e.target.checked;
                onMutedChange(next);
                arcadeAudio.setMuted(next);
              }}
              className="accent-cyan-400"
            />
            <span>Mute SFX</span>
          </label>
          <button
            type="button"
            onClick={handleTestSfx}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-600 font-pixel text-[10px] cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test SFX</span>
          </button>
        </div>
      </div>
    </section>
  );
};
