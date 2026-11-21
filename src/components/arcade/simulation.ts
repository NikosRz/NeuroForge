import {
  ACID_ZONE,
  BOSS_TAUNTS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PLATFORMS,
  STATIONS,
  getBossPlateRect,
  type BossPhase,
  type BossState,
  type FloatingText,
  type HeroState,
  type InteractTargetId,
  type LaserBolt,
  type LevelUpBanner,
  type MicroBotState,
  type Particle,
  type StationId,
} from '@/lib/arcade';
import { arcadeAudio } from '@/lib/arcadeAudio';

export interface KeyState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface SimulationTimers {
  shootCooldown: number;
  acidCooldown: number;
  boostPulseTimer: number;
  shakeTimer: number;
  shakeMagnitude: number;
  bossCheckCooldown: number;
}

const GRAVITY = 1850;
const JUMP_VELOCITY = -945;
const HERO_MAX_SPEED = 350;
const HERO_ACCEL = 2600;
const HERO_FRICTION = 2200;

export const getSurfaceTier = (y: number): 1 | 2 | 3 => {
  if (y <= 265) return 3;
  if (y <= 370) return 2;
  return 1;
};

export const getNearestStation = (hero: HeroState): StationId | null => {
  const heroTier = getSurfaceTier(hero.y);
  for (const st of STATIONS) {
    if (st.tier === heroTier && Math.abs(hero.x - st.x) <= 64) {
      return st.id;
    }
  }
  return null;
};

export const getCanvasPoint = (
  canvas: HTMLCanvasElement | null,
  clientX: number,
  clientY: number
): { x: number; y: number } | null => {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  };
};

export const hitTestTarget = (
  px: number,
  py: number,
  boss: BossState,
  phase: BossPhase,
  microBot: MicroBotState
): InteractTargetId | null => {
  for (const st of STATIONS) {
    if (
      px >= st.hitX &&
      px <= st.hitX + st.hitW &&
      py >= st.hitY &&
      py <= st.hitY + st.hitH
    ) {
      return st.id;
    }
  }

  const plate = getBossPlateRect(boss.x);
  if (
    px >= plate.x &&
    px <= plate.x + plate.w &&
    py >= plate.y &&
    py <= plate.y + plate.h
  ) {
    return 'boss-plate';
  }

  if (phase === 'micro-wave' && !boss.defeated) {
    if (
      px >= microBot.hitX &&
      px <= microBot.hitX + microBot.hitW &&
      py >= microBot.hitY &&
      py <= microBot.hitY + microBot.hitH
    ) {
      return 'boss';
    }
    return null;
  }

  if (
    !boss.defeated &&
    px >= boss.hitX &&
    px <= boss.hitX + boss.hitW &&
    py >= boss.hitY &&
    py <= boss.hitY + boss.hitH
  ) {
    return 'boss';
  }
  return null;
};

export const spawnParticlesInto = (
  particles: Particle[],
  x: number,
  y: number,
  count: number,
  colors: ReadonlyArray<string>,
  speedMin: number,
  speedMax: number,
  gravity: number,
  sizeMin: number,
  sizeMax: number,
  lifeMin: number,
  lifeMax: number,
  kind: Particle['kind'],
  upwardBias = 0
): void => {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const life = lifeMin + Math.random() * (lifeMax - lifeMin);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - upwardBias,
      size: sizeMin + Math.floor(Math.random() * (sizeMax - sizeMin + 1)),
      color: colors[Math.floor(Math.random() * colors.length)],
      life,
      maxLife: life,
      gravity,
      kind,
    });
  }
};

