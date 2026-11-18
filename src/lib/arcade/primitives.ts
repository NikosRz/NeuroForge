import { CANVAS_WIDTH } from './world';

export const pxRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void  => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export const drawPixelLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  bottomY: number,
  highlighted: boolean,
  accentKey?: string,
): void  => {
  ctx.save();
  ctx.font = 'bold 14px "Silkscreen", monospace';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  const padX = 10;
  const boxW = Math.ceil(metrics.width) + padX * 2;
  const boxH = 24;
  const bx = Math.round(centerX - boxW / 2);
  const by = Math.round(bottomY - boxH);

  // Pixel border box
  pxRect(ctx, bx - 2, by - 2, boxW + 4, boxH + 4, highlighted ? '#22D3EE' : '#0F172A');
  pxRect(ctx, bx, by, boxW, boxH, '#0B1221');
  pxRect(ctx, bx, by, boxW, 2, highlighted ? '#67E8F9' : '#334155');
  pxRect(ctx, bx, by + boxH - 2, boxW, 2, '#1E293B');

  // Render text with optional highlighted [K] suffix
  if (accentKey && text.endsWith(`[${accentKey}]`)) {
    const prefix = text.slice(0, text.length - (`[${accentKey}]`).length);
    const keyPart = `[${accentKey}]`;
    const prefixW = ctx.measureText(prefix).width;
    const totalW = metrics.width;
    const startX = Math.round(centerX - totalW / 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(prefix, startX, by + boxH / 2 + 1);
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(keyPart, Math.round(startX + prefixW), by + boxH / 2 + 1);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(text, Math.round(centerX), by + boxH / 2 + 1);
  }
  ctx.restore();
};

export const inkPoly = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
  fill: string,
  outline = '#060A14',
  lineWidth = 2,
): void  => {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.stroke();
}

export const inkBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  outline = '#060A14',
  lineWidth = 2,
): void  => {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  ctx.fillStyle = fill;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = outline;
  ctx.strokeRect(rx, ry, rw, rh);
}

export const wrapCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else if (!current) {
      current = word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        break;
      }
    }
  }

  // Remaining words go on the final line (truncated with ellipsis if needed)
  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
  const remainder = words.slice(consumedWords).join(' ');
  let lastLine = remainder || current;

  if (ctx.measureText(lastLine).width > maxWidth) {
    while (lastLine.length > 1 && ctx.measureText(`${lastLine}...`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lastLine = `${lastLine.trimEnd()}...`;
  }

  lines.push(lastLine);
  return lines.slice(0, maxLines);
};
