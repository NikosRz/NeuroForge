import { drawPixelLabel, pxRect } from './primitives';
import type { InteractTargetId, StationId } from './types';
import { STATIONS } from './world';

export const drawStations = (
  ctx: CanvasRenderingContext2D,
  time: number,
  hoveredTarget: InteractTargetId | null,
  nearStation: StationId | null,
  boostPulseTimer: number,
): void  => {
  // 1. MIND-DUMP [M] (x: 120, y: 574)
  {
    const st = STATIONS[0];
    const active = hoveredTarget === st.id || nearStation === st.id;
    const hoverBob = active ? Math.round(Math.sin(time * 5) * 2) : 0;
    const cx = st.x;
    const baseY = st.y + hoverBob;

    if (active) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
      ctx.fillRect(cx - 48, baseY - 126, 96, 126);
    }

    // Pod pedestal base
    pxRect(ctx, cx - 36, baseY - 18, 72, 18, '#334155');
    pxRect(ctx, cx - 40, baseY - 8, 80, 8, '#1E293B');
    pxRect(ctx, cx - 32, baseY - 18, 64, 4, '#64748B');
    // Glowing cyan tube chamber
    pxRect(ctx, cx - 28, baseY - 102, 56, 84, '#083344');
    pxRect(ctx, cx - 24, baseY - 98, 48, 76, '#0E7490');
    pxRect(ctx, cx - 18, baseY - 94, 36, 68, '#06B6D4');
    // Side metallic rails
    pxRect(ctx, cx - 32, baseY - 102, 6, 84, '#475569');
    pxRect(ctx, cx + 26, baseY - 102, 6, 84, '#475569');
    pxRect(ctx, cx - 30, baseY - 102, 2, 84, '#94A3B8');
    // Top cap
    pxRect(ctx, cx - 36, baseY - 114, 72, 12, '#475569');
    pxRect(ctx, cx - 26, baseY - 122, 52, 8, '#64748B');
    pxRect(ctx, cx - 20, baseY - 122, 40, 3, '#94A3B8');

    // Animated vertical data equalizer bars inside cylinder
    for (let bar = 0; bar < 5; bar += 1) {
      const level = 2 + Math.floor((Math.sin(time * 4 + bar * 1.1) + 1) * 2.5);
      for (let seg = 0; seg < level; seg += 1) {
        pxRect(ctx, cx - 10, baseY - 30 - seg * 10, 20, 6, seg >= 4 ? '#ECFEFF' : '#67E8F9');
      }
    }
    // Glass highlight streak
    pxRect(ctx, cx - 20, baseY - 94, 3, 64, '#A5F3FC');

    drawPixelLabel(ctx, st.label, cx, st.y - 134, active, 'M');
  }

  // 2. QUEST BOARD [B] (x: 525, y: 574)
  {
    const st = STATIONS[1];
    const active = hoveredTarget === st.id || nearStation === st.id;
    const hoverBob = active ? Math.round(Math.sin(time * 5) * 2) : 0;
    const cx = st.x;
    const baseY = st.y + hoverBob;

    if (active) {
      ctx.fillStyle = 'rgba(74, 222, 128, 0.14)';
      ctx.fillRect(cx - 54, baseY - 114, 108, 114);
    }

    // Console lower cabinet
    pxRect(ctx, cx - 40, baseY - 46, 80, 46, '#334155');
    pxRect(ctx, cx - 44, baseY - 8, 88, 8, '#1E293B');
    pxRect(ctx, cx - 34, baseY - 40, 68, 30, '#1E293B');
    // Keyboard tray
    pxRect(ctx, cx - 44, baseY - 56, 88, 10, '#475569');
    pxRect(ctx, cx - 36, baseY - 54, 72, 4, '#22D3EE');
    // Monitor frame
    pxRect(ctx, cx - 44, baseY - 110, 88, 54, '#475569');
    pxRect(ctx, cx - 44, baseY - 110, 88, 4, '#94A3B8');
    // CRT screen
    pxRect(ctx, cx - 36, baseY - 102, 72, 40, '#042F2E');
    pxRect(ctx, cx - 32, baseY - 98, 64, 32, '#0F766E');
    // Blueprint lines & quest icons on screen
    pxRect(ctx, cx - 26, baseY - 92, 26, 16, '#2DD4BF');
    pxRect(ctx, cx - 24, baseY - 90, 22, 12, '#042F2E');
    pxRect(ctx, cx + 6, baseY - 92, 20, 4, '#5EEAD4');
    pxRect(ctx, cx + 6, baseY - 84, 16, 4, '#5EEAD4');
    pxRect(ctx, cx - 26, baseY - 72, 52, 3, '#14B8A6');
    // Moving CRT scanline
    const scanY = baseY - 98 + Math.floor((time * 28) % 30);
    pxRect(ctx, cx - 32, scanY, 64, 2, 'rgba(153, 246, 228, 0.45)');

    drawPixelLabel(ctx, st.label, cx, st.y - 122, active, 'B');
  }

  // 3. ENERGY BOOST 1/WK (x: 578, y: 360, floating on Tier 2)
  {
    const st = STATIONS[2];
    const active = hoveredTarget === st.id || nearStation === st.id;
    const floatY = Math.round(Math.sin(time * 3.2) * 5);
    const cx = st.x;
    const cy = 294 + floatY;

    // Aura glow
    const glowR = active || boostPulseTimer > 0 ? 48 : 38;
    const pulseAlpha = boostPulseTimer > 0 ? 0.36 : active ? 0.28 : 0.16 + 0.06 * Math.sin(time * 4);
    ctx.fillStyle = `rgba(34, 197, 94, ${pulseAlpha.toFixed(3)})`;
    ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);

    // Armored capsule frame (gold/bronze)
    pxRect(ctx, cx - 26, cy - 42, 52, 84, '#78350F');
    pxRect(ctx, cx - 22, cy - 46, 44, 92, '#B45309');
    pxRect(ctx, cx - 18, cy - 46, 36, 4, '#FACC15');
    pxRect(ctx, cx - 18, cy + 42, 36, 4, '#FACC15');
    // Side rivets
    pxRect(ctx, cx - 28, cy - 26, 6, 52, '#CA8A04');
    pxRect(ctx, cx + 22, cy - 26, 6, 52, '#CA8A04');
    // Inner glowing emerald tube
    pxRect(ctx, cx - 16, cy - 32, 32, 64, '#14532D');
    pxRect(ctx, cx - 13, cy - 28, 26, 56, '#22C55E');
    pxRect(ctx, cx - 9, cy - 24, 18, 48, '#4ADE80');

    // Pixel lightning bolt inside core
    pxRect(ctx, cx + 1, cy - 16, 6, 6, '#FEF08A');
    pxRect(ctx, cx - 3, cy - 10, 8, 6, '#FACC15');
    pxRect(ctx, cx - 6, cy - 4, 13, 6, '#FEF08A');
    pxRect(ctx, cx - 1, cy + 2, 8, 6, '#FACC15');
    pxRect(ctx, cx - 4, cy + 8, 6, 7, '#FEF08A');

    drawPixelLabel(ctx, st.label, cx, 238, active);
  }

  // 4. ROADMAP [R] (x: 196, y: 256, Tier 3 Upper Ledge)
  {
    const st = STATIONS[3];
    const active = hoveredTarget === st.id || nearStation === st.id;
    const cx = st.x;
    const baseY = st.y;

    if (active) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
      ctx.fillRect(cx - 82, baseY - 120, 164, 120);
    }

    // Emitter pedestal
    pxRect(ctx, cx - 44, baseY - 12, 88, 12, '#334155');
    pxRect(ctx, cx - 32, baseY - 22, 64, 10, '#475569');
    pxRect(ctx, cx - 18, baseY - 26, 36, 4, '#22D3EE');

    // Holographic trapezoid grid
    ctx.save();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
    ctx.strokeStyle = active ? '#A5F3FC' : '#22D3EE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 72, baseY - 110);
    ctx.lineTo(cx + 72, baseY - 110);
    ctx.lineTo(cx + 46, baseY - 40);
    ctx.lineTo(cx - 46, baseY - 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Perspective grid lines
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.55)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i += 1) {
      const t = i / 6;
      const topX = cx - 72 + 144 * t;
      const botX = cx - 46 + 92 * t;
      ctx.beginPath();
      ctx.moveTo(topX, baseY - 110);
      ctx.lineTo(botX, baseY - 40);
      ctx.stroke();
    }
    for (let r = 1; r <= 4; r += 1) {
      const t = r / 5;
      const ly = baseY - 110 + 70 * t;
      const halfW = 72 - 26 * t;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, ly);
      ctx.lineTo(cx + halfW, ly);
      ctx.stroke();
    }

    // Rotating scan sweep bar inside holo-map
    const sweepOffset = Math.sin(time * 2.2) * 34;
    pxRect(ctx, cx + sweepOffset - 2, baseY - 108, 4, 66, 'rgba(165, 243, 252, 0.6)');

    // Glowing roadmap milestone blips
    pxRect(ctx, cx - 34, baseY - 94, 6, 6, '#A5F3FC');
    pxRect(ctx, cx + 18, baseY - 76, 6, 6, '#4ADE80');
    pxRect(ctx, cx - 6, baseY - 60, 6, 6, '#FACC15');
    ctx.restore();

    drawPixelLabel(ctx, st.label, cx + 128, baseY - 74, active, 'R');
  }
}
