import { inkBox, inkPoly, pxRect, wrapCanvasText } from './primitives';
import type { BossState } from './types';
import { BOSS_TAUNTS, CANVAS_WIDTH } from './world';

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
): void => {
  const hpPct = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));

  // Overhead Nameplate & HP Bar (Fix #7: larger, high-contrast 2-line wrapping nameplate)
  const barW = 308;
  const barX = Math.round(Math.min(CANVAS_WIDTH - barW - 16, Math.max(16, boss.x - barW / 2 - 20)));
  const barY = 306;

  ctx.save();
  ctx.font = 'bold 15px "Silkscreen", monospace';
  const labelLines = wrapCanvasText(ctx, bossLabel, barW - 20, 2);
  const lineH = 19;
  const padY = 8;
  const plateH = labelLines.length * lineH + padY * 2;
  const plateY = barY - plateH - 6;

  // Nameplate box with crisp border & cyan accent
  pxRect(ctx, barX - 3, plateY - 3, barW + 6, plateH + 6, '#020617');
  pxRect(ctx, barX - 1, plateY - 1, barW + 2, plateH + 2, '#38BDF8');
  pxRect(ctx, barX, plateY, barW, plateH, '#0F172A');

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

  // HP Bar frame
  pxRect(ctx, barX - 2, barY - 2, barW + 4, 22, '#0F172A');
  pxRect(ctx, barX, barY, barW, 18, '#3F1419');
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
  drawSpeechBubble(ctx, activeTaunt, boss.x - 16, 404);

  // Heavy Articulated Red/Orange Mecha Boss (~158px tall)
  const idleY = Math.round(Math.sin(time * 2.8) * 1.8);
  const breathY = Math.round(Math.sin(time * 2.8 + 0.5) * 1.5);
  const shakeX =
    boss.shakeTimer > 0 ? Math.round(Math.sin(boss.shakeTimer * 90) * 6) : 0;

  ctx.save();
  ctx.translate(Math.round(boss.x + shakeX), Math.round(boss.y));

  if (hovered) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
    ctx.fillRect(-66, -158, 132, 158);
  }

  // Ground contact shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(-52, -3, 104, 7);

  const flash = boss.hitFlashTimer > 0;
  const outline = flash ? '#FEF08A' : '#060A14';
  const redDeep = flash ? '#FFFFFF' : '#7F1D1D';
  const redDark = flash ? '#FFFFFF' : '#991B1B';
  const redMid = flash ? '#FFFFFF' : '#DC2626';
  const orangeMid = flash ? '#FEF08A' : '#EA580C';
  const orangeHi = flash ? '#FFFFFF' : '#FB923C';
  const peachRim = flash ? '#FFFFFF' : '#FDBA74';
  const mechDark = flash ? '#CBD5E1' : '#1E293B';
  const mechMid = flash ? '#E2E8F0' : '#475569';
  const mechSilver = flash ? '#FFFFFF' : '#94A3B8';
  const mechShine = flash ? '#FFFFFF' : '#CBD5E1';
  const visor = flash ? '#FFFFFF' : '#FACC15';
  const coreGreen = flash ? '#FFFFFF' : '#22C55E';

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

  ctx.restore();
};
