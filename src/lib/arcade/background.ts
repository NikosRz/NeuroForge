import { pxRect } from './primitives';
import type { AcidBubble, StarDot } from './types';
import { ACID_ZONE, CANVAS_HEIGHT, CANVAS_WIDTH, PLATFORMS } from './world';

interface BuildingSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  body: string;
  shade: string;
  trim: string;
  windowColor: string;
  altWindowColor: string;
  antennaHeight: number;
  windowCols: number;
  windowRows: number;
}

const FAR_BUILDINGS: ReadonlyArray<BuildingSpec> = [
  { x: 12, y: 205, w: 94, h: 375, body: '#0B1224', shade: '#070C1A', trim: '#1E293B', windowColor: '#22D3EE', altWindowColor: '#38BDF8', antennaHeight: 28, windowCols: 4, windowRows: 12 },
  { x: 118, y: 175, w: 86, h: 405, body: '#0E172E', shade: '#091022', trim: '#1E293B', windowColor: '#38BDF8', altWindowColor: '#F59E0B', antennaHeight: 42, windowCols: 4, windowRows: 14 },
  { x: 224, y: 230, w: 72, h: 350, body: '#0A1121', shade: '#060B16', trim: '#17223B', windowColor: '#F59E0B', altWindowColor: '#22D3EE', antennaHeight: 16, windowCols: 3, windowRows: 10 },
  { x: 325, y: 148, w: 68, h: 432, body: '#0D1529', shade: '#080E1D', trim: '#233252', windowColor: '#38BDF8', altWindowColor: '#F59E0B', antennaHeight: 54, windowCols: 3, windowRows: 15 },
  { x: 416, y: 245, w: 88, h: 335, body: '#0B1325', shade: '#070C1A', trim: '#1E293B', windowColor: '#22D3EE', altWindowColor: '#22D3EE', antennaHeight: 24, windowCols: 4, windowRows: 10 },
  { x: 518, y: 192, w: 64, h: 388, body: '#0F1A33', shade: '#091124', trim: '#253659', windowColor: '#F59E0B', altWindowColor: '#38BDF8', antennaHeight: 30, windowCols: 3, windowRows: 12 },
  { x: 704, y: 215, w: 78, h: 365, body: '#0B1325', shade: '#070C19', trim: '#1E293B', windowColor: '#38BDF8', altWindowColor: '#F59E0B', antennaHeight: 20, windowCols: 3, windowRows: 11 },
  { x: 966, y: 240, w: 96, h: 340, body: '#0C1428', shade: '#080D1B', trim: '#1C2947', windowColor: '#F59E0B', altWindowColor: '#38BDF8', antennaHeight: 22, windowCols: 4, windowRows: 11 },
  { x: 1084, y: 190, w: 106, h: 390, body: '#0E182F', shade: '#091022', trim: '#243456', windowColor: '#38BDF8', altWindowColor: '#F59E0B', antennaHeight: 36, windowCols: 5, windowRows: 13 },
  { x: 1200, y: 218, w: 80, h: 362, body: '#0B1224', shade: '#070B18', trim: '#1E293B', windowColor: '#22D3EE', altWindowColor: '#F59E0B', antennaHeight: 26, windowCols: 3, windowRows: 11 },
];

const MID_BUILDINGS: ReadonlyArray<BuildingSpec> = [
  { x: 302, y: 294, w: 110, h: 286, body: '#121E38', shade: '#0C1529', trim: '#2A3E66', windowColor: '#22D3EE', altWindowColor: '#F59E0B', antennaHeight: 24, windowCols: 5, windowRows: 10 },
  { x: 422, y: 256, w: 124, h: 324, body: '#14213D', shade: '#0D172C', trim: '#2F4673', windowColor: '#38BDF8', altWindowColor: '#F59E0B', antennaHeight: 18, windowCols: 5, windowRows: 11 },
  { x: 566, y: 124, w: 132, h: 456, body: '#162442', shade: '#0E1930', trim: '#344E80', windowColor: '#67E8F9', altWindowColor: '#FBBF24', antennaHeight: 46, windowCols: 6, windowRows: 16 },
  { x: 768, y: 282, w: 142, h: 298, body: '#121E39', shade: '#0B1428', trim: '#2D436E', windowColor: '#38BDF8', altWindowColor: '#F59E0B', antennaHeight: 14, windowCols: 6, windowRows: 10 },
  { x: 1020, y: 296, w: 118, h: 284, body: '#13203B', shade: '#0D162B', trim: '#2B406A', windowColor: '#FBBF24', altWindowColor: '#38BDF8', antennaHeight: 18, windowCols: 5, windowRows: 9 },
];

