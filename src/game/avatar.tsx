import React, { memo, useMemo } from 'react';
import { shade } from './iso';
import { UnlockRule } from './mobis';

/**
 * Avatar no estilo dos quartos isométricos (proporções de cabeça grande, vista 3/4).
 * Desenho procedural em pixels de 1px num quadro de 32x64, com âncora no pé (16, 62).
 * Direções: 'se' (frente-direita), 'sw' (frente-esquerda), 'ne' (costas-direita), 'nw' (costas-esquerda).
 */

export type AvatarDir = 'se' | 'sw' | 'ne' | 'nw';

export interface AvatarLook {
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  pants?: string; // id da calça no pacote de avatar
  pantsColor: string;
  shoes?: string; // id do sapato no pacote de avatar
  shoesColor: string;
  hat: string;
  hatColor: string;
}

export const DEFAULT_LOOK: AvatarLook = {
  skin: '#f1c7a1',
  hair: 'curto',
  hairColor: '#5d3a1a',
  top: 'camiseta',
  topColor: '#3b5dc9',
  pants: 'padrao',
  pantsColor: '#333c57',
  shoes: 'tenis',
  shoesColor: '#1a1c2c',
  hat: 'nenhum',
  hatColor: '#b13e53',
};

export const SKIN_TONES = ['#ffe0c7', '#f1c7a1', '#e0a77e', '#c68650', '#9a6038', '#6b3f22'];
export const PALETTE_CHOICES = [
  '#1a1c2c', '#f4f4f4', '#94b0c2', '#566c86', '#5d3a1a', '#8b5a2b', '#c28a4a', '#ffcd75',
  '#ef7d57', '#b13e53', '#d9638f', '#a855f7', '#3b5dc9', '#41a6f6', '#73eff7', '#38b764', '#257179', '#a7f070',
];

export interface WardrobeOption {
  id: string;
  name: string;
  unlock: UnlockRule;
}

export const HAIR_STYLES: WardrobeOption[] = [
  { id: 'curto', name: 'Curto', unlock: { type: 'default' } },
  { id: 'longo', name: 'Longo', unlock: { type: 'default' } },
  { id: 'rabo', name: 'Rabo de cavalo', unlock: { type: 'default' } },
  { id: 'careca', name: 'Careca', unlock: { type: 'default' } },
  { id: 'franja', name: 'Franja', unlock: { type: 'level', level: 3 } },
  { id: 'espetado', name: 'Espetado', unlock: { type: 'level', level: 6 } },
  { id: 'black', name: 'Black Power', unlock: { type: 'achievement', id: 'categorizador_100', label: 'Organizador' } },
  { id: 'moicano', name: 'Moicano', unlock: { type: 'level', level: 8 } },
];

export const TOP_STYLES: WardrobeOption[] = [
  { id: 'camiseta', name: 'Camiseta', unlock: { type: 'default' } },
  { id: 'manga_longa', name: 'Manga longa', unlock: { type: 'default' } },
  { id: 'regata', name: 'Regata', unlock: { type: 'default' } },
  { id: 'moletom', name: 'Moletom', unlock: { type: 'achievement', id: 'semanas_4', label: 'Ritmo Semanal' } },
  { id: 'terno', name: 'Terno', unlock: { type: 'achievement', id: 'mes_azul', label: 'No Azul' } },
  { id: 'jaleco', name: 'Colete do Tesoureiro', unlock: { type: 'achievement', id: 'primeira_reserva', label: 'Primeiro Tijolo' } },
];

export const HATS: WardrobeOption[] = [
  { id: 'nenhum', name: 'Nenhum', unlock: { type: 'default' } },
  { id: 'gorro', name: 'Gorro', unlock: { type: 'default' } },
  { id: 'bone', name: 'Boné', unlock: { type: 'level', level: 2 } },
  { id: 'fone', name: 'Fone de ouvido', unlock: { type: 'level', level: 5 } },
  { id: 'cartola', name: 'Cartola', unlock: { type: 'level', level: 10 } },
  { id: 'coroa', name: 'Coroa do Tesouro', unlock: { type: 'achievement', id: 'reserva_completa', label: 'Fortaleza' } },
];

type R = [number, number, number, number, string]; // x, y, w, h, cor

const OUTLINE = '#1a1c2c';

interface Pose {
  frame: 0 | 1 | 2; // 0 parado, 1/2 passos
  sitting: boolean;
}