export interface StepSimulationContext {
  dt: number;
  hero: HeroState;
  boss: BossState;
  microBot: MicroBotState;
  phase: BossPhase;
  keys: KeyState;
  timers: SimulationTimers;
  lasers: LaserBolt[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  banner: LevelUpBanner;
  tauntCount: number;
  onLaserHitBoss: (bolt: LaserBolt) => void;
  onLaserHitMicroBot: (bolt: LaserBolt) => void;
}

export const stepArcadeSimulation = ({
  dt,
  hero,
  boss,
  microBot,
  phase,
  keys,
  timers,
  lasers,
  particles,
  floatingTexts,
  banner,
  tauntCount,
  onLaserHitBoss,
  onLaserHitMicroBot,
}: StepSimulationContext): {
  nextLasers: LaserBolt[];
  nextParticles: Particle[];
  nextTexts: FloatingText[];
} => {
  if (timers.shootCooldown > 0) timers.shootCooldown = Math.max(0, timers.shootCooldown - dt);
  if (timers.acidCooldown > 0) timers.acidCooldown = Math.max(0, timers.acidCooldown - dt);
  if (timers.boostPulseTimer > 0) timers.boostPulseTimer = Math.max(0, timers.boostPulseTimer - dt);
  if (timers.shakeTimer > 0) timers.shakeTimer = Math.max(0, timers.shakeTimer - dt);
  if (timers.bossCheckCooldown > 0) {
    timers.bossCheckCooldown = Math.max(0, timers.bossCheckCooldown - dt);
  }

  if (hero.shootAnimTimer > 0) hero.shootAnimTimer = Math.max(0, hero.shootAnimTimer - dt);
  if (hero.dropTimer > 0) hero.dropTimer = Math.max(0, hero.dropTimer - dt);
  if (hero.hurtTimer > 0) hero.hurtTimer = Math.max(0, hero.hurtTimer - dt);
  if (hero.jumpBufferTimer > 0) hero.jumpBufferTimer = Math.max(0, hero.jumpBufferTimer - dt);

  if (boss.hitFlashTimer > 0) boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);
  if (boss.shakeTimer > 0) boss.shakeTimer = Math.max(0, boss.shakeTimer - dt);
  if (boss.shieldFlashTimer > 0) boss.shieldFlashTimer = Math.max(0, boss.shieldFlashTimer - dt);
  if (boss.overrideTauntTimer > 0) {
    boss.overrideTauntTimer = Math.max(0, boss.overrideTauntTimer - dt);
    if (boss.overrideTauntTimer === 0) boss.overrideTaunt = null;
  }

  if (microBot.spawnTimer > 0) microBot.spawnTimer = Math.max(0, microBot.spawnTimer - dt);
  if (microBot.graceTimer > 0) microBot.graceTimer = Math.max(0, microBot.graceTimer - dt);
  if (microBot.hitFlashTimer > 0) {
    microBot.hitFlashTimer = Math.max(0, microBot.hitFlashTimer - dt);
  }
  if (microBot.shakeTimer > 0) microBot.shakeTimer = Math.max(0, microBot.shakeTimer - dt);

  // Boss speech bubble cycle (~5s)
  boss.tauntTimer += dt;
  if (boss.tauntTimer >= 5.0) {
    boss.tauntTimer = 0;
    const mod = Math.max(1, tauntCount || BOSS_TAUNTS.length);
    boss.tauntIndex = (boss.tauntIndex + 1) % mod;
  }

  // Boss respawn countdown
  if (boss.defeated) {
    boss.respawnTimer -= dt;
    if (boss.respawnTimer <= 0) {
      boss.defeated = false;
      boss.hp = 100;
      spawnParticlesInto(
        particles,
        boss.x,
        boss.y - 72,
        20,
        ['#22D3EE', '#67E8F9', '#FFFFFF'],
        60,
        220,
        100,
        4,
        7,
        0.35,
        0.7,
        'spark',
        40
      );
    }
  }

  // Level Up Banner countdown
  if (banner.active) {
    banner.timer -= dt;
    if (banner.timer <= 0) {
      banner.active = false;
    }
  }

  // Horizontal movement
  let moveDir = 0;
  if (keys.left) moveDir -= 1;
  if (keys.right) moveDir += 1;

  if (moveDir !== 0) {
    hero.facing = moveDir > 0 ? 1 : -1;
    hero.vx += moveDir * HERO_ACCEL * dt;
    if (hero.vx > HERO_MAX_SPEED) hero.vx = HERO_MAX_SPEED;
    if (hero.vx < -HERO_MAX_SPEED) hero.vx = -HERO_MAX_SPEED;
  } else if (hero.vx > 0) {
    hero.vx = Math.max(0, hero.vx - HERO_FRICTION * dt);
  } else if (hero.vx < 0) {
    hero.vx = Math.min(0, hero.vx + HERO_FRICTION * dt);
  }

  // Coyote time & buffered jump
  if (hero.onGround) {
    hero.coyoteTimer = 0.09;
  } else {
    hero.coyoteTimer = Math.max(0, hero.coyoteTimer - dt);
  }

