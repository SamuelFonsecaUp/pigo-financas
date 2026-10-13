import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { composeAvatar, cellIsEmpty, viewFor, DEFAULT_GRID } from '../src/game/avatarLayers';
import { ASSET_PACK } from '../src/game/pack';
import { decodePng } from './helpers/png';

const packDir = path.join(__dirname, '..', 'src', 'game', 'pack');
const load = (file: string) => decodePng(fs.readFileSync(path.join(packDir, file)));
const cfg = ASSET_PACK.avatar!;
const grid = cfg.grid;
const body = load(cfg.body.file);
const part = (slot: string) => load(cfg.parts.find(p => p.slot === slot)!.file);

const hex = (d: Uint8ClampedArray, w: number, x: number, y: number) =>
  '#' + [0, 1, 2].map(k => d[(y * w + x) * 4 + k].toString(16).padStart(2, '0')).join('');

describe('Layered avatar (template grid)', () => {
  it('uses the standard template grid', () => {
    expect(grid).toEqual(DEFAULT_GRID);
    expect(body.w).toBe(grid.cellW * grid.frames.length);
    expect(body.h).toBe(grid.cellH * grid.views.length);
    for (const p of cfg.parts) {
      const img = load(p.file);
      expect([img.w, img.h], p.file).toEqual([body.w, body.h]);
    }
  });

  it('every drawn standing cell has the feet on the anchor line', () => {
    for (const file of [cfg.body.file, ...cfg.parts.filter(p => p.slot === 'sapato').map(p => p.file)]) {
      const img = load(file);
      grid.views.forEach((_, vi) => {
        if (cellIsEmpty(img, grid, vi, 0)) return;
        let lowest = -1;
        for (let y = 0; y < grid.cellH; y++) {
          for (let x = 0; x < grid.cellW; x++) if (img.data[((vi * grid.cellH + y) * img.w + x) * 4 + 3]) lowest = y;
        }
        expect(lowest, `${file} view ${grid.views[vi]}`).toBe(grid.anchorY - 1);
      });
    }
  });

  it('stacks tinted parts over the body and recolors the skin', () => {
    const c = composeAvatar([
      { image: body, skin: { key: cfg.body.skin!, tone: '#c68650' } },
      { image: part('sapato'), tint: '#ff0000' },
      { image: part('calca'), tint: '#0000ff' },
      { image: part('roupa'), tint: '#00ff00' },
    ], grid, 'frente', 'parado');
    const ax = grid.anchorX;
    const feet = grid.anchorY - 1;
    const shoe = hex(c.data, c.w, ax + 6, feet - 1);
    const pants = hex(c.data, c.w, ax + 4, feet - 12);
    const shirt = hex(c.data, c.w, ax + 4, feet - 35);
    const face = hex(c.data, c.w, ax, feet - 66);
    expect(parseInt(shoe.slice(1, 3), 16)).toBeGreaterThan(150); // vermelho
    expect(parseInt(pants.slice(5, 7), 16)).toBeGreaterThan(150); // azul
    expect(parseInt(shirt.slice(3, 5), 16)).toBeGreaterThan(150); // verde
    expect(face).not.toBe(cfg.body.skin); // tom de pele trocado
  });

  it('falls back to the standing pose and bobs while walking frames are not drawn', () => {
    const walk = composeAvatar([{ image: body }], grid, 'frente', 'andar_1');
    const stand = composeAvatar([{ image: body }], grid, 'frente', 'parado');
    expect(Array.from(walk.data)).toEqual(Array.from(stand.data));
    expect(walk.bob).toBe(-1);
    expect(composeAvatar([{ image: body }], grid, 'frente', 'andar_2').bob).toBe(0);
  });

  it('hides shoes when sitting and maps directions to template rows', () => {
    const shoes = part('sapato');
    const sit = composeAvatar([{ image: body }, { image: shoes, tint: '#ff0000' }], grid, 'frente', 'sentado');
    const bodyOnly = composeAvatar([{ image: body }], grid, 'frente', 'sentado');
    expect(Array.from(sit.data)).toEqual(Array.from(bodyOnly.data));
    expect(viewFor('se')).toEqual({ view: 'frente_34', flip: true });
    expect(viewFor('sw')).toEqual({ view: 'frente_34', flip: false });
    expect(viewFor('n').view).toBe('costas');
  });
});
