'use client';

import React from 'react';
import { Award, Flame, Shield, Swords, Zap } from 'lucide-react';
import type { RpgStatsSnapshot } from '@/lib/types';
import { ArcadeModalShell } from './ArcadeModalShell';

interface StatsModalProps {
  stats: RpgStatsSnapshot;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ stats, onClose }) => {
  const weeklyPct = Math.min(100, Math.round((stats.weeklyXp / Math.max(1, stats.weeklyXpGoal)) * 100));

  return (
    <ArcadeModalShell
      title="COMMANDO STATS & STREAKS"
      subtitle="Zero-guilt progress — missed days never deduct XP."
      accentColor="yellow"
      onClose={onClose}
    >
      {/* Weekly EXP */}
      <div className="bg-[#0B1221] border border-slate-700 p-3 space-y-2">
        <div className="flex items-center justify-between font-pixel text-xs">
          <span className="text-yellow-300">WEEKLY EXP GOAL</span>
          <span className="text-white">
            {stats.weeklyXp} / {stats.weeklyXpGoal} XP ({weeklyPct}%)
          </span>
        </div>
        <div className="h-3 w-full bg-slate-900 border border-slate-700 overflow-hidden">
          <div className="h-full bg-yellow-400" style={{ width: `${weeklyPct}%` }} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-[#1E293B] border border-slate-700 p-3">
          <div className="flex items-center gap-1.5 font-pixel text-[11px] text-orange-300">
            <Flame className="w-4 h-4" />
            <span>FOCUS STREAK</span>
          </div>
          <p className="font-arcade text-lg text-white mt-1.5">{stats.streakDays}d</p>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 p-3">
          <div className="flex items-center gap-1.5 font-pixel text-[11px] text-cyan-300">
            <Shield className="w-4 h-4" />
            <span>STREAK SHIELDS</span>
          </div>
          <p className="font-arcade text-lg text-white mt-1.5">{stats.streakShields} / 3</p>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 p-3">
          <div className="flex items-center gap-1.5 font-pixel text-[11px] text-emerald-300">
            <Award className="w-4 h-4" />
            <span>QUESTS CLEARED</span>
          </div>
          <p className="font-arcade text-lg text-white mt-1.5">{stats.questsCleared}</p>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 p-3">
          <div className="flex items-center gap-1.5 font-pixel text-[11px] text-yellow-300">
            <Swords className="w-4 h-4" />
            <span>BATTLE TURNS</span>
          </div>
          <p className="font-arcade text-lg text-white mt-1.5">{stats.focusTurns}</p>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 p-3">
          <div className="flex items-center gap-1.5 font-pixel text-[11px] text-purple-300">
            <Zap className="w-4 h-4" />
            <span>TOTAL XP</span>
          </div>
          <p className="font-arcade text-lg text-white mt-1.5">{stats.totalXp}</p>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 p-3">
          <div className="font-pixel text-[11px] text-slate-300">ENERGY BOOST</div>
          <p className="font-pixel text-xs text-emerald-300 mt-2">
            {stats.boostActiveToday
              ? 'ACTIVE TODAY (100%)'
              : stats.boostAvailable
                ? 'READY (1/WK)'
                : 'USED THIS WEEK'}
          </p>
        </div>
      </div>
    </ArcadeModalShell>
  );
};
