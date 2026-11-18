'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ArcadeModalShell } from './ArcadeModalShell';

interface InfoModalProps {
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => (
  <ArcadeModalShell
    title="ABOUT NEUROFORGE"
    subtitle="Self-hosted 16-bit Arcade JIRA RPG built for ADHD-friendly focus."
    accentColor="cyan"
    maxWidthClass="max-w-2xl"
    onClose={onClose}
    footer={
      <div className="text-center space-y-1 text-xs text-slate-300">
        <p className="font-semibold text-slate-100">
          Designed and developed by Nikos Rzewucki
        </p>
        <p className="font-mono-code text-xs text-cyan-300 flex items-center justify-center gap-2 flex-wrap">
          <a
            href="https://www.nikos.click"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <span>www.nikos.click</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-500">,</span>
          <a
            href="https://github.com/NikosRz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <span>https://github.com/NikosRz</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
    }
  >
    <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
      <section className="space-y-1.5">
        <h3 className="font-pixel text-xs text-yellow-300">WHAT IS NEUROFORGE?</h3>
        <p>
          NeuroForge turns your real JIRA backlog into a single-focus 16-bit arcade room. Pin one
          active task as your <strong>Boss Robot</strong>, break overwhelming tickets into tiny
          micro-steps with local AI (Ollama), and earn zero-guilt RPG progression without leaving
          your local machine.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-pixel text-xs text-cyan-300">CORE GAME &amp; PRODUCTIVITY MECHANICS</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <strong className="text-slate-100">Boss Combat &amp; Real JIRA Loop:</strong> Shooting
            the Boss the <strong>first time</strong> opens the pinned ticket directly in JIRA.
            Complete the task in JIRA, then shoot the Boss again — NeuroForge checks the live JIRA
            status against your configured Completed Statuses. If it&apos;s done, the Boss explodes
            and awards real persisted XP! If not, the laser deflects off its shield.
          </li>
          <li>
            <strong className="text-slate-100">Charged AI Split (Hold Spacebar &gt; 3s):</strong>{' '}
            Hold <code>Space</code> for 3 seconds to charge your blaster and fire a super-shot that
            splits the active quest into 3–5 concrete micro-steps via local Ollama AI.
          </li>
          <li>
            <strong className="text-slate-100">XP, Levels &amp; Battle Turns:</strong> Earn XP by
            checking off micro-steps (+15 XP), completing 15m/25m Battle Turn focus timers (+25 XP),
            and defeating JIRA Bosses (+50 XP). Missed days never deduct XP.
          </li>
          <li>
            <strong className="text-slate-100">HP / Stamina &amp; Rest Days:</strong> Every action
            uses stamina to encourage healthy pacing. Rest days recover 100 HP automatically, and
            hitting your weekly XP goal earns Streak Shields. Grab the <strong>Energy Core</strong>{' '}
            (once per week) for an instant 100 HP boost.
          </li>
          <li>
            <strong className="text-slate-100">Command Stations:</strong> Click any station or use
            hotkeys — <strong>Quest Board [B]</strong> to pin a JIRA Boss,{' '}
            <strong>Mind-Dump [M]</strong> to capture stray thoughts &amp; match 5/15/30m quick
            tasks with AI, <strong>Holo-Radar Roadmap [R]</strong> for milestones, and{' '}
            <strong>Calendar [C]</strong> for your <code>.ics</code> schedule anchor.
          </li>
        </ul>
      </section>

      <section className="bg-[#0B1221] border border-slate-700 p-3 space-y-1">
        <h3 className="font-pixel text-xs text-emerald-300">CONTROLS</h3>
        <p className="font-mono-code text-xs text-slate-300">
          WASD / Arrows: Move &amp; Jump · S / Down: Drop · Space / E: Shoot or Activate · Hold
          Space (3s): Charged AI Split · Click any station or Boss to open immediately · M / B / R /
          C: Quick Open · ESC: Close Modal
        </p>
      </section>
    </div>
  </ArcadeModalShell>
);
