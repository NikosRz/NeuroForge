import { pxRect } from './primitives';
import type { FloatingText, LaserBolt, LevelUpBanner, Particle } from './types';
import { CANVAS_WIDTH } from './world';

export const drawEffects = (
  ctx: CanvasRenderingContext2D,
  lasers: ReadonlyArray<LaserBolt>,
  particles: ReadonlyArray<Particle>,
  floatingTexts: ReadonlyArray<FloatingText>,
  banner: LevelUpBanner
): void => {
  // Laser bolts (regular + charged AI split super-shot)
  lasers.forEach((bolt) => {
    if (bolt.charged) {
      const tailX = bolt.dir === 1 ? bolt.x - 68 : bolt.x + 12;
      pxRect(ctx, tailX, bolt.y - 8, 60, 16, 'rgba(34, 211, 238, 0.45)');
      pxRect(ctx, bolt.x - 16, bolt.y - 10, 34, 20, '#22D3EE');
      pxRect(ctx, bolt.x - 12, bolt.y - 6, 26, 12, '#FACC15');
      pxRect(ctx, bolt.x - 6, bolt.y - 3, 18, 6, '#FFFFFF');
      return;
    }

    const tailX = bolt.dir === 1 ? bolt.x - 42 : bolt.x + 8;
    pxRect(ctx, tailX, bolt.y - 3, 34, 6, 'rgba(34, 211, 238, 0.55)');
    pxRect(ctx, bolt.x - 10, bolt.y - 4, 22, 8, '#4ADE80');
    pxRect(ctx, bolt.x - 6, bolt.y - 2, 16, 4, '#FEF08A');
    pxRect(ctx, bolt.x + (bolt.dir === 1 ? 4 : -8), bolt.y - 2, 6, 4, '#FFFFFF');
  });

  // Particles
  particles.forEach((pt) => {
    const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    ctx.globalAlpha = alpha;
    pxRect(ctx, pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size, pt.color);
  });
  ctx.globalAlpha = 1;

  // Floating +XP popups
  floatingTexts.forEach((ft) => {
    const alpha = Math.max(0, Math.min(1, (ft.life / ft.maxLife) * 1.4));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(ft.text, Math.round(ft.x) + 2, Math.round(ft.y) + 2);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
    ctx.restore();
  });

  // Level Up retro arcade banner
  if (banner.active) {
    const progress = 1 - banner.timer / banner.maxTimer;
    const alpha = progress > 0.8 ? (1 - progress) * 5 : 1;
    const slideY = progress < 0.15 ? -30 * (1 - progress / 0.15) : 0;
    const bw = 420;
    const bh = 64;
    const bx = Math.round(CANVAS_WIDTH / 2 - bw / 2);
    const by = Math.round(138 + slideY);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    pxRect(ctx, bx - 4, by - 4, bw + 8, bh + 8, '#0F172A');
    pxRect(ctx, bx, by, bw, bh, '#FACC15');
    pxRect(ctx, bx + 4, by + 4, bw - 8, bh - 8, '#1E293B');
    ctx.font = 'bold 20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`LEVEL UP! LV.${banner.level}`, CANVAS_WIDTH / 2, by + bh / 2 + 2);
    ctx.restore();
  }
};
