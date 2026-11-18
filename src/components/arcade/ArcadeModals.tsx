'use client';

import React from 'react';
import { CalendarModal } from '@/components/modals/CalendarModal';
import { InfoModal } from '@/components/modals/InfoModal';
import { MindDumpModal } from '@/components/modals/MindDumpModal';
import { QuestBoardModal } from '@/components/modals/QuestBoardModal';
import { QuestModal } from '@/components/modals/QuestModal';
import { RoadmapModal } from '@/components/modals/RoadmapModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { StatsModal } from '@/components/modals/StatsModal';
import type { CalendarEvent, HydratedState } from '@/lib/types';

export type ModalKind =
  | 'quest'
  | 'mind-dump'
  | 'quest-board'
  | 'roadmap'
  | 'calendar'
  | 'stats'
  | 'settings'
  | 'info'
  | null;

interface ArcadeModalsProps {
  activeModal: ModalKind;
  gameState: HydratedState;
  onClose: () => void;
  onOpenSettings: () => void;
  onRefresh: () => Promise<void>;
  onCalendarRefresh: () => Promise<void>;
  onNextEventLoaded: (nextEvent: CalendarEvent | null) => void;
  onXpCelebration: (amount: number, label: string, leveledUp?: boolean, newLevel?: number) => void;
}

export const ArcadeModals: React.FC<ArcadeModalsProps> = ({
  activeModal,
  gameState,
  onClose,
  onOpenSettings,
  onRefresh,
  onCalendarRefresh,
  onNextEventLoaded,
  onXpCelebration,
}) => {
  if (activeModal === 'quest' && gameState.activeQuest) {
    return (
      <QuestModal
        activeQuest={gameState.activeQuest}
        initialMicroSteps={gameState.microSteps}
        onClose={onClose}
        onRefresh={onRefresh}
        onXpCelebration={onXpCelebration}
      />
    );
  }

  if (activeModal === 'quest-board') {
    return (
      <QuestBoardModal
        jiraConfigured={gameState.jiraConfigured}
        activeQuestKey={gameState.activeQuest?.key ?? null}
        onClose={onClose}
        onOpenSettings={onOpenSettings}
        onRefresh={onRefresh}
      />
    );
  }

  if (activeModal === 'mind-dump') {
    return <MindDumpModal onClose={onClose} />;
  }

  if (activeModal === 'roadmap') {
    return <RoadmapModal onClose={onClose} onRefresh={onRefresh} />;
  }

  if (activeModal === 'calendar') {
    return <CalendarModal onClose={onClose} onNextEventLoaded={onNextEventLoaded} />;
  }

  if (activeModal === 'stats') {
    return <StatsModal stats={gameState.stats} onClose={onClose} />;
  }

  if (activeModal === 'settings') {
    return (
      <SettingsModal
        onClose={onClose}
        onRefresh={onRefresh}
        onCalendarRefresh={onCalendarRefresh}
      />
    );
  }

  if (activeModal === 'info') {
    return <InfoModal onClose={onClose} />;
  }

  return null;
};
