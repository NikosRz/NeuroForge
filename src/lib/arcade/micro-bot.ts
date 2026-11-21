import { inkBox, inkPoly, pxRect, wrapCanvasText } from './primitives';
import type { MicroBotState } from './types';
import { CANVAS_WIDTH } from './world';

const SPAWN_DURATION_S = 0.7;
const GRACE_DURATION_S = 0.85;
const WALK_IN_DISTANCE_PX = 204;

const computeWalkInOffsetX = (spawnTimer: number): number => {
  if (spawnTimer <= 0) return 0;
  const progress = Math.max(0, Math.min(1, 1 - spawnTimer / SPAWN_DURATION_S));
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(WALK_IN_DISTANCE_PX * (1 - eased));
};

export const drawMicroBot = (
  ctx: CanvasRenderingContext2D,
  bot: MicroBotState,
  title: string,
  stepIndex: number,
  stepTotal: number,
  hovered: boolean,
  time: number
): void => {
  const walkOffsetX = computeWalkInOffsetX(bot.spawnTimer);
  const isWalking = bot.spawnTimer > 0;
  const walkCycle = isWalking ? Math.sin(time * 24) : 0;
  const leftLegY = isWalking ? Math.round(Math.max(0, walkCycle) * -5) : 0;
  const rightLegY = isWalking ? Math.round(Math.max(0, -walkCycle) * -5) : 0;
  const walkBobY = isWalking ? Math.round(Math.abs(walkCycle) * -3) : 0;
  const idleY = isWalking ? walkBobY : Math.round(Math.sin(time * 4.6) * 2);
  const shakeX = bot.shakeTimer > 0 ? Math.round(Math.sin(bot.shakeTimer * 95) * 5) : 0;
  const renderX = Math.round(bot.x + walkOffsetX + shakeX);

  // Compact Micro-Task Nameplate above the tiny robot (well below Main Boss HP bar at y=324)
  const plateW = 286;
  const plateX = Math.round(
    Math.min(CANVAS_WIDTH - plateW - 16, Math.max(16, renderX - plateW / 2 - 12))
  );

  ctx.save();
  ctx.font = 'bold 13px "Silkscreen", monospace';
  const titleLines = wrapCanvasText(ctx, title, plateW - 18, 2);
  const lineH = 16;
  const headerH = 15;
  const padY = 6;
  const plateH = headerH + titleLines.length * lineH + padY * 2 + 2;
  const plateBottomY = Math.round(bot.y - 88);
  const plateY = plateBottomY - plateH;

  // Nameplate frame (amber/cyan accent so it reads visually subordinate to the main JIRA plate)
  pxRect(ctx, plateX - 3, plateY - 3, plateW + 6, plateH + 6, '#020617');
  pxRect(
    ctx,
    plateX - 1,
    plateY - 1,
    plateW + 2,
    plateH + 2,
    hovered ? '#67E8F9' : '#F59E0B'
  );
  pxRect(ctx, plateX, plateY, plateW, plateH, '#0F172A');

  // Pointer nub toward tiny robot (clamped inside plate bounds while walking in)
  const tailX = Math.round(Math.min(plateX + plateW - 12, Math.max(plateX + 6, renderX - 4)));
  pxRect(ctx, tailX - 2, plateBottomY + 2, 10, 5, '#020617');
  pxRect(ctx, tailX, plateBottomY, 6, 5, hovered ? '#67E8F9' : '#F59E0B');

  // Step counter header
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 10px "Silkscreen", monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText(
    `MICRO-BOT ${stepIndex}/${stepTotal}`,
    Math.round(plateX + plateW / 2),
    Math.round(plateY + padY + headerH / 2)
  );

  // Micro-task title lines
  ctx.font = 'bold 13px "Silkscreen", monospace';
  titleLines.forEach((line, idx) => {
    const ly = Math.round(plateY + padY + headerH + 2 + idx * lineH + lineH / 2);
    ctx.fillStyle = '#020617';
    ctx.fillText(line, Math.round(plateX + plateW / 2) + 1, ly + 1);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(line, Math.round(plateX + plateW / 2), ly);
  });
  ctx.restore();

  // Tiny Pixel-Art Mecha (~76px tall, ~72px wide)
  ctx.save();
  ctx.translate(renderX, Math.round(bot.y));

  // Ground contact shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(-30, -3, 60, 6);

  if (hovered) {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
    ctx.fillRect(-42, -82, 84, 82);
  }

  const flash = bot.hitFlashTimer > 0;
  const outline = flash ? '#FEF08A' : '#060A14';
  const redDeep = flash ? '#FFFFFF' : '#7F1D1D';
  const redMid = flash ? '#FFFFFF' : '#DC2626';
  const orangeMid = flash ? '#FEF08A' : '#EA580C';
  const orangeHi = flash ? '#FFFFFF' : '#FB923C';
  const mechDark = flash ? '#CBD5E1' : '#1E293B';
  const mechMid = flash ? '#E2E8F0' : '#475569';
  const mechSilver = flash ? '#FFFFFF' : '#94A3B8';
  const visor = flash ? '#FFFFFF' : '#22D3EE';

  // Stubby mecha legs & stomper feet (animated alternating step while walking in)
  inkBox(ctx, -20, -20 + leftLegY, 14, 14, redDeep, outline, 2);
  pxRect(ctx, -18, -18 + leftLegY, 5, 8, orangeMid);
  inkBox(ctx, -24, -8 + leftLegY, 20, 8, mechDark, outline, 2);
  pxRect(ctx, -22, -6 + leftLegY, 10, 3, mechSilver);

  inkBox(ctx, 6, -20 + rightLegY, 14, 14, redDeep, outline, 2);
  pxRect(ctx, 9, -18 + rightLegY, 5, 8, orangeMid);
  inkBox(ctx, 4, -8 + rightLegY, 20, 8, mechDark, outline, 2);
  pxRect(ctx, 8, -6 + rightLegY, 10, 3, mechSilver);

  // Compact armored torso
  inkPoly(
    ctx,
    [
      [-26, -54 + idleY],
      [26, -54 + idleY],
      [22, -20 + idleY],
      [-22, -20 + idleY],
    ],
    redMid,
    outline,
    2
  );
  pxRect(ctx, -22, -51 + idleY, 44, 5, orangeHi);
  pxRect(ctx, -18, -46 + idleY, 36, 4, orangeMid);

  // Small side arms / stubby claws
  inkBox(ctx, -34, -46 + idleY, 10, 20, mechMid, outline, 2);
  pxRect(ctx, -32, -44 + idleY, 4, 8, mechSilver);
  inkBox(ctx, 24, -46 + idleY, 10, 20, mechMid, outline, 2);
  pxRect(ctx, 26, -44 + idleY, 4, 8, mechSilver);

  // Mini glowing emerald chest core
  inkBox(ctx, -6, -34 + idleY, 12, 10, '#FACC15', outline, 1.5);
  pxRect(ctx, -4, -32 + idleY, 8, 6, '#22C55E');
  pxRect(ctx, -2, -31 + idleY, 3, 3, '#BBF7D0');

  // Compact domed head + glowing visor + antenna
  inkBox(ctx, -18, -70 + idleY, 36, 18, redMid, outline, 2);
  pxRect(ctx, -15, -68 + idleY, 30, 3, orangeHi);

  // Antenna with pulsing tip
  inkBox(ctx, -2, -79 + idleY, 4, 10, mechSilver, outline, 1.5);
  const beaconOn = Math.floor(time * 6) % 2 === 0;
  pxRect(ctx, -3, -83 + idleY, 6, 5, beaconOn ? '#22D3EE' : '#FACC15');

  // Visor cavity & glowing cyan eyes
  inkBox(ctx, -13, -64 + idleY, 26, 9, '#090D16', outline, 1.5);
  pxRect(ctx, -10, -62 + idleY, 8, 5, visor);
  pxRect(ctx, 2, -62 + idleY, 8, 5, visor);
  pxRect(ctx, -9, -61 + idleY, 3, 2, '#ECFEFF');
  pxRect(ctx, 3, -61 + idleY, 3, 2, '#ECFEFF');

  // Spawn grace shield shimmer (protects against accidental double-tap kills)
  if (bot.graceTimer > 0) {
    const alpha = Math.min(0.85, (bot.graceTimer / GRACE_DURATION_S) * 0.85);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(0, -40 + idleY, 44, 48, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
};