const drawBuildingList = (
  ctx: CanvasRenderingContext2D,
  buildings: ReadonlyArray<BuildingSpec>,
  time: number,
  seedBase: number,
): void  => {
  buildings.forEach((b, bIdx) => {
    pxRect(ctx, b.x, b.y, b.w, b.h, b.body);
    // Right-side shadow strip for 16-bit depth
    pxRect(ctx, b.x + b.w - 14, b.y, 14, b.h, b.shade);
    // Roof ledge trim
    pxRect(ctx, b.x - 2, b.y, b.w + 4, 6, b.trim);
    pxRect(ctx, b.x + 8, b.y - 8, b.w - 16, 8, b.shade);

    // Rooftop antenna with blinking beacon
    if (b.antennaHeight > 0) {
      const ax = Math.round(b.x + b.w * 0.52);
      pxRect(ctx, ax, b.y - 8 - b.antennaHeight, 3, b.antennaHeight, b.trim);
      const blink = Math.sin(time * 2.8 + bIdx * 1.4) > 0.2;
      if (blink) {
        pxRect(ctx, ax - 1, b.y - 10 - b.antennaHeight, 5, 4, bIdx % 2 === 0 ? '#EF4444' : '#22D3EE');
      }
    }

    // Pixel windows
    const marginX = 12;
    const usableW = b.w - 28;
    const stepX = Math.max(10, Math.floor(usableW / b.windowCols));
    const startY = b.y + 18;
    for (let row = 0; row < b.windowRows; row += 1) {
      for (let col = 0; col < b.windowCols; col += 1) {
        const hash = (bIdx * 31 + row * 17 + col * 13 + seedBase) % 19;
        if (hash < 7) continue;
        const wx = b.x + marginX + col * stepX;
        const wy = startY + row * 18;
        if (wy > 560) continue;
        const isAlt = hash === 11 || hash === 15;
        const flicker = hash === 17 && Math.sin(time * 1.7 + row) < -0.5;
        if (flicker) continue;
        pxRect(ctx, wx, wy, 6, 8, isAlt ? b.altWindowColor : b.windowColor);
      }
    }
  });
}

export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  time: number,
  stars: ReadonlyArray<StarDot>,
): void  => {
  // Stepped 16-bit dark night sky bands
  pxRect(ctx, 0, 0, CANVAS_WIDTH, 180, '#05070E');
  pxRect(ctx, 0, 180, CANVAS_WIDTH, 140, '#070B17');
  pxRect(ctx, 0, 320, CANVAS_WIDTH, 260, '#0A1021');

  // Twinkling pixel stars
  stars.forEach((star) => {
    const alpha = 0.45 + 0.55 * Math.sin(time * star.speed + star.phase);
    if (alpha < 0.25) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
    if (star.cross && alpha > 0.72) {
      ctx.fillRect(star.x - 2, star.y + 1, star.size + 4, 1);
      ctx.fillRect(star.x + 1, star.y - 2, 1, star.size + 4);
    }
  });
  ctx.globalAlpha = 1;

  // Far & Mid Cyber-City Skyline
  drawBuildingList(ctx, FAR_BUILDINGS, time, 3);
  drawBuildingList(ctx, MID_BUILDINGS, time, 9);

  // Upper-Right Industrial Steel Girders & Support Column (behind hero/boss)
  // Vertical truss tower around x: 928..976, y: 186..574
  const colX = 930;
  pxRect(ctx, colX, 186, 6, 388, '#334155');
  pxRect(ctx, colX + 2, 186, 2, 388, '#64748B');
  pxRect(ctx, colX + 40, 186, 6, 388, '#334155');
  pxRect(ctx, colX + 42, 186, 2, 388, '#64748B');
  for (let gy = 196; gy < 566; gy += 36) {
    pxRect(ctx, colX + 6, gy, 34, 4, '#273549');
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(colX + 5, gy + 2);
    ctx.lineTo(colX + 41, gy + 34);
    ctx.moveTo(colX + 41, gy + 2);
    ctx.lineTo(colX + 5, gy + 34);
    ctx.stroke();
  }

  // Horizontal upper-right truss girder (x: 754..1280, y: 148..194)
  const gx = 754;
  const gy = 148;
  const gw = 526;
  pxRect(ctx, gx, gy, gw, 10, '#475569');
  pxRect(ctx, gx, gy, gw, 3, '#94A3B8');
  pxRect(ctx, gx, gy + 38, gw, 10, '#334155');
  pxRect(ctx, gx, gy + 38, gw, 3, '#64748B');
  for (let bx = gx + 10; bx < CANVAS_WIDTH - 24; bx += 42) {
    pxRect(ctx, bx, gy + 10, 5, 28, '#334155');
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx + 2, gy + 10);
    ctx.lineTo(bx + 42, gy + 38);
    ctx.moveTo(bx + 42, gy + 10);
    ctx.lineTo(bx + 2, gy + 38);
    ctx.stroke();
  }
  // Rivets on top girder
  for (let rx = gx + 12; rx < CANVAS_WIDTH; rx += 24) {
    pxRect(ctx, rx, gy + 4, 3, 3, '#1E293B');
    pxRect(ctx, rx, gy + 41, 3, 3, '#1E293B');
  }
}