  if (hero.jumpBufferTimer > 0 && hero.coyoteTimer > 0) {
    hero.vy = JUMP_VELOCITY;
    hero.onGround = false;
    hero.coyoteTimer = 0;
    hero.jumpBufferTimer = 0;
    arcadeAudio.playJump();
    spawnParticlesInto(
      particles,
      hero.x,
      hero.y - 2,
      5,
      ['#94A3B8', '#CBD5E1'],
      30,
      90,
      260,
      3,
      5,
      0.16,
      0.3,
      'dust',
      20
    );
  }

  // Gravity & position integration
  const prevY = hero.y;
  hero.vy += GRAVITY * dt;
  hero.x += hero.vx * dt;
  hero.y += hero.vy * dt;

  if (hero.x < 28) {
    hero.x = 28;
    hero.vx = 0;
  }
  if (hero.x > CANVAS_WIDTH - 36) {
    hero.x = CANVAS_WIDTH - 36;
    hero.vx = 0;
  }

  // Platform collision (one-way pass-through from below)
  const wasGrounded = hero.onGround;
  hero.onGround = false;
  const halfWidth = 14;

  if (hero.vy >= 0) {
    for (const plat of PLATFORMS) {
      if (plat.oneWay && hero.dropTimer > 0) continue;
      const withinX = hero.x + halfWidth > plat.x && hero.x - halfWidth < plat.x + plat.w;
      if (!withinX) continue;
      if (prevY <= plat.y + 8 && hero.y >= plat.y) {
        hero.y = plat.y;
        hero.vy = 0;
        hero.onGround = true;
        if (!wasGrounded && prevY < plat.y - 6) {
          arcadeAudio.playLand();
        }
        break;
      }
    }
  }

  // Acid Pool Safety Bounce
  if (
    hero.y >= ACID_ZONE.triggerY &&
    hero.x >= ACID_ZONE.gapXStart - 8 &&
    hero.x <= ACID_ZONE.gapXEnd + 8 &&
    timers.acidCooldown <= 0
  ) {
    timers.acidCooldown = 0.45;
    hero.hurtTimer = 0.6;
    hero.vy = -780;
    hero.vx = hero.x < 285 ? -210 : 250;
    hero.onGround = false;
    arcadeAudio.playAcidZap();
    timers.shakeTimer = 0.16;
    timers.shakeMagnitude = 5;
    spawnParticlesInto(
      particles,
      hero.x,
      ACID_ZONE.y - 4,
      20,
      ['#22C55E', '#84CC16', '#BEF264', '#ECFCCB'],
      80,
      280,
      620,
      4,
      7,
      0.35,
      0.75,
      'acid',
      180
    );
  }

  if (hero.y > 700) {
    hero.y = 574;
    hero.x = 420;
    hero.vy = 0;
    hero.onGround = true;
  }

  if (hero.onGround && Math.abs(hero.vx) > 25) {
    hero.runCycle += dt * (Math.abs(hero.vx) * 0.036);
  } else {
    hero.runCycle = 0;
  }

  // Update laser bolts & boss collision
  const nextLasers: LaserBolt[] = [];
  for (const bolt of lasers) {
    bolt.x += bolt.vx * dt;
    bolt.life -= dt;
    if (bolt.life <= 0 || bolt.x < -60 || bolt.x > CANVAS_WIDTH + 60) {
      continue;
    }

    if (phase === 'micro-wave' && !boss.defeated) {
      if (
        bolt.x >= microBot.hitX + 8 &&
        bolt.x <= microBot.hitX + microBot.hitW - 8 &&
        bolt.y >= microBot.hitY &&
        bolt.y <= microBot.hitY + microBot.hitH
      ) {
        onLaserHitMicroBot(bolt);
        continue;
      }
    } else if (
      !boss.defeated &&
      bolt.x >= boss.hitX + 12 &&
      bolt.x <= boss.hitX + boss.hitW - 12 &&
      bolt.y >= boss.hitY &&
      bolt.y <= boss.hitY + boss.hitH
    ) {
      onLaserHitBoss(bolt);
      continue;
    }

    nextLasers.push(bolt);
  }

  const nextParticles: Particle[] = [];
  for (const pt of particles) {
    pt.life -= dt;
    if (pt.life <= 0) continue;
    pt.vy += pt.gravity * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    nextParticles.push(pt);
  }

  const nextTexts: FloatingText[] = [];
  for (const ft of floatingTexts) {
    ft.life -= dt;
    if (ft.life <= 0) continue;
    ft.vy += 380 * dt;
    ft.y += ft.vy * dt;
    nextTexts.push(ft);
  }

  return { nextLasers, nextParticles, nextTexts };
};
