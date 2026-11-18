import type { AcidBubble, PlatformRect, StarDot, StationDef } from './types';

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const BOSS_TAUNTS: ReadonlyArray<string> = [
  "HAHA! I'M WAITING FOR YOU!",
  "I'M UNBREAKABLE!",
  'TOO SCARED TO SPLIT ME?',
  'NICE TRY, HERO!',
  'COME AT ME!',
];

export const ACID_ZONE = {
  x: 0,
  y: 626,
  w: 370,
  h: 94,
  gapXStart: 224,
  gapXEnd: 364,
  triggerY: 600,
} as const;

export const PLATFORMS: ReadonlyArray<PlatformRect> = [
  { id: 'ground-left', x: 0, y: 574, w: 224, h: 32, oneWay: false },
  { id: 'ground-right', x: 364, y: 574, w: 916, h: 146, oneWay: false },
  { id: 'mid-bridge', x: 132, y: 360, w: 636, h: 34, oneWay: true },
  { id: 'upper-ledge', x: 0, y: 256, w: 348, h: 104, oneWay: true },
];

export const STATIONS: ReadonlyArray<StationDef> = [
  {
    id: 'mind-dump',
    label: 'MIND-DUMP [M]',
    hotkey: 'M',
    x: 120,
    y: 574,
    hitX: 66,
    hitY: 424,
    hitW: 108,
    hitH: 150,
    tier: 1,
  },
  {
    id: 'quest-board',
    label: 'QUEST BOARD [B]',
    hotkey: 'B',
    x: 525,
    y: 574,
    hitX: 465,
    hitY: 438,
    hitW: 120,
    hitH: 136,
    tier: 1,
  },
  {
    id: 'energy-boost',
    label: 'ENERGY BOOST 1/WK',
    hotkey: 'BOOST',
    x: 578,
    y: 360,
    hitX: 534,
    hitY: 236,
    hitW: 88,
    hitH: 124,
    tier: 2,
  },
  {
    id: 'roadmap',
    label: 'ROADMAP [R]',
    hotkey: 'R',
    x: 196,
    y: 256,
    hitX: 112,
    hitY: 134,
    hitW: 170,
    hitH: 122,
    tier: 3,
  },
];

export const createStars = (): StarDot[] => {
  const palette = ['#E2E8F0', '#93C5FD', '#67E8F9', '#CBD5E1', '#FDE68A'];
  const stars: StarDot[] = [];
  let seed = 4219;
  const nextRand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 95; i += 1) {
    stars.push({
      x: Math.floor(nextRand() * CANVAS_WIDTH),
      y: Math.floor(nextRand() * 410),
      size: nextRand() > 0.72 ? 3 : 2,
      phase: nextRand() * Math.PI * 2,
      speed: 1.2 + nextRand() * 2.5,
      color: palette[Math.floor(nextRand() * palette.length)],
      cross: nextRand() > 0.84,
    });
  }
  return stars;
};

export const createAcidBubbles = (): AcidBubble[] => {
  const bubbles: AcidBubble[] = [];
  for (let i = 0; i < 22; i += 1) {
    bubbles.push({
      x: 16 + ((i * 37) % 340),
      y: 632 + ((i * 29) % 80),
      vy: 18 + (i % 5) * 7,
      r: 2 + (i % 4),
      phase: i * 0.7,
    });
  }
  return bubbles;
};
