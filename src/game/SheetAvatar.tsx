import React, { useEffect, useState } from 'react';
import { ASSET_PACK, AvatarSlot, PackAvatarPart, packFileUrl } from './pack';
import { AvatarFacing, AvatarGrid, LayerInput, RgbaImage, composeAvatar, viewFor } from './avatarLayers';

/**
 * Carrega as camadas do avatar (pacote oficial) e desenha o personagem empilhando as camadas.
 * Cada combinação visual + direção + quadro vira uma imagem em cache.
 */

export interface AvatarLookLike {
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  pants?: string;
  pantsColor: string;
  shoes?: string;
  shoesColor: string;
  hat: string;
  hatColor: string;
}

export interface LoadedAvatarPack {
  grid: AvatarGrid;
  body: RgbaImage;
  skinKey: string;
  parts: (PackAvatarPart & { image: RgbaImage })[];
  order: AvatarSlot[];
}

let packPromise: Promise<LoadedAvatarPack | null> | null = null;
const cache = new Map<string, { url: string; bob: number; anchorX: number; anchorY: number; w: number; h: number }>();

function loadRgba(url: string): Promise<RgbaImage | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      resolve({ w: canvas.width, h: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function loadAvatarPack(): Promise<LoadedAvatarPack | null> {
  if (packPromise) return packPromise;
  const cfg = ASSET_PACK.avatar;
  const bodyUrl = packFileUrl(cfg?.body?.file);
  if (!cfg || !bodyUrl) {
    packPromise = Promise.resolve(null);
    return packPromise;
  }
  packPromise = (async () => {
    const body = await loadRgba(bodyUrl);
    if (!body) return null;
    const parts = await Promise.all(cfg.parts.map(async p => {
      const url = packFileUrl(p.file);
      const image = url ? await loadRgba(url) : null;
      return image ? { ...p, image } : null;
    }));
    return {
      grid: cfg.grid,
      body,
      skinKey: cfg.body.skin || '#fdc996',
      parts: parts.filter((p): p is PackAvatarPart & { image: RgbaImage } => Boolean(p)),
      order: cfg.order || ['sapato', 'calca', 'roupa', 'cabelo', 'chapeu'],
    };
  })();
  return packPromise;
}

export function useAvatarPack(): LoadedAvatarPack | null {
  const [pack, setPack] = useState<LoadedAvatarPack | null>(null);
  useEffect(() => {
    let alive = true;
    loadAvatarPack().then(p => { if (alive) setPack(p); });
    return () => { alive = false; };
  }, []);
  return pack;
}

// Qual peça de cada slot o visual usa (ids antigos/inexistentes caem na primeira peça do slot)
export function resolveParts(pack: LoadedAvatarPack, look: AvatarLookLike) {
  const pick = (slot: AvatarSlot, id: string | undefined, optional: boolean) => {
    const list = pack.parts.filter(p => p.slot === slot);
    if (optional && (!id || id === 'nenhum' || id === 'careca')) return null;
    return list.find(p => p.id === id) || (optional ? null : list[0] || null);
  };
  return {
    roupa: pick('roupa', look.top, false),
    calca: pick('calca', look.pants, false),
    sapato: pick('sapato', look.shoes, false),
    cabelo: pick('cabelo', look.hair, true),
    chapeu: pick('chapeu', look.hat, true),
  } as Record<AvatarSlot, (PackAvatarPart & { image: RgbaImage }) | null>;
}

const slotColor = (look: AvatarLookLike, slot: AvatarSlot) =>
  ({ roupa: look.topColor, calca: look.pantsColor, sapato: look.shoesColor, cabelo: look.hairColor, chapeu: look.hatColor }[slot]);

export type AvatarFrame = 'parado' | 'andar_1' | 'andar_2' | 'andar_3' | 'andar_4' | 'sentado';

function render(pack: LoadedAvatarPack, look: AvatarLookLike, dir: AvatarFacing, frame: AvatarFrame) {
  const { view } = viewFor(dir);
  const key = `${JSON.stringify(look)}|${view}|${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const chosen = resolveParts(pack, look);
  const layers: LayerInput[] = [{ image: pack.body, skin: { key: pack.skinKey, tone: look.skin } }];
  for (const slot of pack.order) {
    const part = chosen[slot];
    if (part) layers.push({ image: part.image, tint: part.tint ? slotColor(look, slot) : null });
  }
  const c = composeAvatar(layers, pack.grid, view, frame);
  const canvas = document.createElement('canvas');
  canvas.width = c.w;
  canvas.height = c.h;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(c.data), c.w, c.h), 0, 0);
  const entry = { url: canvas.toDataURL('image/png'), bob: c.bob, anchorX: c.anchorX, anchorY: c.anchorY, w: c.w, h: c.h };
  if (cache.size > 500) cache.clear();
  cache.set(key, entry);
  return entry;
}

interface SheetAvatarProps {
  pack: LoadedAvatarPack;
  look: AvatarLookLike;
  dir: AvatarFacing;
  frame?: AvatarFrame;
  x: number; // pé do personagem na cena
  y: number;
}

// Avatar dentro de um <svg>
export const SheetAvatar: React.FC<SheetAvatarProps> = ({ pack, look, dir, frame = 'parado', x, y }) => {
  const r = render(pack, look, dir, frame);
  const { flip } = viewFor(dir);
  const left = flip ? x - (r.w - r.anchorX) : x - r.anchorX;
  const top = y - r.anchorY + r.bob;
  return (
    <image
      href={r.url}
      x={left}
      y={top}
      width={r.w}
      height={r.h}
      style={{ imageRendering: 'pixelated' }}
      transform={flip ? `translate(${2 * left + r.w} 0) scale(-1 1)` : undefined}
    />
  );
};

// Vitrine com as vistas (provador)
export const SheetAvatarViews: React.FC<{ pack: LoadedAvatarPack; look: AvatarLookLike; height?: number; dirs?: AvatarFacing[] }> = ({
  pack, look, height = 110, dirs = ['n', 'e', 's', 'sw', 'nw'],
}) => {
  const cell = 46;
  const h = 100;
  return (
    <svg viewBox={`0 0 ${cell * dirs.length} ${h}`} width="100%" height={height} shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {dirs.map((d, i) => (
        <SheetAvatar key={d} pack={pack} look={look} dir={d} x={i * cell + cell / 2} y={h - 4} />
      ))}
    </svg>
  );
};
