'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkBossCompletionAction, splitQuestAction } from '@/app/actions/jira';
import { getCalendarEventsAction } from '@/app/actions/roadmap-calendar';
import { saveSettingsAction, triggerBoostAction } from '@/app/actions/rpg';
import {
  BOSS_TAUNTS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  STATIONS,
  createAcidBubbles,
  createStars,
  drawBackground,
  drawBoss,
  drawEffects,
  drawHero,
  drawPlatformsAndAcid,
  drawRobotPortrait,
  drawStations,
  type BossState,
  type FloatingText,
  type HeroState,
  type InteractTargetId,
  type LaserBolt,
  type LevelUpBanner,
  type Particle,
  type StationId,
} from '@/lib/arcade';
import { arcadeAudio } from '@/lib/arcadeAudio';
import type { CalendarEvent, HydratedState } from '@/lib/types';
import { ArcadeHud, type HudSnapshot } from './arcade/ArcadeHud';
import { ArcadeModals, type ModalKind } from './arcade/ArcadeModals';
import {
  getCanvasPoint,
  getNearestStation,
  getSurfaceTier,
  hitTestTarget,
  spawnParticlesInto,
  stepArcadeSimulation,
  type KeyState,
  type SimulationTimers,
} from './arcade/simulation';

const CALENDAR_POLL_INTERVAL_MS = 5 * 60_000;
const CHARGE_START_DELAY_S = 0.25;
const CHARGE_FULL_DURATION_S = 3.0;

const toHudSnapshot = (state: HydratedState): HudSnapshot => ({
  level: state.stats.level,
  exp: state.stats.currentLevelXp,
  maxExp: state.stats.nextLevelXp,
  hp: state.stats.stamina,
  maxHp: state.stats.maxStamina,
  fatigued: state.stats.fatigued,
});

const hasPendingSplitSteps = (state: HydratedState): boolean => {
  const key = state.activeQuest?.key;
  if (!key) return false;
  return state.microSteps.some((step) => step.jira_issue_key === key && step.done === 0);
};

interface ArcadeStageProps {
  initialState: HydratedState;
}

