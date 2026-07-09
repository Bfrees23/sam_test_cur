// Offscreen bitmap cache — bake pixel sprites once, blit with drawImage

import { OUTLINE } from './pixel-data.js';

const DEFAULT_SCALE = 3;

function rasterizeFrame(ctx, rows, palette, scale, flipX, withOutline = true) {
  const h = rows.length;
  const w = rows[0].length;
  const sz = Math.ceil(scale);

  const getCh = (row, col) => {
    if (row < 0 || row >= h || col < 0 || col >= w) return '.';
    const ci = flipX ? w - 1 - col : col;
    return rows[row][ci];
  };

  ctx.clearRect(0, 0, w * sz, h * sz);
  ctx.imageSmoothingEnabled = false;

  if (withOutline) {
    ctx.fillStyle = OUTLINE;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const ch = getCh(row, col);
        if (ch === '.' || ch === ' ') continue;
        const px = col * sz;
        const py = row * sz;
        if (getCh(row - 1, col) === '.') ctx.fillRect(px, py - 1, sz, 1);
        if (getCh(row + 1, col) === '.') ctx.fillRect(px, py + sz, sz, 1);
        if (getCh(row, col - 1) === '.') ctx.fillRect(px - 1, py, 1, sz);
        if (getCh(row, col + 1) === '.') ctx.fillRect(px + 1, py, 1, sz);
      }
    }
  }

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const ch = getCh(row, col);
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(col * sz, row * sz, sz, sz);
    }
  }

  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const ch = getCh(row, col);
      if (ch === '.' || ch === ' ') continue;
      if (getCh(row - 1, col) === '.' && getCh(row, col - 1) === '.') {
        ctx.fillRect(col * sz, row * sz, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function getAnimFrame(animTime, moving, frameCount) {
  if (!moving || frameCount <= 1) return 0;
  return Math.floor(animTime * 8) % frameCount;
}

export class SpriteBitmapCache {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  makeKey(id, frameIdx, scale, flipX) {
    return `${id}|${frameIdx}|${scale.toFixed(2)}|${flipX ? 1 : 0}`;
  }

  bake(id, sprite, frameIdx, scale = DEFAULT_SCALE, flipX = false) {
    const key = this.makeKey(id, frameIdx, scale, flipX);
    if (this.cache.has(key)) {
      this.stats.hits++;
      return this.cache.get(key);
    }

    this.stats.misses++;
    const rows = sprite.frames[frameIdx] || sprite.frames[0];
    const gridW = sprite.w || rows[0].length;
    const gridH = rows.length;
    const pixelScale = Math.max(1, Math.ceil(scale));

    const canvas = document.createElement('canvas');
    canvas.width = gridW * pixelScale;
    canvas.height = gridH * pixelScale;
    const ctx = canvas.getContext('2d');
    rasterizeFrame(ctx, rows, sprite.palette, pixelScale, flipX);

    const baked = {
      canvas,
      gridW,
      gridH,
      scale,
      pixelScale,
      width: canvas.width,
      height: canvas.height,
      anchorX: canvas.width / 2,
      anchorY: canvas.height - pixelScale * 2,
      footY: canvas.height - pixelScale,
    };

    this.cache.set(key, baked);
    return baked;
  }

  draw(ctx, baked, x, y, opts = {}) {
    const { bob = 0, alpha = 1, scaleMult = 1 } = opts;
    const destW = baked.width * scaleMult;
    const destH = baked.height * scaleMult;
    const dx = Math.round(x - baked.anchorX * scaleMult);
    const dy = Math.round(y - baked.anchorY * scaleMult + bob);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(baked.canvas, dx, dy, destW, destH);
    ctx.restore();
  }

  drawShadow(ctx, x, y, baked, opts = {}) {
    const { bob = 0, scaleMult = 1, alpha = 0.55 } = opts;
    const footY = y + bob;
    const sw = baked.gridW * baked.scale * scaleMult * 0.58;
    const sh = baked.gridH * baked.scale * scaleMult * 0.12;

    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x, footY, 0, x, footY, sw);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, footY, sw, sh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  preloadEntries(entries) {
    for (const { id, sprite, scales, frames } of entries) {
      const frameCount = frames ?? sprite.frames.length;
      const scaleList = scales ?? [sprite.scale || DEFAULT_SCALE];
      for (let f = 0; f < frameCount; f++) {
        for (const scale of scaleList) {
          this.bake(id, sprite, f, scale, false);
          this.bake(id, sprite, f, scale, true);
        }
      }
    }
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}

export const sharedSpriteCache = new SpriteBitmapCache();