// Monta as partes do corpo em coordenadas locais (vista frente 'se' ou costas 'nw')
function buildParts(look: AvatarLook, back: boolean, pose: Pose): { outline: R[]; fill: R[] } {
  const outline: R[] = [];
  const fill: R[] = [];
  const part = (x: number, y: number, w: number, h: number, c: string, withOutline = true) => {
    if (withOutline) outline.push([x - 1, y - 1, w + 2, h + 2, OUTLINE]);
    fill.push([x, y, w, h, c]);
  };
  const skin = look.skin;
  const skinDark = shade(skin, -0.18);
  const top = look.topColor;
  const topDark = shade(top, -0.25);
  const pants = look.pantsColor;
  const pantsDark = shade(pants, -0.25);
  const shoes = look.shoesColor;
  const sit = pose.sitting;
  const bob = !sit && pose.frame !== 0 ? -1 : 0;
  const yo = (sit ? 8 : 0) + bob; // deslocamento vertical do tronco/cabeça

  // --- Pernas e sapatos ---
  if (sit) {
    // coxas para frente e canelas para baixo (sentado)
    part(10, 48, 6, 5, pants);
    part(17, 49, 6, 5, pantsDark);
    part(13, 52, 4, 6, pants);
    part(20, 53, 4, 6, pantsDark);
    part(12, 57, 6, 3, shoes);
    part(19, 58, 6, 3, shoes);
  } else {
    const lf = pose.frame === 1 ? [-1, 1] : pose.frame === 2 ? [1, -1] : [0, 0];
    const rf = pose.frame === 1 ? [1, -1] : pose.frame === 2 ? [-1, 1] : [0, 0];
    part(10 + lf[0], 46, 5, 11 + lf[1], back ? pantsDark : pants);
    part(17 + rf[0], 47, 5, 11 + rf[1], back ? pants : pantsDark);
    part(9 + lf[0], 56 + lf[1], 6, 4, shoes);
    part(17 + rf[0], 57 + rf[1], 6, 4, shoes);
  }

  // --- Braços (atrás do tronco no contorno) ---
  const armSwing = sit ? 0 : pose.frame === 1 ? 1 : pose.frame === 2 ? -1 : 0;
  const sleeveLong = look.top === 'manga_longa' || look.top === 'moletom' || look.top === 'terno';
  const sleeveColorL = look.top === 'regata' ? skin : look.top === 'terno' ? '#262b44' : top;
  const sleeveColorR = look.top === 'regata' ? skinDark : look.top === 'terno' ? '#1b1f33' : topDark;
  const armL = (x: number, y: number) => {
    if (sleeveLong) {
      part(x, y, 4, 13, sleeveColorL);
      part(x, y + 13, 4, 3, skin);
    } else {
      part(x, y, 4, 5, sleeveColorL);
      part(x, y + 5, 4, 11, skin);
    }
  };
  const armR = (x: number, y: number) => {
    if (sleeveLong) {
      part(x, y, 4, 13, sleeveColorR);
      part(x, y + 13, 4, 3, skinDark);
    } else {
      part(x, y, 4, 5, sleeveColorR);
      part(x, y + 5, 4, 11, skinDark);
    }
  };
  armL(5, 31 + yo + armSwing);
  armR(23, 31 + yo - armSwing);

  // --- Tronco ---
  const torsoY = 30 + yo;
  const torsoH = sit ? 18 : 17;
  if (look.top === 'terno') {
    part(9, torsoY, 14, torsoH, '#262b44');
    fill.push([18, torsoY, 5, torsoH, '#1b1f33']);
    if (!back) {
      fill.push([13, torsoY, 4, 8, '#f4f4f4']);
      fill.push([14, torsoY + 1, 2, 7, '#b13e53']);
    }
  } else if (look.top === 'jaleco') {
    part(9, torsoY, 14, torsoH, '#f4f4f4');
    fill.push([18, torsoY, 5, torsoH, '#cfd6de']);
    if (!back) {
      fill.push([10, torsoY, 4, torsoH, top]);
      fill.push([15, torsoY, 3, torsoH, top]);
      fill.push([11, torsoY + 8, 2, 2, '#ffcd75']);
    }
  } else {
    part(9, torsoY, 14, torsoH, back ? topDark : top);
    fill.push([18, torsoY, 5, torsoH, back ? top : topDark]);
    if (look.top === 'regata' && !back) {
      fill.push([11, torsoY, 2, 3, skin]);
      fill.push([16, torsoY, 2, 3, skin]);
    }
    if (look.top === 'moletom') {
      fill.push([11, torsoY + 10, 7, 4, shade(top, -0.12)]);
      part(10, torsoY - 3, 12, 4, shade(top, 0.1));
    }
  }

  // --- Pescoço e cabeça ---
  const hy = 6 + yo;
  part(14, 27 + yo, 5, 4, skinDark, false);
  part(8, hy, 18, 22, skin);
  fill.push([8, hy, 4, 22, skinDark]); // lateral da cabeça
  if (!back) {
    // olhos, brilho e boca (rosto voltado para frente-direita)
    fill.push([16, hy + 9, 2, 3, OUTLINE]);
    fill.push([21, hy + 9, 2, 3, OUTLINE]);
    fill.push([16, hy + 9, 1, 1, '#f4f4f4']);
    fill.push([21, hy + 9, 1, 1, '#f4f4f4']);
    fill.push([18, hy + 16, 3, 1, shade(skin, -0.4)]);
    fill.push([9, hy + 10, 2, 4, shade(skin, -0.3)]); // orelha
  }

  // --- Cabelo ---
  const hc = look.hairColor;
  const hcDark = shade(hc, -0.25);
  const hairTop = () => {
    part(7, hy - 2, 20, 9, hc);
    fill.push([7, hy - 2, 5, 9, hcDark]);
  };
  switch (look.hair) {
    case 'curto':
      hairTop();
      fill.push([7, hy + 6, 4, 8, hcDark]);
      if (back) fill.push([8, hy + 6, 18, 10, hc]);
      break;
    case 'longo':
      hairTop();
      part(6, hy + 5, 6, 22, hcDark);
      if (back) part(8, hy + 5, 18, 22, hc);
      else fill.push([23, hy + 5, 3, 10, hc]);
      break;
    case 'rabo':
      hairTop();
      if (back) fill.push([8, hy + 6, 18, 9, hc]);
      part(3, hy + 6, 5, 14, hcDark);
      break;
    case 'franja':
      hairTop();
      fill.push([7, hy + 6, 4, 8, hcDark]);
      if (!back) fill.push([12, hy + 6, 13, 3, hc]);
      else fill.push([8, hy + 6, 18, 10, hc]);
      break;
    case 'espetado':
      hairTop();
      for (let i = 0; i < 5; i++) part(8 + i * 4, hy - 5 - (i % 2) * 2, 3, 4, i < 2 ? hcDark : hc);
      if (back) fill.push([8, hy + 6, 18, 8, hc]);
      break;
    case 'black':
      part(4, hy - 6, 26, 16, hc);
      fill.push([4, hy - 6, 7, 16, hcDark]);
      if (back) fill.push([6, hy + 8, 22, 8, hc]);
      break;
    case 'careca':
    default:
      fill.push([20, hy + 2, 3, 2, shade(skin, 0.25)]); // brilho
      break;
  }

  // --- Chapéus ---
  const hat = look.hatColor;
  switch (look.hat) {
    case 'gorro':
      part(7, hy - 4, 20, 8, hat);
      fill.push([7, hy - 4, 5, 8, shade(hat, -0.25)]);
      fill.push([7, hy + 2, 20, 2, shade(hat, 0.2)]);
      part(15, hy - 7, 4, 3, shade(hat, 0.3));
      break;
    case 'bone':
      part(7, hy - 3, 20, 7, hat);
      fill.push([7, hy - 3, 5, 7, shade(hat, -0.25)]);
      if (!back) part(20, hy + 3, 10, 2, shade(hat, -0.15));
      break;
    case 'fone':
      part(6, hy - 4, 22, 2, '#333c57');
      part(4, hy + 7, 4, 7, hat);
      if (!back) part(26, hy + 7, 3, 6, shade(hat, -0.2));
      break;
    case 'cartola':
      part(5, hy - 1, 24, 3, '#1a1c2c');
      part(9, hy - 15, 16, 14, '#262b44');
      fill.push([9, hy - 5, 16, 3, hat]);
      break;
    case 'coroa':
      part(8, hy - 6, 18, 6, '#ffcd75');
      fill.push([8, hy - 6, 5, 6, '#e0a33a']);
      for (let i = 0; i < 4; i++) part(8 + i * 5, hy - 9, 3, 3, '#ffcd75');
      fill.push([15, hy - 4, 3, 2, '#b13e53']);
      fill.push([21, hy - 4, 2, 2, '#41a6f6']);
      break;
    default:
      break;
  }

  return { outline, fill };
}

