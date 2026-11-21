import { inkBox, inkPoly, pxRect, wrapCanvasText } from './primitives';
import type { BossMicroProgress, BossPhase, BossState } from './types';
import { BOSS_TAUNTS, CANVAS_WIDTH } from './world';

export interface BossPlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BOSS_BAR_W = 308;
const BOSS_BAR_Y = 306;

export const getBossPlateRect = (bossX: number, labelLineCount = 2): BossPlateRect => {
  const barX = Math.round(
    Math.min(CANVAS_WIDTH - BOSS_BAR_W - 16, Math.max(16, bossX - BOSS_BAR_W / 2 - 20))
  );
  const lineH = 19;
  const padY = 8;
  const plateH = Math.max(1, labelLineCount) * lineH + padY * 2;
  const plateY = BOSS_BAR_Y - plateH - 6;
  return { x: barX, y: plateY, w: BOSS_BAR_W, h: plateH };
};

const shockRand = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const drawLightningBolt = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number,
  spread: number,
  seed: number,
  coreColor = '#FFFFFF'
): void => {
  const points: Array<[number, number]> = [[x1, y1]];
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const jitterX = (shockRand(seed + i * 7.3) - 0.5) * 2 * spread;
    const jitterY = (shockRand(seed + i * 13.1) - 0.5) * 2 * (spread * 0.45);
    points.push([
      Math.round(x1 + (x2 - x1) * t + jitterX),
      Math.round(y1 + (y2 - y1) * t + jitterY),
    ]);
  }
  points.push([x2, y2]);

  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';

  // Outer electric cyan glow
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // Inner bright core
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 1.8;
  ctx.stroke();
};

