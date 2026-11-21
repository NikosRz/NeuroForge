export type StationId = 'mind-dump' | 'quest-board' | 'energy-boost' | 'roadmap';
export type InteractTargetId = StationId | 'boss' | 'boss-plate';
export type BossPhase = 'normal' | 'micro-wave' | 'exposed-core';

export interface BossMicroProgress {
  total: number;
  done: number;
  remaining: number;
  currentIndex: number;
}

export interface MicroBotState {
  activeStepId: number | null;
  x: number;
  y: number;
  spawnTimer: number;
  graceTimer: number;
  hitFlashTimer: number;
  shakeTimer: number;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

export interface PlatformRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay: boolean;
}

export interface StationDef {
  id: StationId;
  label: string;
  hotkey: string;
  x: number; // Center X
  y: number; // Surface Y it sits on
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
  tier: 1 | 2 | 3;
}

export interface HeroState {
  x: number; // Center X
  y: number; // Feet Y
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  dropTimer: number;
  shootAnimTimer: number;
  runCycle: number;
  hurtTimer: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  chargeProgress: number; // 0..1 for >3s Spacebar AI Split charged shot
}

export interface BossState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  shakeTimer: number;
  shieldFlashTimer: number;
  defeated: boolean;
  respawnTimer: number;
  tauntIndex: number;
  tauntTimer: number;
  overrideTaunt: string | null;
  overrideTauntTimer: number;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

export interface LaserBolt {
  x: number;
  y: number;
  vx: number;
  dir: 1 | -1;
  life: number;
  charged?: boolean;
  skipStatusCheck?: boolean;
}

export type ParticleKind = 'spark' | 'acid' | 'explosion' | 'coin' | 'dust';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  kind: ParticleKind;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LevelUpBanner {
  active: boolean;
  level: number;
  timer: number;
  maxTimer: number;
}

export interface StarDot {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  color: string;
  cross: boolean;
}

export interface AcidBubble {
  x: number;
  y: number;
  vy: number;
  r: number;
  phase: number;
}