interface AvatarProps {
  look: AvatarLook;
  dir: AvatarDir;
  frame?: 0 | 1 | 2;
  sitting?: boolean;
  x: number; // âncora (pé) na cena
  y: number;
  scale?: number;
}

export const Avatar: React.FC<AvatarProps> = memo(({ look, dir, frame = 0, sitting = false, x, y, scale = 1 }) => {
  const back = dir === 'ne' || dir === 'nw';
  const flip = dir === 'sw' || dir === 'ne';
  const lookKey = JSON.stringify(look);
  const { outline, fill } = useMemo(
    () => buildParts(look, back, { frame, sitting }),
    [lookKey, back, frame, sitting] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // âncora do quadro local: (16, 62)
  const transform = flip
    ? `translate(${x + 16 * scale} ${y - 62 * scale}) scale(${-scale} ${scale})`
    : `translate(${x - 16 * scale} ${y - 62 * scale}) scale(${scale})`;
  return (
    <g transform={transform}>
      {outline.map(([rx, ry, w, h, c], i) => <rect key={`o${i}`} x={rx} y={ry} width={w} height={h} fill={c} />)}
      {fill.map(([rx, ry, w, h, c], i) => <rect key={`f${i}`} x={rx} y={ry} width={w} height={h} fill={c} />)}
    </g>
  );
});

// Direção a partir do passo na grade
export function dirFromStep(dx: number, dy: number, current: AvatarDir): AvatarDir {
  if (dx > 0) return 'se';
  if (dy > 0) return 'sw';
  if (dx < 0) return 'nw';
  if (dy < 0) return 'ne';
  return current;
}

// Cartão de pré-visualização (provador)
export const AvatarPreview: React.FC<{ look: AvatarLook; dir?: AvatarDir; size?: number }> = ({ look, dir = 'se', size = 96 }) => (
  <svg viewBox="0 -4 32 68" width={size * 0.5} height={size} shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
    <Avatar look={look} dir={dir} x={16} y={62} />
  </svg>
);