export const drawPlatformsAndAcid = (
  ctx: CanvasRenderingContext2D,
  time: number,
  acidBubbles: ReadonlyArray<AcidBubble>,
): void  => {
  // 1. Toxic Acid Vat (Bottom Left: x 0..366, y 626..720)
  pxRect(ctx, 0, 616, 368, 104, '#061A10');
  // Subtle green ambient glow into the open grated gap
  const glowPulse = 0.16 + 0.08 * Math.sin(time * 3.2);
  ctx.fillStyle = `rgba(34, 197, 94, ${glowPulse.toFixed(3)})`;
  ctx.fillRect(216, 560, 152, 68);

  // Acid liquid body
  pxRect(ctx, 0, 636, 364, 84, '#15803D');
  pxRect(ctx, 0, 654, 364, 66, '#166534');
  pxRect(ctx, 0, 682, 364, 38, '#14532D');

  // Animated 16-bit wavy surface crest
  for (let ax = 0; ax < 364; ax += 6) {
    const waveOffset = Math.round(Math.sin(time * 4.5 + ax * 0.06) * 3);
    pxRect(ctx, ax, 628 + waveOffset, 6, 8, '#22C55E');
    pxRect(ctx, ax, 624 + waveOffset, 6, 4, '#84CC16');
    if ((ax / 6 + Math.floor(time * 6)) % 4 === 0) {
      pxRect(ctx, ax, 622 + waveOffset, 4, 3, '#BEF264');
    }
  }

  // Rising acid bubbles + glowing motes
  acidBubbles.forEach((b) => {
    const cy = 626 + ((b.y - time * b.vy) % 86 + 86) % 86;
    const cx = b.x + Math.round(Math.sin(time * 2.5 + b.phase) * 4);
    pxRect(ctx, cx, cy, b.r * 2, b.r * 2, '#4ADE80');
    pxRect(ctx, cx + 1, cy + 1, Math.max(1, b.r - 1), Math.max(1, b.r - 1), '#ECFCCB');
  });

  // Floating bubbles rising through the open grated gap
  for (let i = 0; i < 6; i += 1) {
    const gx = 242 + i * 21;
    const prog = ((time * 0.65 + i * 0.23) % 1);
    const gy = 624 - prog * 54;
    const alpha = 1 - prog;
    ctx.globalAlpha = alpha;
    pxRect(ctx, gx, gy, 5, 5, '#84CC16');
    pxRect(ctx, gx + 1, gy + 1, 2, 2, '#ECFCCB');
  }
  ctx.globalAlpha = 1;

  // 2. Tier 1 Left Solid Platform (x: 0..224, y: 574..606)
  pxRect(ctx, 0, 574, 224, 30, '#334155');
  pxRect(ctx, 0, 574, 224, 6, '#64748B');
  pxRect(ctx, 0, 574, 224, 2, '#94A3B8');
  pxRect(ctx, 0, 598, 224, 6, '#1E293B');
  for (let rx = 12; rx < 216; rx += 32) {
    pxRect(ctx, rx, 584, 4, 4, '#1E293B');
    pxRect(ctx, rx + 12, 584, 4, 10, '#475569');
  }
  // Caution yellow/black edge warning by the acid gap
  for (let cy = 574; cy < 602; cy += 8) {
    pxRect(ctx, 214, cy, 10, 4, (cy / 8) % 2 === 0 ? '#FACC15' : '#0F172A');
  }

  // Broken/grated gap edge brackets (x: 224..364)
  pxRect(ctx, 224, 578, 12, 6, '#475569');
  pxRect(ctx, 352, 578, 12, 6, '#475569');
  for (let rx = 242; rx < 346; rx += 22) {
    // Subtle submerged/broken grate teeth so player sees it's a hazard gap
    pxRect(ctx, rx, 594, 4, 14, '#1E293B');
  }

  // 3. Tier 1 Right Heavy Ground Deck (x: 364..1280, y: 574..720)
  pxRect(ctx, 364, 574, 916, 146, '#1E293B');
  pxRect(ctx, 364, 574, 916, 22, '#334155');
  pxRect(ctx, 364, 574, 916, 5, '#64748B');
  pxRect(ctx, 364, 574, 916, 2, '#94A3B8');
  pxRect(ctx, 364, 596, 916, 6, '#0F172A');
  // Caution hazard stripe on left edge of main deck
  for (let cy = 574; cy < 602; cy += 8) {
    pxRect(ctx, 364, cy, 10, 4, (cy / 8) % 2 === 0 ? '#FACC15' : '#0F172A');
  }

  // Heavy steel wall vertical pillars & X-truss bays underneath
  for (let bx = 384; bx < 1260; bx += 160) {
    pxRect(ctx, bx, 602, 16, 118, '#334155');
    pxRect(ctx, bx + 2, 602, 4, 118, '#475569');
    pxRect(ctx, bx + 16, 602, 144, 118, '#131C2E');
    // Diagonal steel struts inside each bay
    ctx.strokeStyle = '#27354D';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx + 20, 608);
    ctx.lineTo(bx + 154, 714);
    ctx.moveTo(bx + 154, 608);
    ctx.lineTo(bx + 20, 714);
    ctx.stroke();

    // Rivets
    pxRect(ctx, bx + 6, 616, 4, 4, '#0F172A');
    pxRect(ctx, bx + 6, 666, 4, 4, '#0F172A');
  }

  // Sub-deck console details with tiny status LEDs
  pxRect(ctx, 646, 616, 66, 36, '#0F172A');
  pxRect(ctx, 650, 620, 58, 28, '#1E293B');
  pxRect(ctx, 656, 626, 6, 6, '#22C55E');
  pxRect(ctx, 666, 626, 6, 6, Math.sin(time * 4) > 0 ? '#FACC15' : '#713F12');
  pxRect(ctx, 678, 626, 24, 16, '#0B1324');

  // 4. Tier 2 Mid Steel Catwalk (x: 132..768, y: 360..394)
  // Safety railing behind hero
  pxRect(ctx, 136, 326, 628, 3, '#475569');
  pxRect(ctx, 136, 342, 628, 2, '#334155');
  for (let px = 136; px <= 764; px += 62) {
    pxRect(ctx, px, 324, 4, 36, '#475569');
    pxRect(ctx, px, 324, 2, 36, '#64748B');
  }
  // Main bridge beam
  pxRect(ctx, 132, 360, 636, 10, '#475569');
  pxRect(ctx, 132, 360, 636, 3, '#94A3B8');
  pxRect(ctx, 132, 386, 636, 8, '#1E293B');
  pxRect(ctx, 132, 386, 636, 2, '#475569');
  for (let tx = 140; tx < 746; tx += 38) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx, 370);
    ctx.lineTo(tx + 34, 386);
    ctx.moveTo(tx + 34, 370);
    ctx.lineTo(tx, 386);
    ctx.stroke();
    pxRect(ctx, tx, 370, 4, 16, '#475569');
  }

  // 5. Tier 3 Upper-Left Steel Ledge (x: 0..348, y: 256..360)
  pxRect(ctx, 0, 256, 348, 104, '#1E293B');
  pxRect(ctx, 0, 256, 348, 14, '#475569');
  pxRect(ctx, 0, 256, 348, 4, '#94A3B8');
  pxRect(ctx, 0, 270, 348, 4, '#0F172A');
  // Steel bunker panel detailing
  pxRect(ctx, 14, 286, 128, 56, '#162033');
  pxRect(ctx, 154, 286, 178, 56, '#162033');
  for (let vx = 24; vx < 126; vx += 12) {
    pxRect(ctx, vx, 298, 6, 32, '#0F172A');
  }
  for (let rx = 166; rx < 326; rx += 32) {
    pxRect(ctx, rx, 294, 4, 4, '#475569');
    pxRect(ctx, rx, 330, 4, 4, '#475569');
  }
}
