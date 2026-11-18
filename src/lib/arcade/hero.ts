import { inkBox, inkPoly, pxRect } from './primitives';
import type { HeroState } from './types';

export const drawHero = (
  ctx: CanvasRenderingContext2D,
  hero: HeroState,
  time: number,
): void  => {
  const isRunning = hero.onGround && Math.abs(hero.vx) > 25;
  const isJumping = !hero.onGround;
  const isShooting = hero.shootAnimTimer > 0;
  const idleBob = hero.onGround && !isRunning ? Math.round(Math.sin(time * 4.2) * 1.2) : 0;

  ctx.save();
  ctx.translate(Math.round(hero.x), Math.round(hero.y + idleBob));
  ctx.scale(hero.facing, 1);

  // Grounded contact shadow
  if (hero.onGround) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(-20, -2 - idleBob, 40, 4);
  }

  const acidFlash = hero.hurtTimer > 0 && Math.floor(hero.hurtTimer * 24) % 2 === 0;
  const outline = acidFlash ? '#BBF7D0' : '#060A14';
  const blueDeep = acidFlash ? '#15803D' : '#172554';
  const blueDark = acidFlash ? '#16A34A' : '#1E40AF';
  const blueMid = acidFlash ? '#22C55E' : '#2563EB';
  const blueHi = acidFlash ? '#86EFAC' : '#60A5FA';
  const blueRim = acidFlash ? '#ECFCCB' : '#BFDBFE';
  const silverDark = '#475569';
  const silverMid = '#94A3B8';
  const silverLight = '#E2E8F0';
  const silverHi = '#F8FAFC';
  const visorGold = '#FDE047';

  // Jetpack thruster flame when jumping
  if (isJumping) {
    const flameH = 9 + (Math.floor(time * 24) % 4) * 3;
    inkPoly(
      ctx,
      [
        [-14, -40],
        [-22, -40 + flameH],
        [-11, -36 + flameH * 0.7],
        [-7, -40],
      ],
      '#22D3EE',
      '#0891B2',
      1,
    );
    pxRect(ctx, -16, -39, 5, Math.max(4, flameH - 4), '#ECFEFF');
  }

  // Leg kinematics: idle heroic combat stance, 4-frame run, or jump pose
  const runPhase = isRunning ? Math.sin(hero.runCycle * 1.6) : 0;
  const backThighX = isJumping ? -12 : isRunning ? -8 - runPhase * 9 : -14;
  const backFootX = isJumping ? -16 : isRunning ? -10 - runPhase * 12 : -18;
  const backFootY = isJumping ? -6 : isRunning ? -Math.max(0, -runPhase * 6) : 0;

  const frontThighX = isJumping ? 4 : isRunning ? 2 + runPhase * 9 : 7;
  const frontFootX = isJumping ? 8 : isRunning ? 5 + runPhase * 12 : 10;
  const frontFootY = isJumping ? -9 : isRunning ? -Math.max(0, runPhase * 6) : 0;

  // --- BACK LEG ---
  // Silver thigh
  inkPoly(
    ctx,
    [
      [backThighX + 2, -28],
      [backThighX + 10, -28],
      [backFootX + 9, -15 + backFootY],
      [backFootX + 1, -15 + backFootY],
    ],
    silverMid,
    outline,
  );
  pxRect(ctx, backThighX + 3, -26, 4, 8, silverLight);
  // Blue greave & boot
  inkPoly(
    ctx,
    [
      [backFootX, -17 + backFootY],
      [backFootX + 10, -17 + backFootY],
      [backFootX + 12, -5 + backFootY],
      [backFootX - 3, -5 + backFootY],
    ],
    blueDark,
    outline,
  );
  // Armored boot sole & toe
  inkPoly(
    ctx,
    [
      [backFootX - 4, -6 + backFootY],
      [backFootX + 14, -6 + backFootY],
      [backFootX + 16, backFootY],
      [backFootX - 4, backFootY],
    ],
    blueDeep,
    outline,
  );
  pxRect(ctx, backFootX + 1, -15 + backFootY, 5, 6, blueMid);
  pxRect(ctx, backFootX + 6, -4 + backFootY, 7, 2, silverLight);

  // --- FRONT LEG ---
  // Silver thigh plate
  inkPoly(
    ctx,
    [
      [frontThighX - 3, -28],
      [frontThighX + 7, -28],
      [frontFootX + 8, -16 + frontFootY],
      [frontFootX - 2, -16 + frontFootY],
    ],
    silverLight,
    outline,
  );
  pxRect(ctx, frontThighX, -26, 4, 9, silverHi);
  // Dark mechanical knee joint + blue knee guard
  pxRect(ctx, frontFootX - 1, -18 + frontFootY, 9, 4, silverDark);
  // Flared blue greave
  inkPoly(
    ctx,
    [
      [frontFootX - 2, -16 + frontFootY],
      [frontFootX + 9, -16 + frontFootY],
      [frontFootX + 11, -5 + frontFootY],
      [frontFootX - 3, -5 + frontFootY],
    ],
    blueMid,
    outline,
  );
  pxRect(ctx, frontFootX + 1, -14 + frontFootY, 5, 7, blueHi);
  // Heavy combat boot
  inkPoly(
    ctx,
    [
      [frontFootX - 4, -6 + frontFootY],
      [frontFootX + 15, -6 + frontFootY],
      [frontFootX + 17, frontFootY],
      [frontFootX - 4, frontFootY],
    ],
    blueDark,
    outline,
  );
  pxRect(ctx, frontFootX + 5, -4 + frontFootY, 9, 2, silverLight);

  // --- TORSO & CHEST ARMOR ---
  // Pelvis & dark waist joint
  inkPoly(
    ctx,
    [
      [-9, -32],
      [9, -32],
      [11, -24],
      [-10, -24],
    ],
    blueDeep,
    outline,
  );
  pxRect(ctx, -3, -30, 7, 4, silverMid);
  // Sculpted silver chestplate
  inkPoly(
    ctx,
    [
      [-11, -52],
      [11, -52],
      [13, -41],
      [9, -31],
      [-9, -31],
      [-12, -42],
    ],
    silverLight,
    outline,
  );
  // Chest bevel shading & blue center crest
  pxRect(ctx, -10, -49, 4, 15, silverMid);
  pxRect(ctx, -3, -50, 9, 6, silverHi);
  inkBox(ctx, 1, -48, 8, 7, blueMid, outline, 1);
  pxRect(ctx, 3, -47, 4, 2, blueHi);

  // Back arm supporting rifle foregrip
  inkPoly(
    ctx,
    [
      [5, -47],
      [14, -44],
      [21, -39],
      [17, -36],
      [7, -40],
    ],
    silverMid,
    outline,
  );

  // --- HELMET & HEAD ---
  // Rounded/beveled cobalt helmet
  inkPoly(
    ctx,
    [
      [-11, -70],
      [-4, -75],
      [7, -75],
      [12, -68],
      [12, -53],
      [-11, -53],
    ],
    blueMid,
    outline,
  );
  // Helmet crest fin & top specular highlight
  inkPoly(
    ctx,
    [
      [-3, -76],
      [5, -76],
      [6, -71],
      [-4, -71],
    ],
    blueHi,
    outline,
    1,
  );
  pxRect(ctx, -6, -72, 10, 3, blueRim);
  // Side ear-com pod
  inkBox(ctx, -12, -66, 7, 10, blueDark, outline, 1);
  pxRect(ctx, -10, -64, 3, 6, silverLight);
  // Dark recessed faceplate & glowing visor
  inkPoly(
    ctx,
    [
      [1, -67],
      [12, -66],
      [12, -55],
      [2, -55],
    ],
    '#0B1120',
    outline,
    1,
  );
  // Glowing visor eyes
  pxRect(ctx, 4, -64, 7, 3, visorGold);
  pxRect(ctx, 6, -64, 4, 2, '#FEF9C3');
  // Silver chin guard
  pxRect(ctx, 2, -57, 9, 3, silverLight);

  // --- FRONT SHOULDER PAULDRON, ARM & PLASMA RIFLE ---
  const recoil = isShooting ? -5 : 0;
  // Curved shoulder pauldron
  inkPoly(
    ctx,
    [
      [-14, -53],
      [-2, -55],
      [1, -46],
      [-5, -41],
      [-14, -43],
    ],
    blueMid,
    outline,
  );
  pxRect(ctx, -11, -52, 8, 3, blueHi);
  pxRect(ctx, -10, -52, 5, 1, blueRim);

  // Articulated upper/lower arm holding grip
  inkPoly(
    ctx,
    [
      [-10, -43],
      [-3, -43],
      [5, -37],
      [14 + recoil, -39],
      [14 + recoil, -34],
      [2, -33],
      [-9, -37],
    ],
    silverLight,
    outline,
  );
  inkBox(ctx, 7 + recoil, -40, 8, 6, blueDark, outline, 1);

  // Futuristic Long-Barrel Plasma Rifle
  // Main dark steel receiver
  inkPoly(
    ctx,
    [
      [4 + recoil, -44],
      [34 + recoil, -44],
      [37 + recoil, -42],
      [37 + recoil, -37],
      [14 + recoil, -37],
      [10 + recoil, -34],
      [4 + recoil, -35],
    ],
    '#1E293B',
    outline,
  );
  // Upper gunmetal rail & scope
  pxRect(ctx, 8 + recoil, -46, 16, 3, silverDark);
  pxRect(ctx, 10 + recoil, -46, 10, 1, silverMid);
  // Glowing cyan plasma energy coils & barrel tip
  pxRect(ctx, 16 + recoil, -42, 12, 3, '#0E7490');
  pxRect(ctx, 18 + recoil, -41, 9, 2, '#22D3EE');
  pxRect(ctx, 31 + recoil, -42, 6, 4, '#22D3EE');
  pxRect(ctx, 34 + recoil, -41, 4, 2, '#ECFEFF');

  // Starburst muzzle flash on shot
  if (isShooting) {
    const f = Math.ceil(hero.shootAnimTimer * 30) % 2 === 0;
    const fx = 39 + recoil;
    const fy = -40;
    inkPoly(
      ctx,
      [
        [fx, fy - 10],
        [fx + 5, fy - 4],
        [fx + 16, fy],
        [fx + 5, fy + 4],
        [fx, fy + 10],
        [fx - 3, fy + 3],
        [fx - 3, fy - 3],
      ],
      f ? '#FEF08A' : '#4ADE80',
      '#22D3EE',
      1,
    );
    pxRect(ctx, fx + 1, fy - 2, 8, 4, '#FFFFFF');
  }

  // Charged AI-Split Blaster Buildup (>3s Spacebar Hold)
  if (hero.chargeProgress > 0) {
    const p = Math.max(0, Math.min(1, hero.chargeProgress));
    const muzzleX = 42;
    const muzzleY = -40;
    const pulse = 0.75 + Math.sin(time * 24) * 0.25;
    const radius = 6 + p * 14 * pulse;

    ctx.save();
    ctx.beginPath();
    ctx.arc(muzzleX, muzzleY, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = p >= 0.95 ? 'rgba(250, 204, 21, 0.35)' : 'rgba(34, 211, 238, 0.28)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(muzzleX, muzzleY, radius, 0, Math.PI * 2);
    ctx.fillStyle = p >= 0.95 ? '#FACC15' : '#22D3EE';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(muzzleX, muzzleY, Math.max(2, radius * 0.45), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Orbiting energy sparks drawn into the muzzle
    for (let i = 0; i < 4; i += 1) {
      const ang = time * 10 + (i * Math.PI) / 2;
      const dist = (1 - p * 0.65) * 22 + 4;
      const sx = muzzleX + Math.cos(ang) * dist;
      const sy = muzzleY + Math.sin(ang) * dist;
      pxRect(ctx, sx - 2, sy - 2, 4, 4, i % 2 === 0 ? '#67E8F9' : '#FEF08A');
    }
    ctx.restore();
  }

  ctx.restore();

  // Overhead Charge Progress Bar (drawn un-flipped in world space)
  if (hero.chargeProgress > 0) {
    const p = Math.max(0, Math.min(1, hero.chargeProgress));
    const bw = 74;
    const bh = 10;
    const bx = Math.round(hero.x - bw / 2);
    const by = Math.round(hero.y - 102);

    pxRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, '#020617');
    pxRect(ctx, bx, by, bw, bh, '#0F172A');
    pxRect(ctx, bx, by, Math.round(bw * p), bh, p >= 0.95 ? '#FACC15' : '#22D3EE');

    ctx.save();
    ctx.font = 'bold 10px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = p >= 0.95 ? '#FEF08A' : '#67E8F9';
    ctx.fillText(p >= 0.95 ? 'AI SPLIT!' : 'CHARGING...', Math.round(hero.x), by - 4);
    ctx.restore();
  }
};

