import packJson from './pack/pack.json';
import { UnlockRule } from './mobis';

/**
 * Pacote oficial de assets (vai junto com o app para todos os jogadores).
 * Coloque PNGs em src/game/pack/{mobis,pisos,paredes} e cadastre-os em pack.json.
 * Todas as imagens da pasta são empacotadas automaticamente pelo Vite.
 */

const files = import.meta.glob('./pack/**/*.{png,gif,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function packFileUrl(file: string | undefined): string | undefined {
  if (!file) return undefined;
  return files[`./pack/${file.replace(/^\.?\//, '')}`];
}

export interface PackMobi {
  id: string;
  name: string;
  description?: string;
  file: string;
  fileRotated?: string;
  w?: number;
  d?: number;
  category?: 'assentos' | 'mesas' | 'decoração' | 'tesouro' | 'raros';
  rooms?: ('finance' | 'life')[];
  qty?: number;
  walkable?: boolean;
  seat?: boolean;
  seatZ?: number;
  offsetX?: number;
  offsetY?: number;
  unlock?: UnlockRule;
}

export interface PackSurface {
  id: string;
  name: string;
  file: string;
  unlock?: UnlockRule;
}

export interface PackOverride {
  file: string;
  fileRotated?: string;
  offsetX?: number;
  offsetY?: number;
}

export type AvatarSlot = 'roupa' | 'calca' | 'sapato' | 'cabelo' | 'chapeu';

export interface PackAvatarPart {
  slot: AvatarSlot;
  id: string;
  name: string;
  file: string; // PNG exportado da camada do modelo (mesma grade)
  tint?: boolean; // desenhada em cinza: o app multiplica pela cor escolhida
  unlock?: UnlockRule;
}

export interface PackAvatar {
  grid: {
    cellW: number;
    cellH: number;
    anchorX: number;
    anchorY: number;
    views: string[];
    frames: string[];
  };
  body: { file: string; skin?: string };
  order?: AvatarSlot[]; // ordem de empilhamento acima do corpo
  parts: PackAvatarPart[];
}

export interface AssetPack {
  avatar?: PackAvatar;
  mobis: PackMobi[];
  floors: PackSurface[];
  walls: PackSurface[];
  overrides: Record<string, PackOverride>;
}

export const ASSET_PACK: AssetPack = {
  avatar: (packJson as { avatar?: PackAvatar }).avatar,
  mobis: (packJson.mobis || []) as PackMobi[],
  floors: (packJson.floors || []) as PackSurface[],
  walls: (packJson.walls || []) as PackSurface[],
  overrides: (packJson.overrides || {}) as Record<string, PackOverride>,
};