export const ArcadeStage: React.FC<ArcadeStageProps> = ({ initialState }) => {
  const [gameState, setGameState] = useState<HydratedState>(initialState);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(initialState.nextEvent);
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [aiSplitting, setAiSplitting] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(initialState.profile.muted);
  const [cursorPointer, setCursorPointer] = useState<boolean>(false);

  // All refs declared upfront before any effects
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const portraitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<HydratedState>(initialState);
  const activeModalRef = useRef<ModalKind>(null);
  const aiSplittingRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const openTabTimerRef = useRef<number | null>(null);

  const engagedQuestKeysRef = useRef<Set<string>>(new Set());
  const bossCheckInFlightRef = useRef<boolean>(false);
  const spaceHoldRef = useRef<{ active: boolean; elapsed: number; firedCharged: boolean }>({
    active: false,
    elapsed: 0,
    firedCharged: false,
  });

  const heroRef = useRef<HeroState>({
    x: 782,
    y: 574,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    dropTimer: 0,
    shootAnimTimer: 0,
    runCycle: 0,
    hurtTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    chargeProgress: 0,
  });

  const bossRef = useRef<BossState>({
    x: 1126,
    y: 574,
    hp: 100,
    maxHp: 100,
    hitFlashTimer: 0,
    shakeTimer: 0,
    shieldFlashTimer: 0,
    defeated: false,
    respawnTimer: 0,
    tauntIndex: 0,
    tauntTimer: 0,
    overrideTaunt: null,
    overrideTauntTimer: 0,
    hitX: 1060,
    hitY: 416,
    hitW: 132,
    hitH: 158,
  });

  const keysRef = useRef<KeyState>({ left: false, right: false, up: false, down: false });
  const timersRef = useRef<SimulationTimers>({
    shootCooldown: 0,
    acidCooldown: 0,
    boostPulseTimer: 0,
    shakeTimer: 0,
    shakeMagnitude: 0,
    bossCheckCooldown: 0,
  });
  const hitstopTimerRef = useRef<number>(0);
  const hoveredTargetRef = useRef<InteractTargetId | null>(null);
  const lasersRef = useRef<LaserBolt[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const bannerRef = useRef<LevelUpBanner>({
    active: false,
    level: initialState.stats.level,
    timer: 0,
    maxTimer: 2.4,
  });
  const starsRef = useRef(createStars());
  const acidBubblesRef = useRef(createAcidBubbles());

  // Sync portrait badge once on mount
  useEffect(() => {
    if (portraitCanvasRef.current) {
      drawRobotPortrait(portraitCanvasRef.current);
    }
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (openTabTimerRef.current !== null) {
        window.clearTimeout(openTabTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    activeModalRef.current = activeModal;
    if (activeModal !== null) {
      spaceHoldRef.current = { active: false, elapsed: 0, firedCharged: false };
      heroRef.current.chargeProgress = 0;
    }
  }, [activeModal]);

  useEffect(() => {
    gameStateRef.current = gameState;
    setMuted(gameState.profile.muted);
    arcadeAudio.setMuted(gameState.profile.muted);

    // Sync Boss HP bar with completed vs total micro-steps
    if (gameState.activeQuest && gameState.microSteps.length > 0) {
      const doneCount = gameState.microSteps.filter((s) => s.done === 1).length;
      const pct = Math.round(
        ((gameState.microSteps.length - doneCount) / gameState.microSteps.length) * 100
      );
      bossRef.current.hp = Math.max(5, pct);
    } else {
      bossRef.current.hp = 100;
    }
  }, [gameState]);

  const showToast = useCallback((msg: string, durationMs = 3400): void => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const refreshState = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const next = (await res.json()) as HydratedState;
      setGameState(next);
    } catch {
      // Keep current state if transient refresh fails.
    }
  }, []);

  // Independent Calendar polling (Fix #11: decoupled from /api/state)
  const refreshCalendar = useCallback(async (): Promise<void> => {
    try {
      const res = await getCalendarEventsAction();
      setNextEvent(res.nextEvent);
    } catch {
      // Keep last known event on transient network error.
    }
  }, []);

  useEffect(() => {
    void refreshCalendar();
    const intervalId = window.setInterval(() => {
      void refreshCalendar();
    }, CALENDAR_POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshCalendar]);

  const spawnFloatingText = useCallback(
    (x: number, y: number, text: string, color = '#FACC15'): void => {
      floatingTextsRef.current.push({
        x,
        y,
        vy: -215,
        text,
        color,
        life: 1.45,
        maxLife: 1.45,
      });
    },
    []
  );

  const triggerLevelUpBanner = useCallback((newLevel: number): void => {
    bannerRef.current = {
      active: true,
      level: newLevel,
      timer: 2.4,
      maxTimer: 2.4,
    };
    arcadeAudio.playLevelUp();

    const hero = heroRef.current;
    spawnParticlesInto(
      particlesRef.current,
      hero.x,
      hero.y - 36,
      24,
      ['#FACC15', '#FEF08A', '#22D3EE', '#FFFFFF'],
      90,
      300,
      420,
      4,
      7,
      0.5,
      1.0,
      'coin',
      140
    );
  }, []);

  const triggerBossDefeat = useCallback(
    (xpLabel?: string): void => {
      const boss = bossRef.current;
      boss.defeated = true;
      boss.hp = 0;
      boss.respawnTimer = 3.2;
      boss.overrideTaunt = null;
      boss.overrideTauntTimer = 0;

      hitstopTimerRef.current = 0.06;
      timersRef.current.shakeTimer = 0.42;
      timersRef.current.shakeMagnitude = 11;

      arcadeAudio.playBossDefeat();

      spawnParticlesInto(
        particlesRef.current,
        boss.x,
        boss.y - 72,
        48,
        ['#EF4444', '#F97316', '#FACC15', '#FFFFFF', '#94A3B8'],
        80,
        440,
        520,
        5,
        11,
        0.45,
        1.1,
        'explosion',
        110
      );

      spawnParticlesInto(
        particlesRef.current,
        boss.x,
        boss.y - 90,
        18,
        ['#FACC15', '#FEF08A', '#EAB308'],
        70,
        260,
        680,
        6,
        8,
        0.7,
        1.35,
        'coin',
        210
      );

      if (xpLabel) {
        spawnFloatingText(boss.x, boss.y - 140, xpLabel, '#FACC15');
      }
    },
    [spawnFloatingText]
  );

  const activateStation = useCallback(
    (stationId: StationId): void => {
      const st = STATIONS.find((s) => s.id === stationId);
      if (!st) return;

      if (stationId === 'mind-dump') {
        arcadeAudio.playStationActivate();
        spawnParticlesInto(
          particlesRef.current,
          st.x,
          st.y - 72,
          16,
          ['#22D3EE', '#67E8F9', '#ECFEFF'],
          60,
          200,
          180,
          4,
          6,
          0.35,
          0.75,
          'spark',
          80
        );
        setActiveModal('mind-dump');
      } else if (stationId === 'quest-board') {
        arcadeAudio.playStationActivate();
        spawnParticlesInto(
          particlesRef.current,
          st.x,
          st.y - 78,
          16,
          ['#2DD4BF', '#5EEAD4', '#FFFFFF'],
          60,
          200,
          180,
          4,
          6,
          0.35,
          0.75,
          'spark',
          80
        );
        setActiveModal('quest-board');
      } else if (stationId === 'energy-boost') {
        void (async () => {
          const res = await triggerBoostAction();
          if (!res.success) {
            arcadeAudio.playUiClick();
            showToast(res.reason ?? res.error ?? 'Energy Core Boost unavailable.');
            return;
          }
          arcadeAudio.playEnergyBoost();
          timersRef.current.boostPulseTimer = 0.85;
          spawnFloatingText(st.x, st.y - 115, '100 HP BOOST!', '#4ADE80');
          spawnParticlesInto(
            particlesRef.current,
            st.x,
            st.y - 68,
            22,
            ['#4ADE80', '#22C55E', '#FACC15', '#FEF08A'],
            80,
            240,
            220,
            4,
            7,
            0.4,
            0.9,
            'spark',
            100
          );
          await refreshState();
        })();
      } else if (stationId === 'roadmap') {
        arcadeAudio.playStationActivate();
        spawnParticlesInto(
          particlesRef.current,
          st.x,
          st.y - 68,
          18,
          ['#22D3EE', '#A5F3FC', '#4ADE80'],
          60,
          210,
          160,
          4,
          6,
          0.35,
          0.8,
          'spark',
          90
        );
        setActiveModal('roadmap');
      }
    },
    [refreshState, showToast, spawnFloatingText]
  );

  // Charged AI Task Split (>3s Spacebar hold, Fix #9)
  const triggerChargedAiSplit = useCallback(async (): Promise<void> => {
    const activeQuest = gameStateRef.current.activeQuest;
    if (!activeQuest) {
      showToast('Pin a JIRA quest first [B] to use Charged AI Split!');
      return;
    }
    if (aiSplittingRef.current) return;

    aiSplittingRef.current = true;
    setAiSplitting(true);
    try {
      const res = await splitQuestAction({
        jiraIssueKey: activeQuest.key,
        summary: activeQuest.summary,
      });
      if (res.error) {
        showToast(res.error, 5500);
        return;
      }
      arcadeAudio.playCoinChime();
      spawnFloatingText(
        bossRef.current.x,
        bossRef.current.y - 135,
        `+${res.steps.length} MICRO-STEPS!`,
        '#22D3EE'
      );
      showToast(`AI split ${activeQuest.key} into ${res.steps.length} micro-steps — shoot Boss to open Quest!`);
      await refreshState();
    } finally {
      aiSplittingRef.current = false;
      setAiSplitting(false);
    }
  }, [refreshState, showToast, spawnFloatingText]);

  const shootLaser = useCallback(
    (charged = false): void => {
      if (!charged && timersRef.current.shootCooldown > 0) return;

      const hero = heroRef.current;
      const activeQuest = gameStateRef.current.activeQuest;
      const openQuestOnHit = !charged && hasPendingSplitSteps(gameStateRef.current);
      let skipStatusCheck = false;

      // Fix #1: 1st shot on a pinned quest opens JIRA in a new tab after a 500ms shot delay
      // (skipped when the quest is already split with pending micro-steps, since shooting opens QuestModal)
      if (
        !charged &&
        !openQuestOnHit &&
        activeQuest?.url &&
        !engagedQuestKeysRef.current.has(activeQuest.key)
      ) {
        const targetUrl = activeQuest.url;
        engagedQuestKeysRef.current.add(activeQuest.key);
        skipStatusCheck = true;
        showToast(`Opening ${activeQuest.key} in JIRA — shoot Boss again once completed!`);
        if (openTabTimerRef.current !== null) {
          window.clearTimeout(openTabTimerRef.current);
        }
        openTabTimerRef.current = window.setTimeout(() => {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
          openTabTimerRef.current = null;
        }, 500);
      }

      timersRef.current.shootCooldown = 0.16;
      hero.shootAnimTimer = charged ? 0.28 : 0.14;

      if (charged) {
        hero.facing = hero.x <= bossRef.current.x ? 1 : -1;
      }

      const muzzleX = hero.x + hero.facing * 42;
      const muzzleY = hero.y - 40;
      lasersRef.current.push({
        x: muzzleX,
        y: muzzleY,
        vx: (charged ? 1180 : 980) * hero.facing,
        dir: hero.facing,
        life: 1.5,
        charged,
        skipStatusCheck,
      });

      if (charged) {
        arcadeAudio.playEnergyBoost();
        timersRef.current.shakeTimer = 0.22;
        timersRef.current.shakeMagnitude = 7;
      } else {
        arcadeAudio.playLaser();
      }

      spawnParticlesInto(
        particlesRef.current,
        muzzleX,
        muzzleY,
        charged ? 18 : 6,
        charged ? ['#22D3EE', '#FACC15', '#FFFFFF'] : ['#FEF08A', '#4ADE80', '#22D3EE'],
        40,
        charged ? 260 : 140,
        0,
        3,
        charged ? 7 : 5,
        0.14,
        charged ? 0.45 : 0.24,
        'spark'
      );
    },
    [showToast]
  );

  // Fix #1: Boss hit handler — zero client XP/HP drain; queries real JIRA status on engaged quests
  const handleLaserHitBoss = useCallback(
    (bolt: LaserBolt): void => {
      const boss = bossRef.current;
      const activeQuest = gameStateRef.current.activeQuest;

      if (bolt.charged) {
        arcadeAudio.playEnemyHit();
        boss.hitFlashTimer = 0.16;
        boss.shakeTimer = 0.3;
        spawnParticlesInto(
          particlesRef.current,
          bolt.x,
          bolt.y,
          24,
          ['#22D3EE', '#67E8F9', '#FACC15', '#FFFFFF'],
          90,
          340,
          280,
          4,
          8,
          0.25,
          0.6,
          'spark',
          60
        );
        return;
      }

      if (!aiSplittingRef.current && hasPendingSplitSteps(gameStateRef.current)) {
        arcadeAudio.playStationActivate();
        boss.hitFlashTimer = 0.14;
        boss.shakeTimer = 0.16;
        spawnParticlesInto(
          particlesRef.current,
          bolt.x,
          bolt.y,
          16,
          ['#22D3EE', '#FEF08A', '#FFFFFF'],
          70,
          240,
          240,
          3,
          6,
          0.18,
          0.42,
          'spark',
          50
        );
        setActiveModal('quest');
        return;
      }

      if (bolt.skipStatusCheck) {
        boss.shieldFlashTimer = 0.3;
        spawnParticlesInto(
          particlesRef.current,
          bolt.x,
          bolt.y,
          10,
          ['#22D3EE', '#A5F3FC', '#FFFFFF'],
          60,
          200,
          260,
          3,
          6,
          0.18,
          0.4,
          'spark',
          40
        );
        return;
      }

      if (!activeQuest) {
        boss.shieldFlashTimer = 0.45;
        boss.overrideTaunt = 'Pin a quest from Console [B] first!';
        boss.overrideTauntTimer = 3.0;
        arcadeAudio.playUiClick();
        return;
      }

      // Shield deflect visual immediately; avoid spamming JIRA if in-flight or cooling down
      boss.shieldFlashTimer = 0.45;
      boss.shakeTimer = 0.16;
      spawnParticlesInto(
        particlesRef.current,
        bolt.x,
        bolt.y,
        12,
        ['#22D3EE', '#67E8F9', '#FFFFFF'],
        80,
        260,
        320,
        3,
        6,
        0.2,
        0.45,
        'spark',
        50
      );

      if (bossCheckInFlightRef.current || timersRef.current.bossCheckCooldown > 0) {
        arcadeAudio.playUiClick();
        return;
      }

      bossCheckInFlightRef.current = true;
      timersRef.current.bossCheckCooldown = 1.5;

      void (async () => {
        try {
          const res = await checkBossCompletionAction(activeQuest.key);
          if (!res.ok) {
            showToast(res.error ?? 'Could not verify JIRA status.');
            return;
          }

          if (res.completed) {
            engagedQuestKeysRef.current.delete(activeQuest.key);
            const xp = res.xpResult?.awardedXp ?? 0;
            const xpLabel =
              res.xpResult?.duplicate || xp <= 0 ? 'QUEST CLEARED!' : `+${xp} XP!`;
            triggerBossDefeat(xpLabel);
            if (res.xpResult?.leveledUp) {
              triggerLevelUpBanner(res.xpResult.newLevel);
            }
            await refreshState();
            return;
          }

          arcadeAudio.playUiClick();
          boss.shieldFlashTimer = 0.55;
          boss.overrideTaunt = res.currentStatus
            ? `HaHa, you need to finish the task first! (${res.currentStatus})`
            : 'HaHa, you need to finish the task first!';
          boss.overrideTauntTimer = 3.8;
        } finally {
          bossCheckInFlightRef.current = false;
        }
      })();
    },
    [refreshState, showToast, triggerBossDefeat, triggerLevelUpBanner]
  );

  const handleToggleMute = useCallback((): void => {
    arcadeAudio.unlock();
    const next = !arcadeAudio.isMuted();
    arcadeAudio.setMuted(next);
    setMuted(next);
    if (!next) {
      arcadeAudio.playUiClick();
    }
    void saveSettingsAction({ profile: { muted: next } });
  }, []);

  const handleOpenCalendar = useCallback((): void => {
    arcadeAudio.unlock();
    arcadeAudio.playStationActivate();
    setActiveModal('calendar');
  }, []);

  const handleOpenSettings = useCallback((): void => {
    arcadeAudio.unlock();
    arcadeAudio.playUiClick();
    setActiveModal('settings');
  }, []);

  const handleOpenInfo = useCallback((): void => {
    arcadeAudio.unlock();
    arcadeAudio.playUiClick();
    setActiveModal('info');
  }, []);

  const handleXpCelebration = useCallback(
    (_amount: number, label: string, leveledUp = false, newLevel?: number): void => {
      spawnFloatingText(bossRef.current.x, bossRef.current.y - 118, label, '#FACC15');
      if (leveledUp && typeof newLevel === 'number') {
        triggerLevelUpBanner(newLevel);
      }
    },
    [spawnFloatingText, triggerLevelUpBanner]
  );

  // Keyboard bindings & window blur safety (with Modal Keyboard Lock)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (activeModalRef.current !== null) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setActiveModal(null);
        }
        return;
      }

      arcadeAudio.unlock();
      const key = e.key.toLowerCase();

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      if (key === 'a' || key === 'arrowleft') {
        keysRef.current.left = true;
      } else if (key === 'd' || key === 'arrowright') {
        keysRef.current.right = true;
      } else if (key === 'w' || key === 'arrowup') {
        if (!keysRef.current.up) {
          heroRef.current.jumpBufferTimer = 0.12;
        }
        keysRef.current.up = true;
      } else if (key === 's' || key === 'arrowdown') {
        keysRef.current.down = true;
        const hero = heroRef.current;
        if (hero.onGround && getSurfaceTier(hero.y) > 1) {
          hero.dropTimer = 0.24;
          hero.onGround = false;
        }
      } else if (key === ' ' && !e.repeat) {
        const near = getNearestStation(heroRef.current);
        if (near) {
          activateStation(near);
        } else {
          spaceHoldRef.current = { active: true, elapsed: 0, firedCharged: false };
        }
      } else if (key === 'e' && !e.repeat) {
        const near = getNearestStation(heroRef.current);
        if (near) {
          activateStation(near);
        } else if (gameStateRef.current.activeQuest) {
          setActiveModal('quest');
        } else {
          shootLaser(false);
        }
      } else if (key === 'm' && !e.repeat) {
        activateStation('mind-dump');
      } else if (key === 'b' && !e.repeat) {
        activateStation('quest-board');
      } else if (key === 'r' && !e.repeat) {
        activateStation('roadmap');
      } else if (key === 'c' && !e.repeat) {
        handleOpenCalendar();
      } else if (process.env.NODE_ENV === 'development' && key === 'k' && !e.repeat) {
        triggerBossDefeat('DEV DEFEAT!');
      } else if (process.env.NODE_ENV === 'development' && key === 'l' && !e.repeat) {
        triggerLevelUpBanner(gameStateRef.current.stats.level + 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'arrowleft') {
        keysRef.current.left = false;
      } else if (key === 'd' || key === 'arrowright') {
        keysRef.current.right = false;
      } else if (key === 'w' || key === 'arrowup') {
        keysRef.current.up = false;
        if (heroRef.current.vy < -260) {
          heroRef.current.vy *= 0.62;
        }
      } else if (key === 's' || key === 'arrowdown') {
        keysRef.current.down = false;
      } else if (key === ' ') {
        const hold = spaceHoldRef.current;
        arcadeAudio.stopGunCharge();
        if (hold.active && !hold.firedCharged && activeModalRef.current === null) {
          shootLaser(false);
        }
        spaceHoldRef.current = { active: false, elapsed: 0, firedCharged: false };
        heroRef.current.chargeProgress = 0;
      }
    };

    const onBlur = (): void => {
      keysRef.current = { left: false, right: false, up: false, down: false };
      spaceHoldRef.current = { active: false, elapsed: 0, firedCharged: false };
      heroRef.current.chargeProgress = 0;
      arcadeAudio.stopGunCharge();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    activateStation,
    handleOpenCalendar,
    shootLaser,
    triggerBossDefeat,
    triggerLevelUpBanner,
  ]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const pt = getCanvasPoint(canvasRef.current, e.clientX, e.clientY);
    if (!pt) return;
    const hit = hitTestTarget(pt.x, pt.y, bossRef.current);
    hoveredTargetRef.current = hit;
    setCursorPointer(hit !== null);
  };

  const handleCanvasMouseLeave = (): void => {
    hoveredTargetRef.current = null;
    setCursorPointer(false);
  };

  // Fix #3: Instant click activation on all arcade screen elements (no auto-pilot walking)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    arcadeAudio.unlock();
    const pt = getCanvasPoint(canvasRef.current, e.clientX, e.clientY);
    if (!pt) return;

    const hit = hitTestTarget(pt.x, pt.y, bossRef.current);
    if (!hit) return;

    if (hit === 'boss') {
      arcadeAudio.playStationActivate();
      setActiveModal(gameStateRef.current.activeQuest ? 'quest' : 'quest-board');
      return;
    }

    activateStation(hit);
  };

  // Main 60fps requestAnimationFrame Simulation & Render Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const render = (now: number): void => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      elapsed += dt;

      // Update Spacebar >3s charged shot buildup
      const hold = spaceHoldRef.current;
      if (hold.active && !hold.firedCharged && activeModalRef.current === null) {
        hold.elapsed += dt;
        if (hold.elapsed >= CHARGE_START_DELAY_S && gameStateRef.current.activeQuest) {
          arcadeAudio.startGunCharge(CHARGE_FULL_DURATION_S - CHARGE_START_DELAY_S);
          heroRef.current.chargeProgress = Math.min(
            1,
            (hold.elapsed - CHARGE_START_DELAY_S) /
              (CHARGE_FULL_DURATION_S - CHARGE_START_DELAY_S)
          );
        }
        if (hold.elapsed >= CHARGE_FULL_DURATION_S) {
          hold.firedCharged = true;
          heroRef.current.chargeProgress = 0;
          arcadeAudio.stopGunCharge();
          shootLaser(true);
          void triggerChargedAiSplit();
        }
      } else {
        heroRef.current.chargeProgress = 0;
        arcadeAudio.stopGunCharge();
      }

      if (hitstopTimerRef.current > 0) {
        hitstopTimerRef.current = Math.max(0, hitstopTimerRef.current - dt);
      } else {
        const stepOut = stepArcadeSimulation({
          dt,
          hero: heroRef.current,
          boss: bossRef.current,
          keys: keysRef.current,
          timers: timersRef.current,
          lasers: lasersRef.current,
          particles: particlesRef.current,
          floatingTexts: floatingTextsRef.current,
          banner: bannerRef.current,
          tauntCount: gameStateRef.current.taunts.length,
          onLaserHitBoss: handleLaserHitBoss,
        });
        lasersRef.current = stepOut.nextLasers;
        particlesRef.current = stepOut.nextParticles;
        floatingTextsRef.current = stepOut.nextTexts;

        // Emit flying electric sparks off the robot while local AI is splitting the quest
        if (aiSplittingRef.current && !bossRef.current.defeated && Math.random() < dt * 28) {
          spawnParticlesInto(
            particlesRef.current,
            bossRef.current.x + (Math.random() - 0.5) * 92,
            bossRef.current.y - 24 - Math.random() * 124,
            2,
            ['#22D3EE', '#67E8F9', '#FEF08A', '#FFFFFF'],
            60,
            210,
            180,
            3,
            5,
            0.12,
            0.32,
            'spark',
            40
          );
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;

        let shakeX = 0;
        let shakeY = 0;
        if (timersRef.current.shakeTimer > 0) {
          const mag = timersRef.current.shakeMagnitude * (timersRef.current.shakeTimer / 0.42);
          shakeX = Math.round((Math.random() * 2 - 1) * mag);
          shakeY = Math.round((Math.random() * 2 - 1) * mag);
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        drawBackground(ctx, elapsed, starsRef.current);
        drawPlatformsAndAcid(ctx, elapsed, acidBubblesRef.current);

        const near = getNearestStation(heroRef.current);
        drawStations(
          ctx,
          elapsed,
          hoveredTargetRef.current,
          near,
          timersRef.current.boostPulseTimer
        );

        const activeQuest = gameStateRef.current.activeQuest;
        const taunts = gameStateRef.current.taunts.length
          ? gameStateRef.current.taunts
          : BOSS_TAUNTS;
        const bossLabel = activeQuest
          ? `${activeQuest.key}: ${activeQuest.summary}`
          : 'BASE CAMP — NO QUEST';
        const tauntText = activeQuest
          ? taunts[bossRef.current.tauntIndex % taunts.length]
          : 'Open Console [B] or Settings [⚙]!';

        drawBoss(
          ctx,
          bossRef.current,
          hoveredTargetRef.current === 'boss',
          elapsed,
          bossLabel,
          tauntText,
          aiSplittingRef.current
        );
        drawHero(ctx, heroRef.current, elapsed);
        drawEffects(
          ctx,
          lasersRef.current,
          particlesRef.current,
          floatingTextsRef.current,
          bannerRef.current
        );

        ctx.restore();
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      arcadeAudio.stopGunCharge();
      window.cancelAnimationFrame(rafId);
    };
  }, [handleLaserHitBoss, shootLaser, triggerChargedAiSplit]);

  const hud = toHudSnapshot(gameState);

  return (
    <div className="w-screen h-screen bg-[#05070E] flex items-center justify-center p-2 sm:p-4 select-none overflow-hidden">
      <div className="relative w-full max-w-[1280px] aspect-video bg-[#05070E] border-2 border-slate-800 shadow-2xl overflow-hidden">
        {/* Main 1280x720 Pixel Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          onClick={handleCanvasClick}
          className={`w-full h-full block pixelated ${
            cursorPointer ? 'cursor-pointer' : 'cursor-crosshair'
          }`}
        />

        <ArcadeHud
          profileName={gameState.profile.name}
          hud={hud}
          muted={muted}
          nextEvent={nextEvent}
          toastMsg={toastMsg}
          aiSplitting={aiSplitting}
          portraitCanvasRef={portraitCanvasRef}
          onToggleMute={handleToggleMute}
          onOpenSettings={handleOpenSettings}
          onOpenCalendar={handleOpenCalendar}
          onOpenStats={() => setActiveModal('stats')}
          onOpenInfo={handleOpenInfo}
        />

        <ArcadeModals
          activeModal={activeModal}
          gameState={gameState}
          onClose={() => setActiveModal(null)}
          onOpenSettings={() => setActiveModal('settings')}
          onRefresh={refreshState}
          onCalendarRefresh={refreshCalendar}
          onNextEventLoaded={setNextEvent}
          onXpCelebration={handleXpCelebration}
        />
      </div>
    </div>
  );
};