export const drawRobotPortrait = (canvas: HTMLCanvasElement): void  => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Deep cyber navy frame background
  pxRect(ctx, 0, 0, 40, 40, '#111C33');

  // Sculpted armor shoulders & collar
  inkPoly(
    ctx,
    [
      [3, 40],
      [7, 30],
      [33, 30],
      [37, 40],
    ],
    '#1E40AF',
    '#060A14',
    2,
  );
  inkBox(ctx, 12, 31, 16, 9, '#E2E8F0', '#060A14', 1.5);

  // Beveled blue commando helmet
  inkPoly(
    ctx,
    [
      [9, 10],
      [15, 5],
      [25, 5],
      [31, 10],
      [31, 29],
      [9, 29],
    ],
    '#2563EB',
    '#060A14',
    2,
  );
  // Top crest highlight
  pxRect(ctx, 14, 7, 12, 3, '#93C5FD');
  // Ear-com side pods
  inkBox(ctx, 5, 14, 5, 11, '#1E3A8A', '#060A14', 1.5);
  inkBox(ctx, 30, 14, 5, 11, '#1E3A8A', '#060A14', 1.5);
  pxRect(ctx, 7, 16, 2, 6, '#94A3B8');
  pxRect(ctx, 31, 16, 2, 6, '#94A3B8');

  // Recessed faceplate & glowing visor
  inkBox(ctx, 12, 13, 16, 13, '#090E1A', '#060A14', 1.5);
  pxRect(ctx, 14, 16, 12, 4, '#FDE047');
  pxRect(ctx, 16, 16, 8, 2, '#FEF9C3');
  // Silver chin guard
  pxRect(ctx, 14, 23, 12, 3, '#CBD5E1');
}