const drawElectricShock = (ctx: CanvasRenderingContext2D, time: number): void => {
  const tick = Math.floor(time * 16);
  const pulse = 0.16 + Math.abs(Math.sin(time * 22)) * 0.16;

  ctx.save();

  // Pulsing electric aura around the robot
  ctx.fillStyle = `rgba(34, 211, 238, ${pulse.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(0, -82, 66, 82, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jagged lightning arcs crackling across the mecha chassis
  drawLightningBolt(ctx, -18, -168, 6, -118, 5, 11, tick * 3 + 1, '#FEF08A');
  drawLightningBolt(ctx, -56, -124, 48, -68, 6, 13, tick * 5 + 17, '#FFFFFF');
  drawLightningBolt(ctx, 52, -132, -40, -28, 6, 14, tick * 7 + 31, '#ECFEFF');
  drawLightningBolt(ctx, -38, -54, 42, -14, 5, 10, tick * 11 + 43, '#FEF08A');

  // Crackling pixel sparks popping around the body
  const sparkColors = ['#FFFFFF', '#FEF08A', '#67E8F9', '#22D3EE'];
  for (let i = 0; i < 8; i += 1) {
    const sx = Math.round((shockRand(tick * 13 + i * 19) - 0.5) * 124);
    const sy = Math.round(-12 - shockRand(tick * 17 + i * 23) * 144);
    const size = shockRand(tick * 29 + i * 31) > 0.5 ? 4 : 3;
    const color = sparkColors[i % sparkColors.length];
    pxRect(ctx, sx, sy, size, size, color);
  }

  ctx.restore();
};

const drawSpeechBubble = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  bottomY: number,
): void  => {
  ctx.save();
  ctx.font = 'bold 13px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  const padX = 14;
  const boxW = Math.max(170, Math.ceil(metrics.width) + padX * 2);
  const boxH = 34;
  const bx = Math.round(Math.min(CANVAS_WIDTH - boxW - 14, centerX - boxW / 2));
  const by = Math.round(bottomY - boxH);

  // Pixel-art black border & crisp white interior
  pxRect(ctx, bx - 3, by - 3, boxW + 6, boxH + 6, '#0F172A');
  pxRect(ctx, bx, by, boxW, boxH, '#FFFFFF');
  pxRect(ctx, bx, by + boxH - 3, boxW, 3, '#CBD5E1');

  // Pointer tail toward boss
  const tailX = Math.round(centerX - 6);
  pxRect(ctx, tailX - 2, by + boxH + 3, 12, 6, '#0F172A');
  pxRect(ctx, tailX, by + boxH, 8, 6, '#FFFFFF');
  pxRect(ctx, tailX + 2, by + boxH + 6, 6, 6, '#0F172A');
  pxRect(ctx, tailX + 3, by + boxH + 6, 4, 4, '#FFFFFF');

  ctx.fillStyle = '#0F172A';
  ctx.fillText(text, Math.round(bx + boxW / 2), Math.round(by + boxH / 2 + 1));
  ctx.restore();
}

export const drawBoss = (
  ctx: CanvasRenderingContext2D,
  boss: BossState,
  hovered: boolean,
  time: number,
  bossLabel = 'BASE CAMP — NO QUEST',
  tauntText?: string,
  aiSplitting = false,
  phase: BossPhase = 'normal',
  microProgress: BossMicroProgress | null = null,
  plateHovered = false,
): void => {
  const hpPct = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));

  // Overhead Nameplate & HP Bar (anchored high so Main JIRA task stays visible during micro-bot waves)
  const barW = BOSS_BAR_W;
  const barY = BOSS_BAR_Y;

  ctx.save();
  ctx.font = 'bold 15px "Silkscreen", monospace';
  const labelLines = wrapCanvasText(ctx, bossLabel, barW - 20, 2);
  const lineH = 19;
  const padY = 8;
  const plateRect = getBossPlateRect(boss.x, labelLines.length);
  const barX = plateRect.x;
  const plateY = plateRect.y;
  const plateH = plateRect.h;

  // Nameplate box with crisp border & cyan accent (brightens on hover to hint QuestModal click)
  pxRect(ctx, barX - 3, plateY - 3, barW + 6, plateH + 6, '#020617');
  pxRect(
    ctx,
    barX - 1,
    plateY - 1,
    barW + 2,
    plateH + 2,
    plateHovered ? '#67E8F9' : phase === 'exposed-core' ? '#FACC15' : '#38BDF8'
  );
  pxRect(ctx, barX, plateY, barW, plateH, plateHovered ? '#1E293B' : '#0F172A');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labelLines.forEach((line, idx) => {
    const ly = Math.round(plateY + padY + idx * lineH + lineH / 2);
    ctx.fillStyle = '#020617';
    ctx.fillText(line, Math.round(barX + barW / 2) + 1, ly + 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, Math.round(barX + barW / 2), ly);
  });
  ctx.restore();

  // HP Bar frame (segmented when micro-steps exist, smooth % bar otherwise)
  pxRect(ctx, barX - 2, barY - 2, barW + 4, 22, '#0F172A');
  pxRect(ctx, barX, barY, barW, 18, '#3F1419');

  if (microProgress && microProgress.total > 0) {
    const coreW = 18;
    const corePulse = phase === 'exposed-core' && Math.floor(time * 8) % 2 === 0;
    const coreColor = corePulse ? '#FEF08A' : phase === 'exposed-core' ? '#FACC15' : '#F59E0B';
    pxRect(ctx, barX, barY, coreW, 18, coreColor);
    pxRect(ctx, barX, barY, coreW, 4, '#FEF9C3');
    pxRect(ctx, barX + coreW, barY, 2, 18, '#0F172A');

    const segStartX = barX + coreW + 2;
    const segAreaW = barW - coreW - 2;
    const segCount = microProgress.total;
    for (let i = 0; i < segCount; i += 1) {
      const sx = Math.round(segStartX + (i * segAreaW) / segCount);
      const nextX = Math.round(segStartX + ((i + 1) * segAreaW) / segCount);
      const sw = Math.max(2, nextX - sx - (i < segCount - 1 ? 2 : 0));
      const isFilled = i < microProgress.remaining;
      if (isFilled) {
        pxRect(ctx, sx, barY, sw, 18, boss.hitFlashTimer > 0 ? '#FCA5A5' : '#DC2626');
        pxRect(ctx, sx, barY, sw, 4, '#F87171');
      } else {
        pxRect(ctx, sx, barY, sw, 18, '#3F1419');
      }
    }

    ctx.save();
    ctx.font = 'bold 11px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const barLabel =
      phase === 'exposed-core'
        ? 'CORE OPEN! CLOSE IN JIRA'
        : `${microProgress.remaining}/${microProgress.total} BOTS LEFT`;
    ctx.fillStyle = '#020617';
    ctx.fillText(barLabel, Math.round(barX + barW / 2) + 1, barY + 10);
    ctx.fillStyle = phase === 'exposed-core' ? '#FEF08A' : '#FFFFFF';
    ctx.fillText(barLabel, Math.round(barX + barW / 2), barY + 9);
    ctx.restore();
  } else {
    const fillW = Math.round((barW * hpPct) / 100);
    if (fillW > 0) {
      pxRect(ctx, barX, barY, fillW, 18, boss.hitFlashTimer > 0 ? '#FCA5A5' : '#DC2626');
      pxRect(ctx, barX, barY, fillW, 4, '#F87171');
    }
    ctx.save();
    ctx.font = 'bold 12px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${hpPct}% HP`, Math.round(barX + barW / 2), barY + 9);
    ctx.restore();
  }

  if (aiSplitting) {
    const pulse = 0.65 + Math.sin(time * 10) * 0.35;
    ctx.save();
    ctx.globalAlpha = pulse;
    pxRect(ctx, barX + 24, barY + 24, barW - 48, 22, '#083344');
    pxRect(ctx, barX + 26, barY + 26, barW - 52, 18, '#0E7490');
    ctx.font = 'bold 11px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ECFEFF';
    ctx.fillText('⚡ AI SPLITTING QUEST...', Math.round(barX + barW / 2), barY + 35);
    ctx.restore();
  }

  // During active micro-robot wave, only render the Main JIRA Overhead Header & Segmented HP Bar
  if (phase === 'micro-wave' && !boss.defeated) {
    return;
  }

  if (boss.defeated) {
    ctx.save();
    ctx.font = 'bold 13px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('TARGET DEFEATED! RESPAWNING...', Math.round(boss.x), boss.y - 68);
    ctx.restore();
    return;
  }

  // Taunt speech bubble (override taunt from shield deflect takes priority)
  const activeTaunt =
    boss.overrideTaunt && boss.overrideTauntTimer > 0
      ? boss.overrideTaunt
      : (tauntText ?? BOSS_TAUNTS[boss.tauntIndex]);
  drawSpeechBubble(ctx, activeTaunt, boss.x - 16, phase === 'exposed-core' ? 418 : 404);

  // Heavy Articulated Red/Orange Mecha Boss (~158px tall; hunched when exposed-core)
  const isExposed = phase === 'exposed-core';
  const crouchY = isExposed ? 14 : 0;
  const idleY = Math.round(Math.sin(time * (isExposed ? 5.2 : 2.8)) * (isExposed ? 1.2 : 1.8));
  const breathY =
    Math.round(Math.sin(time * (isExposed ? 5.2 : 2.8) + 0.5) * 1.5) + crouchY;
  const hitShakeX =
    boss.shakeTimer > 0 ? Math.round(Math.sin(boss.shakeTimer * 90) * 6) : 0;
  const shockShakeX = aiSplitting ? Math.round(Math.sin(time * 78) * 3.5) : 0;
  const exposedJitterX = isExposed && Math.floor(time * 12) % 7 === 0 ? 2 : 0;
  const shakeX = hitShakeX + shockShakeX + exposedJitterX;

  ctx.save();
  ctx.translate(Math.round(boss.x + shakeX), Math.round(boss.y));

  if (hovered) {
    ctx.fillStyle = isExposed ? 'rgba(250, 204, 21, 0.16)' : 'rgba(239, 68, 68, 0.16)';
    ctx.fillRect(-66, -158 + crouchY, 132, 158 - crouchY);
  }

  // Ground contact shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(-52, -3, 104, 7);

  const shockFlash = aiSplitting && Math.floor(time * 18) % 4 === 0;
  const flash = boss.hitFlashTimer > 0 || shockFlash;
  const outline = shockFlash ? '#22D3EE' : flash ? '#FEF08A' : '#060A14';
  const redDeep = flash ? '#FFFFFF' : isExposed ? '#450A0A' : '#7F1D1D';
  const redDark = flash ? '#FFFFFF' : isExposed ? '#7F1D1D' : '#991B1B';
  const redMid = flash ? '#FFFFFF' : isExposed ? '#991B1B' : '#DC2626';
  const orangeMid = flash ? '#FEF08A' : isExposed ? '#9A3412' : '#EA580C';
  const orangeHi = flash ? '#FFFFFF' : isExposed ? '#C2410C' : '#FB923C';
  const peachRim = flash ? '#FFFFFF' : isExposed ? '#FB923C' : '#FDBA74';
  const mechDark = flash ? '#CBD5E1' : '#1E293B';
  const mechMid = flash ? '#E2E8F0' : '#475569';
  const mechSilver = flash ? '#FFFFFF' : '#94A3B8';
  const mechShine = flash ? '#FFFFFF' : '#CBD5E1';
  const visorFlicker = isExposed && Math.floor(time * 10) % 3 === 0;
  const visor = flash ? '#FFFFFF' : visorFlicker ? '#EF4444' : '#FACC15';
  const coreGreen = flash
    ? '#FFFFFF'
    : isExposed
      ? Math.floor(time * 9) % 2 === 0
        ? '#FEF08A'
        : '#22D3EE'
      : '#22C55E';

  // --- LEFT (FRONT-FACING) & RIGHT (REAR-PERSPECTIVE) HEAVY LEGS ---
  // Left leg (planted forward-left)
  inkPoly(
    ctx,
    [
      [-32, -62],
      [-10, -62],
      [-14, -36],
      [-35, -36],
    ],
    redMid,
    outline,
  );
  pxRect(ctx, -31, -59, 6, 18, orangeHi);
  // Silver knee joint cylinder
  inkBox(ctx, -34, -39, 21, 10, mechMid, outline, 2);
  pxRect(ctx, -31, -37, 14, 4, mechShine);
  // Flared lower greave
  inkPoly(
    ctx,
    [
      [-36, -30],
      [-13, -30],
      [-10, -10],
      [-39, -10],
    ],
    redDark,
    outline,
  );
  inkPoly(
    ctx,
    [
      [-34, -29],
      [-19, -29],
      [-18, -12],
      [-35, -12],
    ],
    orangeMid,
    outline,
    1,
  );
  pxRect(ctx, -32, -27, 6, 10, orangeHi);
  // Heavy multi-toed mecha stomper foot
  inkPoly(
    ctx,
    [
      [-43, -11],
      [-9, -11],
      [-7, 0],
      [-45, 0],
    ],
    redDeep,
    outline,
  );
  pxRect(ctx, -40, -9, 14, 3, orangeMid);
  pxRect(ctx, -43, -3, 36, 3, mechDark);

  // Right leg (planted right)
  inkPoly(
    ctx,
    [
      [10, -62],
      [34, -62],
      [39, -36],
      [14, -36],
    ],
    redMid,
    outline,
  );
  pxRect(ctx, 16, -59, 8, 18, orangeMid);
  // Right knee actuator
  inkBox(ctx, 15, -39, 22, 10, mechMid, outline, 2);
  pxRect(ctx, 18, -37, 15, 4, mechShine);
  // Right lower greave
  inkPoly(
    ctx,
    [
      [14, -30],
      [38, -30],
      [43, -10],
      [13, -10],
    ],
    redDark,
    outline,
  );
  pxRect(ctx, 20, -28, 11, 14, orangeMid);
  pxRect(ctx, 22, -27, 5, 8, orangeHi);
  // Right stomper foot
  inkPoly(
    ctx,
    [
      [12, -11],
      [48, -11],
      [50, 0],
      [11, 0],
    ],
    redDeep,
    outline,
  );
  pxRect(ctx, 24, -9, 16, 3, orangeHi);
  pxRect(ctx, 13, -3, 35, 3, mechDark);

  // --- PELVIS & ARTICULATED HYDRAULIC WAIST ---
  inkPoly(
    ctx,
    [
      [-28, -74],
      [30, -74],
      [32, -57],
      [12, -55],
      [4, -50],
      [-4, -50],
      [-12, -55],
      [-30, -57],
    ],
    mechDark,
    outline,
  );
  // Red armored waist plates & central codpiece
  inkPoly(
    ctx,
    [
      [-10, -73],
      [11, -73],
      [8, -52],
      [-7, -52],
    ],
    redMid,
    outline,
    2,
  );
  pxRect(ctx, -5, -70, 11, 5, orangeHi);
  // Waist steel hydraulic pistons
  inkBox(ctx, -22, -88 + idleY, 44, 16, mechDark, outline, 2);
  pxRect(ctx, -18, -86 + idleY, 7, 12, mechSilver);
  pxRect(ctx, -16, -86 + idleY, 3, 12, mechShine);
  pxRect(ctx, 11, -86 + idleY, 7, 12, mechSilver);
  pxRect(ctx, 13, -86 + idleY, 3, 12, mechShine);
  pxRect(ctx, -6, -85 + idleY, 12, 10, mechMid);

  // --- REAR ARM (EXTENDED MENACINGLY LEFTWARD) ---
  // Shoulder socket & upper bicep
  inkPoly(
    ctx,
    [
      [-46, -114 + breathY],
      [-28, -116 + breathY],
      [-34, -90 + breathY],
      [-50, -92 + breathY],
    ],
    mechDark,
    outline,
  );
  pxRect(ctx, -44, -108 + breathY, 8, 12, mechSilver);
  // Heavy crimson/orange forearm gauntlet
  inkPoly(
    ctx,
    [
      [-58, -94 + breathY],
      [-34, -92 + breathY],
      [-38, -72 + breathY],
      [-60, -75 + breathY],
    ],
    redMid,
    outline,
  );
  pxRect(ctx, -55, -91 + breathY, 14, 5, orangeHi);
  // Articulated mecha claws
  inkPoly(
    ctx,
    [
      [-60, -75 + breathY],
      [-40, -73 + breathY],
      [-43, -64 + breathY],
      [-50, -64 + breathY],
      [-53, -69 + breathY],
      [-62, -66 + breathY],
    ],
    mechMid,
    outline,
  );

  // --- BROAD V-TAPERED CHEST CHASSIS ---
  inkPoly(
    ctx,
    [
      [-36, -124 + breathY],
      [38, -124 + breathY],
      [31, -85 + idleY],
      [-29, -85 + idleY],
    ],
    redDark,
    outline,
  );
  // Left & Right sculpted pectoral plates
  inkPoly(
    ctx,
    [
      [-32, -121 + breathY],
      [-4, -121 + breathY],
      [-7, -92 + idleY],
      [-26, -92 + idleY],
    ],
    redMid,
    outline,
    1.5,
  );
  inkPoly(
    ctx,
    [
      [4, -121 + breathY],
      [34, -121 + breathY],
      [27, -92 + idleY],
      [7, -92 + idleY],
    ],
    orangeMid,
    outline,
    1.5,
  );
  pxRect(ctx, -29, -119 + breathY, 22, 4, orangeHi);
  pxRect(ctx, 7, -119 + breathY, 24, 4, peachRim);
  // Collar guard
  inkBox(ctx, -18, -127 + breathY, 36, 9, mechDark, outline, 2);

  // Glowing Emerald Triangular Chest Core
  inkPoly(
    ctx,
    [
      [-10, -114 + breathY],
      [10, -114 + breathY],
      [0, -96 + breathY],
    ],
    '#FACC15',
    outline,
    2,
  );
  inkPoly(
    ctx,
    [
      [-7, -112 + breathY],
      [7, -112 + breathY],
      [0, -99 + breathY],
    ],
    coreGreen,
    '#14532D',
    1,
  );
  pxRect(ctx, -2, -110 + breathY, 4, 4, '#BBF7D0');

  // --- MASSIVE LAYERED SHOULDER PAULDRONS ---
  // Left Shoulder Pauldron
  inkPoly(
    ctx,
    [
      [-55, -125 + breathY],
      [-44, -135 + breathY],
      [-26, -133 + breathY],
      [-24, -110 + breathY],
      [-54, -108 + breathY],
    ],
    redMid,
    outline,
  );
  inkPoly(
    ctx,
    [
      [-51, -124 + breathY],
      [-42, -132 + breathY],
      [-29, -130 + breathY],
      [-28, -120 + breathY],
      [-51, -118 + breathY],
    ],
    orangeMid,
    outline,
    1,
  );
  pxRect(ctx, -45, -130 + breathY, 14, 4, peachRim);

  // Right Shoulder Pauldron (larger foreground perspective)
  inkPoly(
    ctx,
    [
      [24, -133 + breathY],
      [47, -135 + breathY],
      [59, -123 + breathY],
      [56, -105 + breathY],
      [25, -108 + breathY],
    ],
    redMid,
    outline,
  );
  inkPoly(
    ctx,
    [
      [27, -130 + breathY],
      [45, -132 + breathY],
      [55, -122 + breathY],
      [53, -116 + breathY],
      [27, -118 + breathY],
    ],
    orangeHi,
    outline,
    1,
  );
  pxRect(ctx, 30, -130 + breathY, 15, 4, peachRim);

  // --- FOREGROUND RIGHT ARM & CLENCHED FIST ---
  inkBox(ctx, 34, -107 + breathY, 16, 18, mechDark, outline, 2);
  pxRect(ctx, 38, -104 + breathY, 7, 12, mechSilver);
  // Heavy angled forearm gauntlet
  inkPoly(
    ctx,
    [
      [33, -91 + breathY],
      [53, -91 + breathY],
      [51, -67 + breathY],
      [29, -68 + breathY],
    ],
    redMid,
    outline,
  );
  pxRect(ctx, 35, -89 + breathY, 14, 5, orangeHi);
  // Heavy mechanical fist
  inkBox(ctx, 29, -68 + breathY, 20, 13, mechMid, outline, 2);
  pxRect(ctx, 32, -65 + breathY, 13, 3, mechShine);
  pxRect(ctx, 31, -60 + breathY, 15, 2, mechDark);

  // --- MECHA HELMET & GLOWING YELLOW VISOR EYES ---
  inkPoly(
    ctx,
    [
      [-17, -145 + breathY],
      [-7, -155 + breathY],
      [9, -155 + breathY],
      [18, -145 + breathY],
      [16, -124 + breathY],
      [-15, -124 + breathY],
    ],
    redMid,
    outline,
  );
  // Helmet crest & rim highlight
  inkPoly(
    ctx,
    [
      [-6, -156 + breathY],
      [7, -156 + breathY],
      [10, -146 + breathY],
      [-9, -146 + breathY],
    ],
    orangeHi,
    outline,
    1.5,
  );
  pxRect(ctx, -5, -154 + breathY, 11, 3, peachRim);

  // Recessed dark visor cavity
  inkPoly(
    ctx,
    [
      [-13, -142 + breathY],
      [12, -142 + breathY],
      [10, -132 + breathY],
      [-12, -132 + breathY],
    ],
    '#090D16',
    outline,
    1.5,
  );
  // Slanted fierce glowing yellow visor eyes
  inkPoly(
    ctx,
    [
      [-11, -140 + breathY],
      [-2, -138 + breathY],
      [-3, -134 + breathY],
      [-10, -135 + breathY],
    ],
    visor,
    '#713F12',
    1,
  );
  inkPoly(
    ctx,
    [
      [1, -138 + breathY],
      [9, -140 + breathY],
      [8, -135 + breathY],
      [2, -134 + breathY],
    ],
    visor,
    '#713F12',
    1,
  );
  // Metallic jaw & chin vent grill
  inkBox(ctx, -9, -131 + breathY, 17, 6, mechSilver, outline, 1.5);
  pxRect(ctx, -6, -130 + breathY, 3, 4, mechDark);
  pxRect(ctx, -1, -130 + breathY, 3, 4, mechDark);
  pxRect(ctx, 4, -130 + breathY, 3, 4, mechDark);

  // Energy Deflect Shield (Fix #1: flashes when laser hits an unfinished JIRA task)
  if (boss.shieldFlashTimer > 0) {
    const alpha = Math.min(1, boss.shieldFlashTimer / 0.45);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(-8, -82, 74, 86, 0, Math.PI * 0.55, Math.PI * 1.45);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-8, -82, 68, 80, 0, Math.PI * 0.55, Math.PI * 1.45);
    ctx.strokeStyle = '#ECFEFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.beginPath();
    ctx.ellipse(-4, -82, 68, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Electric shock lightning effect while local AI is splitting the quest
  if (aiSplitting) {
    drawElectricShock(ctx, time);
  }

  // Exposed-core pulsing glow & crackling arc when all micro-steps are done
  if (isExposed && !aiSplitting) {
    const corePulse = 0.22 + Math.abs(Math.sin(time * 7)) * 0.24;
    ctx.save();
    ctx.fillStyle = `rgba(250, 204, 21, ${corePulse.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, -106 + breathY, 22, 0, Math.PI * 2);
    ctx.fill();
    const tick = Math.floor(time * 10);
    if (tick % 3 === 0) {
      drawLightningBolt(ctx, -12, -112 + breathY, 14, -96 + breathY, 4, 6, tick * 5, '#FEF08A');
    }
    ctx.restore();
  }

  ctx.restore();
};
