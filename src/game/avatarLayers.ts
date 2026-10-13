/**
 * Avatar em camadas desenhadas no MODELO PADRÃO (design/avatar/modelo_avatar.psd).
 *
 * Cada camada (corpo, sapato, calça, roupa, cabelo, chapéu) é um PNG com a mesma grade:
 * colunas = quadros (parado, andar_1..4, sentado) e linhas = vistas (frente, frente_34, perfil,
 * costas_34, costas). O pé fica no ponto de âncora de cada célula. O app só empilha as camadas.
 */

export interface AvatarGrid {
  cellW: number;
  cellH: number;
  anchorX: number;
  anchorY: number;
  views: string[]; // ex.: ['frente', 'frente_34', 'perfil', 'costas_34', 'costas']
  frames: string[]; // ex.: ['parado', 'andar_1', 'andar_2', 'andar_3', 'andar_4', 'sentado']
}

export const DEFAULT_GRID: AvatarGrid = {
  cellW: 64,
  cellH: 112,
  anchorX: 32,
  anchorY: 104,
  views: ['frente', 'frente_34', 'perfil', 'costas_34', 'costas'],
  frames: ['parado', 'andar_1', 'andar_2', 'andar_3', 'andar_4', 'sentado'],
};

export interface RgbaImage {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export interface LayerInput {
  image: RgbaImage;
  tint?: string | null; // cor para multiplicar (peças desenhadas em cinza)
  skin?: { key: string; tone: string } | null; // troca do tom de pele (corpo)
}

export type AvatarFacing = 'se' | 'sw' | 'ne' | 'nw' | 's' | 'n' | 'e' | 'w';

// Direção do jogo -> linha da grade + espelhamento.
// frente_34 olha para baixo-esquerda (sw), perfil olha para a direita (e), costas_34 vira para cima-esquerda (nw).
export function viewFor(dir: AvatarFacing): { view: string; flip: boolean } {
  switch (dir) {
    case 'sw': return { view: 'frente_34', flip: false };
    case 'se': return { view: 'frente_34', flip: true };
    case 'nw': return { view: 'costas_34', flip: false };
    case 'ne': return { view: 'costas_34', flip: true };
    case 'e': return { view: 'perfil', flip: false };
    case 'w': return { view: 'perfil', flip: true };
    case 'n': return { view: 'costas', flip: false };
    case 's':
    default: return { view: 'frente', flip: false };
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export function cellIsEmpty(img: RgbaImage, grid: AvatarGrid, viewIdx: number, frameIdx: number): boolean {
  const x0 = frameIdx * grid.cellW;
  const y0 = viewIdx * grid.cellH;
  for (let y = y0; y < y0 + grid.cellH && y < img.h; y++) {
    for (let x = x0; x < x0 + grid.cellW && x < img.w; x++) {
      if (img.data[(y * img.w + x) * 4 + 3] > 0) return false;
    }
  }
  return true;
}

export interface ComposedAvatar {
  data: Uint8ClampedArray; // célula cellW x cellH
  w: number;
  h: number;
  anchorX: number;
  anchorY: number;
  bob: number; // deslocamento vertical sugerido (quadros de passo ainda não desenhados)
}

/**
 * Empilha as camadas na célula pedida.
 * - Quadro de passo vazio numa camada: usa o "parado" daquela camada.
 * - Quadro "sentado" vazio: a camada some (ex.: sapatos escondidos), exceto o corpo, que usa "parado".
 * - Se o CORPO não tem o quadro de passo desenhado, sugere um balanço (bob) de 1 px.
 */
export function composeAvatar(layers: LayerInput[], grid: AvatarGrid, view: string, frame: string): ComposedAvatar {
  const { cellW: cw, cellH: ch } = grid;
  const out = new Uint8ClampedArray(cw * ch * 4);
  const viewIdx = Math.max(0, grid.views.indexOf(view));
  const frameIdx = Math.max(0, grid.frames.indexOf(frame));
  const standIdx = Math.max(0, grid.frames.indexOf('parado'));
  const isSit = frame === 'sentado';
  let bob = 0;

  layers.forEach((layer, li) => {
    let useFrame = frameIdx;
    if (cellIsEmpty(layer.image, grid, viewIdx, frameIdx)) {
      if (isSit && li > 0) return;
      useFrame = standIdx;
      if (li === 0 && frameIdx !== standIdx && !isSit) bob = frameIdx % 2 === 1 ? -1 : 0;
    }
    const tint = layer.tint ? hexToRgb(layer.tint) : null;
    const skinKey = layer.skin ? hexToRgb(layer.skin.key) : null;
    const skinTone = layer.skin ? hexToRgb(layer.skin.tone) : null;
    const keyLum = skinKey ? lum(...skinKey) : 1;
    const sx0 = useFrame * cw;
    const sy0 = viewIdx * ch;
    const img = layer.image;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((sy0 + y) * img.w + sx0 + x) * 4;
        const a = img.data[si + 3];
        if (!a) continue;
        let r = img.data[si];
        let g = img.data[si + 1];
        let b = img.data[si + 2];
        if (skinKey && skinTone && Math.abs(r - skinKey[0]) + Math.abs(g - skinKey[1]) + Math.abs(b - skinKey[2]) < 90) {
          // troca o tom preservando a luminosidade relativa (sombras desenhadas continuam sombras)
          const k = lum(r, g, b) / keyLum;
          r = skinTone[0] * k; g = skinTone[1] * k; b = skinTone[2] * k;
        } else if (tint) {
          r = (r * tint[0]) / 255; g = (g * tint[1]) / 255; b = (b * tint[2]) / 255;
        }
        const di = (y * cw + x) * 4;
        const alpha = a / 255;
        out[di] = r * alpha + out[di] * (1 - alpha);
        out[di + 1] = g * alpha + out[di + 1] * (1 - alpha);
        out[di + 2] = b * alpha + out[di + 2] * (1 - alpha);
        out[di + 3] = Math.max(out[di + 3], a);
      }
    }
  });

  return { data: out, w: cw, h: ch, anchorX: grid.anchorX, anchorY: grid.anchorY, bob };
}
