import { Game } from '../data/game.model';

// Export PNG de l'étagère : une composition dessinée sur un canvas (pas une capture d'écran).
// Appelé par etagere-page.ts. Formats : carré pour les posts, portrait pour Instagram, paysage pour X et Discord.
export type ExportFormat = 'square' | 'portrait' | 'landscape';

const SIZES: Record<ExportFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1600, h: 900 },
};
const COVER_RATIO = 226 / 170;
// Au-delà, les jaquettes deviennent illisibles en image : on en montre 60 et on écrit le reste.
export const MAX_COVERS = 60;
const TIMEOUT_MS = 8000;

export interface ExportInput {
  games: Game[];
  name: string;
  countLabel: string;
  dateLabel: string;
  brand: string;
  // Texte pour les jeux au-delà de MAX_COVERS (ex. « et 40 autres »).
  moreLabel: string;
  format: ExportFormat;
}

// Nombre de colonnes qui donne les plus grandes cartouches dans la zone.
function layout(n: number, w: number, h: number) {
  let best = { cols: 1, cw: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = Math.min((w / cols) * 0.8, ((h / rows) * 0.8) / COVER_RATIO);
    if (cw > best.cw) best = { cols, cw };
  }
  return { ...best, rows: Math.ceil(n / best.cols) };
}

// Jaquette chargée en CORS ; sinon null, et la cartouche prend la couleur de sa bande.
function loadCover(game: Game): Promise<HTMLImageElement | null> {
  const src = game.cover;
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShelfPng(input: ExportInput): Promise<Blob> {
  const { w, h } = SIZES[input.format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');

  // La police doit être prête avant de dessiner, sinon le texte part en police de repli.
  await document.fonts.load('800 56px "Bricolage Grotesque"').catch(() => undefined);
  const shown = input.games.slice(0, MAX_COVERS);
  const covers = await Promise.all(shown.map(loadCover));

  ctx.fillStyle = '#0e0e10';
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.06);
  const headH = Math.round(h * 0.2);
  const footH = Math.round(h * 0.1);
  ctx.fillStyle = '#f4eee6';
  ctx.font = `800 ${Math.round(w * 0.055)}px "Bricolage Grotesque", sans-serif`;
  ctx.fillText(input.name, pad, pad + Math.round(w * 0.05));
  ctx.fillStyle = '#8a8a92';
  ctx.font = `${Math.round(w * 0.018)}px "JetBrains Mono", monospace`;
  ctx.fillText(`${input.countLabel} · ${input.dateLabel}`, pad, headH - Math.round(h * 0.02));

  const areaW = w - 2 * pad;
  const areaH = h - headH - footH;
  const { cols, cw, rows } = layout(shown.length, areaW, areaH);
  const ch = cw * COVER_RATIO;
  const gridW = cols * cw;
  const x0 = pad + (areaW - gridW) / 2;
  const cellH = areaH / rows;
  shown.forEach((game, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = x0 + col * cw + cw * 0.05;
    const y = headH + row * cellH + (cellH - ch) / 2;
    const img = covers[i];
    ctx.save();
    roundRect(ctx, x, y, cw * 0.9, ch * 0.9, cw * 0.04);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, x, y, cw * 0.9, ch * 0.9);
    } else {
      ctx.fillStyle = game.band || '#232327';
      ctx.fillRect(x, y, cw * 0.9, ch * 0.9);
    }
    ctx.restore();
    // Planche sous la rangée.
    if (col === cols - 1 || i === shown.length - 1) {
      ctx.fillStyle = '#6b4424';
      ctx.fillRect(
        x0,
        headH + row * cellH + cellH - Math.round(h * 0.008),
        gridW,
        Math.round(h * 0.008),
      );
    }
  });

  ctx.fillStyle = '#f0a84e';
  ctx.font = `800 ${Math.round(w * 0.03)}px "Bricolage Grotesque", sans-serif`;
  ctx.fillText(input.brand, pad, h - pad / 2);
  if (input.games.length > MAX_COVERS) {
    ctx.fillStyle = '#8a8a92';
    ctx.font = `${Math.round(w * 0.018)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(input.moreLabel, w - pad, h - pad / 2);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG impossible'))),
      'image/png',
    ),
  );
}
