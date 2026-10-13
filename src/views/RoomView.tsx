import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair, FolderOpen, Lamp, LayoutGrid, Lock, Maximize2, Minimize2, Move, Package, PanelRightClose,
  PanelRightOpen, Pickaxe, RefreshCw, RotateCw, Shirt, Sparkles, X,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { GameAssets, PlacedMobi, RoomLayout, RoomLayouts } from '../types';
import { IsoBox, IsoOrigin, IsoTile, project, shade } from '../game/iso';
import { PALETTE, PixelIcon, PixelSprite, spriteSize } from '../game/pixel';
import { PIGO, PIGO_BLINK } from '../game/sprites';
import { FLOORS, MOBIS, MobiCtx, MobiDef, RoomId, SurfaceDef, UnlockRule, WALLPAPERS, isUnlocked, unlockLabel } from '../game/mobis';
import {
  ROOM_MODELS, STEP_Z, canPlace, defaultLayout, findPath, footprint, footprintHeight, getModel, itemsNotFitting,
  newUid, occupiedTiles, parseModel, pickTile, tileHeight, wallSegments, ParsedModel,
} from '../game/room';
import {
  Avatar, AvatarDir, AvatarLook, AvatarPreview, DEFAULT_LOOK, HAIR_STYLES, HATS, PALETTE_CHOICES, SKIN_TONES,
  TOP_STYLES, WardrobeOption, dirFromStep,
} from '../game/avatar';
import { ASSET_PACK, packFileUrl } from '../game/pack';
import { AvatarFrame, SheetAvatar, SheetAvatarViews, useAvatarPack } from '../game/SheetAvatar';
import { AvatarSlot } from '../game/pack';

// Resolução: unit 2 = tiles de 64x32 px
const UNIT = 2;
const MARGIN = 28;
const FLOOR_T = 5; // espessura do piso
const STEP_MS = 300;
const WALL_HEIGHTS: Record<NonNullable<RoomLayout['wallHeight']>, number> = { baixa: 48, normal: 72, alta: 104 };

type Mode =
  | { kind: 'idle' }
  | { kind: 'placing'; mobiId: string; rot: 0 | 1; movingUid?: string };

type Panel = 'mobis' | 'visual' | 'plantas' | 'paredes' | 'pisos' | 'criador';

const ROOMS: { id: RoomId; name: string; subtitle: string; available: boolean }[] = [
  { id: 'finance', name: 'Sala do Tesouro', subtitle: 'Decorada com conquistas financeiras', available: true },
  { id: 'life', name: 'Quarto do Herói', subtitle: 'Libera na Fase 2 (hábitos e tarefas)', available: false },
];

interface ImageInfo {
  url: string;
  w: number;
  h: number;
}

interface SurfaceOption extends SurfaceDef {
  image?: string; // url da textura (pacote oficial ou modo criador)
}

// Carrega dimensões de imagens (pacote oficial e modo criador)
function useImageInfos(sources: Record<string, string>): Record<string, ImageInfo> {
  const [infos, setInfos] = useState<Record<string, ImageInfo>>({});
  const key = Object.entries(sources).map(([k, v]) => `${k}:${v.length}:${v.slice(-16)}`).sort().join('|');
  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(sources);
    if (entries.length === 0) {
      setInfos({});
      return;
    }
    Promise.all(entries.map(([name, url]) => new Promise<[string, ImageInfo]>(resolve => {
      const img = new Image();
      img.onload = () => resolve([name, { url, w: img.naturalWidth, h: img.naturalHeight }]);
      img.onerror = () => resolve([name, { url, w: 0, h: 0 }]);
      img.src = url;
    }))).then(list => {
      if (!cancelled) setInfos(Object.fromEntries(list.filter(([, i]) => i.w > 0)));
    });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return infos;
}

// Mobi desenhado com PNG: losango do chão encostado na borda de baixo da imagem
function imageRender(def: { w: number; d: number }, img: ImageInfo, imgRot1: ImageInfo | undefined, offset: { x: number; y: number }) {
  return (c: MobiCtx) => {
    const { w, d } = c.rot ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
    const z = c.z ?? 0;
    const left = project(c.o, c.gx, c.gy + d, z)[0];
    const right = project(c.o, c.gx + w, c.gy, z)[0];
    const bottom = project(c.o, c.gx + w, c.gy + d, z)[1];
    const pic = c.rot === 1 && imgRot1 ? imgRot1 : img;
    const x = Math.round((left + right) / 2 - pic.w / 2 + offset.x);
    const y = Math.round(bottom - pic.h + offset.y);
    const mirror = c.rot === 1 && !imgRot1;
    return (
      <image
        href={pic.url} x={x} y={y} width={pic.w} height={pic.h} style={{ imageRendering: 'pixelated' }}
        transform={mirror ? `translate(${2 * x + pic.w} 0) scale(-1 1)` : undefined}
      />
    );
  };
}

// Miniatura do mobi para o inventário
const MobiPreview: React.FC<{ def: MobiDef; locked: boolean }> = ({ def, locked }) => {
  const o: IsoOrigin = { x: 64, y: 92, unit: UNIT };
  const vbX = 64 - def.d * 32 - 8;
  const vbW = (def.w + def.d) * 32 + 16;
  const vbH = 92 + (def.w + def.d) * 16 + 6;
  return (
    <svg viewBox={`${vbX} 0 ${vbW} ${vbH}`} width={60} height={60} shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', filter: locked ? 'grayscale(1) brightness(0.5)' : undefined }}>
      {def.render({ o, gx: 0, gy: 0, rot: 0, state: 1 })}
    </svg>
  );
};

// Miniatura da planta (mapa de alturas)
const ModelPreview: React.FC<{ pm: ParsedModel; locked: boolean }> = ({ pm, locked }) => {
  const o: IsoOrigin = { x: pm.d * 16 + 4, y: 4 + pm.maxH * 6 };
  const w = (pm.w + pm.d) * 16 + 8;
  const h = (pm.w + pm.d) * 8 + 8 + pm.maxH * 6;
  const tiles: React.ReactNode[] = [];
  for (let gy = 0; gy < pm.d; gy++) {
    for (let gx = 0; gx < pm.w; gx++) {
      const ht = pm.heights[gy][gx];
      if (ht === null) continue;
      const pts = [project(o, gx, gy, ht * 6), project(o, gx + 1, gy, ht * 6), project(o, gx + 1, gy + 1, ht * 6), project(o, gx, gy + 1, ht * 6)];
      tiles.push(<polygon key={`${gx}-${gy}`} points={pts.map(p => p.join(',')).join(' ')} fill={ht ? (ht > 1 ? '#c28a4a' : '#a0672f') : '#8f5b28'} stroke="#5d3a1a" strokeWidth={0.6} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={70} style={{ filter: locked ? 'grayscale(1) brightness(0.45)' : undefined }}>
      {tiles}
    </svg>
  );
};

interface Actor {
  pos: [number, number];
  path: [number, number][];
  dir: AvatarDir;
  sitUid?: string | null;
  pendingSit?: string | null;
}

export const RoomView: React.FC = () => {
  const { game, showToast } = useFinancial();
  const avatarPack = useAvatarPack();
  const [roomId, setRoomId] = useState<RoomId>('finance');
  const [layouts, setLayouts] = useState<RoomLayouts | null>(null);
  const [look, setLook] = useState<AvatarLook>(DEFAULT_LOOK);
  const [creatorAssets, setCreatorAssets] = useState<GameAssets | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [panel, setPanel] = useState<Panel>('mobis');
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [avatar, setAvatar] = useState<Actor>({ pos: [0, 5], path: [], dir: 'se' });
  const [pet, setPet] = useState<Actor>({ pos: [2, 2], path: [], dir: 'se' });
  const [walkFrame, setWalkFrame] = useState<1 | 2 | 3 | 4>(1);
  const [bubble, setBubble] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const night = useMemo(() => {
    const h = new Date().getHours();
    return h >= 19 || h < 6;
  }, []);

  const unlockedAchievements = useMemo(
    () => new Set((game?.achievements || []).filter(a => a.unlocked).map(a => a.id)),
    [game]
  );
  const level = game?.level || 1;
  const can = useCallback((rule: UnlockRule) => isUnlocked(rule, unlockedAchievements, level), [unlockedAchievements, level]);

  // ---------- Assets: pacote oficial (dentro do app) + modo criador (pasta local) ----------
  const loadCreatorAssets = useCallback(async () => {
    if (!window.electronAPI?.getGameAssets) return;
    try {
      setCreatorAssets(await window.electronAPI.getGameAssets());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadCreatorAssets();
  }, [loadCreatorAssets]);

  const packSources = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of ASSET_PACK.mobis) {
      const url = packFileUrl(m.file);
      if (url) out[`mobi:${m.id}`] = url;
      const rot = packFileUrl(m.fileRotated);
      if (rot) out[`mobi:${m.id}_r1`] = rot;
    }
    for (const [id, ov] of Object.entries(ASSET_PACK.overrides)) {
      const url = packFileUrl(ov.file);
      if (url) out[`mobi:${id}`] = url;
      const rot = packFileUrl(ov.fileRotated);
      if (rot) out[`mobi:${id}_r1`] = rot;
    }
    for (const f of ASSET_PACK.floors) { const url = packFileUrl(f.file); if (url) out[`floor:${f.id}`] = url; }
    for (const w of ASSET_PACK.walls) { const url = packFileUrl(w.file); if (url) out[`wall:${w.id}`] = url; }
    return out;
  }, []);
  const creatorSources = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(creatorAssets?.mobis || {})) out[`mobi:${k}`] = v;
    for (const [k, v] of Object.entries(creatorAssets?.floors || {})) out[`floor:criador_${k}`] = v;
    for (const [k, v] of Object.entries(creatorAssets?.walls || {})) out[`wall:criador_${k}`] = v;
    if (creatorAssets?.pigo) out.pigo = creatorAssets.pigo;
    return out;
  }, [creatorAssets]);
  const packImages = useImageInfos(packSources);
  const creatorImages = useImageInfos(creatorSources);

  const catalog: MobiDef[] = useMemo(() => {
    const creatorManifest = creatorAssets?.manifest?.mobis || {};
    const img = (id: string) => creatorImages[`mobi:${id}`] || packImages[`mobi:${id}`];
    const imgR = (id: string) => creatorImages[`mobi:${id}_r1`] || packImages[`mobi:${id}_r1`];
    const offset = (id: string) => ({
      x: creatorManifest[id]?.offsetX ?? ASSET_PACK.overrides[id]?.offsetX ?? 0,
      y: creatorManifest[id]?.offsetY ?? ASSET_PACK.overrides[id]?.offsetY ?? 0,
    });
    const base = MOBIS.map(m => (img(m.id) ? { ...m, render: imageRender(m, img(m.id)!, imgR(m.id), offset(m.id)) } : m));
    const pack: MobiDef[] = ASSET_PACK.mobis
      .filter(p => img(p.id))
      .map(p => {
        const w = p.w || 1;
        const d = p.d || 1;
        return {
          id: p.id, name: p.name, description: p.description || 'Mobi do pacote oficial.',
          category: p.category || 'decoração', w, d, walkable: p.walkable, seat: p.seat, seatZ: p.seatZ,
          qty: p.qty || 1, rooms: p.rooms || ['finance', 'life'], unlock: p.unlock || { type: 'default' },
          render: imageRender({ w, d }, img(p.id)!, imgR(p.id), { x: p.offsetX || 0, y: p.offsetY || 0 }),
        };
      });
    const known = new Set([...base, ...pack].map(m => m.id));
    const creator: MobiDef[] = Object.keys(creatorAssets?.mobis || {})
      .filter(name => !name.endsWith('_r1') && !known.has(name) && creatorImages[`mobi:${name}`])
      .map(name => {
        const entry = creatorManifest[name] || {};
        const w = Math.max(1, Math.round(entry.w || 1));
        const d = Math.max(1, Math.round(entry.d || 1));
        return {
          id: name, name: `${entry.name || name.replace(/[_-]+/g, ' ')} (criador)`, description: 'Teste do modo criador.',
          category: 'decoração' as const, w, d, walkable: Boolean(entry.walkable), qty: 99,
          rooms: ['finance', 'life'] as RoomId[], unlock: { type: 'default' as const },
          render: imageRender({ w, d }, creatorImages[`mobi:${name}`], creatorImages[`mobi:${name}_r1`], offset(name)),
        };
      });
    return [...base, ...pack, ...creator];
  }, [creatorAssets, creatorImages, packImages]);

  const lookup = useCallback((id: string) => catalog.find(m => m.id === id), [catalog]);

  const wallOptions: SurfaceOption[] = useMemo(() => [
    ...WALLPAPERS,
    ...ASSET_PACK.walls.filter(w => packImages[`wall:${w.id}`]).map(w => ({ id: `pack:${w.id}`, name: w.name, colors: ['#9a8a7a', '#8a7a6a'] as [string, string], unlock: w.unlock || { type: 'default' as const }, image: packImages[`wall:${w.id}`].url })),
    ...Object.keys(creatorAssets?.walls || {}).filter(k => creatorImages[`wall:criador_${k}`]).map(k => ({ id: `criador:${k}`, name: `${k} (criador)`, colors: ['#888888', '#777777'] as [string, string], unlock: { type: 'default' as const }, image: creatorImages[`wall:criador_${k}`].url })),
  ], [packImages, creatorAssets, creatorImages]);
  const floorOptions: SurfaceOption[] = useMemo(() => [
    ...FLOORS,
    ...ASSET_PACK.floors.filter(f => packImages[`floor:${f.id}`]).map(f => ({ id: `pack:${f.id}`, name: f.name, colors: ['#9a7a5a', '#8a6a4a'] as [string, string], unlock: f.unlock || { type: 'default' as const }, image: packImages[`floor:${f.id}`].url })),
    ...Object.keys(creatorAssets?.floors || {}).filter(k => creatorImages[`floor:criador_${k}`]).map(k => ({ id: `criador:${k}`, name: `${k} (criador)`, colors: ['#888888', '#777777'] as [string, string], unlock: { type: 'default' as const }, image: creatorImages[`floor:criador_${k}`].url })),
  ], [packImages, creatorAssets, creatorImages]);
  const imageOf = (opt: SurfaceOption | undefined): ImageInfo | undefined => {
    if (!opt?.image) return undefined;
    return [...Object.values(packImages), ...Object.values(creatorImages)].find(i => i.url === opt.image);
  };

  // ---------- Layout e visual salvos (sincronizados entre computadores) ----------
  useEffect(() => {
    window.electronAPI?.getSettings().then(s => {
      const saved = s?.roomLayouts || {};
      const fix = (l: RoomLayout | undefined, room: RoomId): RoomLayout => {
        const base = l || defaultLayout(room);
        return { ...base, model: base.model || 'sala' };
      };
      setLayouts({ finance: fix(saved.finance, 'finance'), life: fix(saved.life, 'life') });
      if (s?.avatarLook) setLook({ ...DEFAULT_LOOK, ...(s.avatarLook as Partial<AvatarLook>) });
    });
  }, []);

  const layout: RoomLayout | null = layouts ? layouts[roomId] || defaultLayout(roomId) : null;
  const model = getModel(layout?.model);
  const pm = parseModel(model);
  const wallH = WALL_HEIGHTS[layout?.wallHeight || 'normal'];
  const wallTop = pm.maxH * STEP_Z + wallH;

  const persist = useCallback((next: RoomLayouts) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.electronAPI?.updateSettings({ roomLayouts: next }).catch(() => showToast('Não foi possível salvar o quarto.', 'error'));
    }, 400);
  }, [showToast]);

  const updateLayout = useCallback((fn: (l: RoomLayout) => RoomLayout) => {
    setLayouts(prev => {
      if (!prev) return prev;
      const next = { ...prev, [roomId]: fn(prev[roomId] || defaultLayout(roomId)) };
      persist(next);
      return next;
    });
  }, [roomId, persist]);

  const updateLook = (patch: Partial<AvatarLook>) => {
    setLook(prev => {
      const next = { ...prev, ...patch };
      if (lookTimer.current) clearTimeout(lookTimer.current);
      lookTimer.current = setTimeout(() => {
        window.electronAPI?.updateSettings({ avatarLook: next as unknown as Record<string, string> });
      }, 400);
      return next;
    });
  };

  // Mobis que não cabem na planta atual (de layouts antigos) voltam ao inventário
  useEffect(() => {
    if (!layout) return;
    const bad = itemsNotFitting(layout.items, pm, lookup);
    if (bad.length) updateLayout(l => ({ ...l, items: l.items.filter(i => !bad.some(b => b.uid === i.uid)) }));
  }, [layout?.model, catalog.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Personagens entram pela porta ao trocar de planta
  useEffect(() => {
    setAvatar({ pos: pm.door, path: [], dir: 'se' });
    const free = [[pm.door[0] + 1, pm.door[1]], [pm.door[0] + 1, pm.door[1] - 1], [pm.door[0], pm.door[1] - 1]]
      .find(([x, y]) => tileHeight(pm, x, y) !== null) as [number, number] | undefined;
    setPet({ pos: free || pm.door, path: [], dir: 'se' });
  }, [pm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Geometria da cena ----------
  const scene = useMemo(() => {
    const hw = 16 * UNIT;
    const hh = 8 * UNIT;
    const origin: IsoOrigin = { x: MARGIN + pm.d * hw + 8, y: MARGIN + wallTop * UNIT + 8, unit: UNIT };
    const width = (pm.w + pm.d) * hw + MARGIN * 2 + 16;
    const height = origin.y + (pm.w + pm.d) * hh + FLOOR_T * UNIT + MARGIN;
    return { origin, width, height };
  }, [pm, wallTop]);
  const o = scene.origin;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.3, Math.min(el.clientWidth / scene.width, el.clientHeight / scene.height)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scene.width, scene.height, layouts, panelOpen, isFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapperRef.current?.requestFullscreen();
    } catch (e) {
      showToast('Tela cheia indisponível neste modo.', 'info');
    }
  };

  // ---------- Movimento dos personagens ----------
  const itemsRef = useRef<PlacedMobi[]>([]);
  itemsRef.current = layout?.items || [];

  useEffect(() => {
    const t = setInterval(() => {
      setAvatar(a => {
        if (a.path.length === 0) {
          if (a.pendingSit) {
            const seat = itemsRef.current.find(i => i.uid === a.pendingSit);
            const dir: AvatarDir = seat && seat.rot === 1 ? 'se' : 'sw';
            return { ...a, sitUid: a.pendingSit, pendingSit: null, dir };
          }
          return a;
        }
        const [next, ...rest] = a.path;
        return { ...a, pos: next, path: rest, dir: dirFromStep(next[0] - a.pos[0], next[1] - a.pos[1], a.dir), sitUid: null };
      });
      setPet(p => {
        if (p.path.length === 0) return p;
        const [next, ...rest] = p.path;
        return { ...p, pos: next, path: rest, dir: dirFromStep(next[0] - p.pos[0], next[1] - p.pos[1], p.dir) };
      });
    }, STEP_MS);
    const f = setInterval(() => setWalkFrame(fr => ((fr % 4) + 1) as 1 | 2 | 3 | 4), STEP_MS / 2);
    return () => { clearInterval(t); clearInterval(f); };
  }, []);

  // Pigo (pet) passeia sozinho
  useEffect(() => {
    const t = setInterval(() => {
      setPet(p => {
        if (p.path.length > 0) return p;
        const occ = occupiedTiles(itemsRef.current, undefined, lookup);
        for (let tries = 0; tries < 12; tries++) {
          const target: [number, number] = [Math.floor(Math.random() * pm.w), Math.floor(Math.random() * pm.d)];
          if (tileHeight(pm, target[0], target[1]) === null || occ.has(`${target[0]},${target[1]}`)) continue;
          const path = findPath(itemsRef.current, p.pos, target, pm, { lookup });
          if (path.length > 0 && path.length < 9) return { ...p, path };
        }
        return p;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [pm, lookup]);

  // Balão de fala com as missões da semana
  useEffect(() => {
    const lines = [
      ...(game?.missions.current || []).filter(m => m.status === 'in_progress').map(m => `Missão: ${m.title}`),
      `Nível ${game?.level ?? 1} • ${game?.title ?? ''}`,
      'Clique duas vezes numa cadeira para sentar!',
    ];
    let i = 0;
    const show = () => {
      setBubble(lines[i % lines.length]);
      i++;
      setTimeout(() => setBubble(null), 5000);
    };
    const first = setTimeout(show, 1500);
    const t = setInterval(show, 18000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMode({ kind: 'idle' }); setSelectedUid(null); }
      if ((e.key === 'r' || e.key === 'R') && mode.kind === 'placing') setMode({ ...mode, rot: mode.rot ? 0 : 1 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const placedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const room of Object.values(layouts || {})) {
      for (const it of room?.items || []) counts[it.mobiId] = (counts[it.mobiId] || 0) + 1;
    }
    return counts;
  }, [layouts]);

  // ---------- Camadas estáticas memorizadas (piso e paredes) ----------
  const wallDef = wallOptions.find(w => w.id === layout?.wallpaper) || WALLPAPERS[0];
  const floorDef = floorOptions.find(f => f.id === layout?.floor) || FLOORS[0];
  const wallColors: [string, string] = layout?.wallpaper === 'custom' && layout.customWall ? layout.customWall : wallDef.colors;
  const floorColors: [string, string] = layout?.floor === 'custom' && layout.customFloor ? layout.customFloor : floorDef.colors;
  const wallTexture = imageOf(wallDef as SurfaceOption);
  const floorTexture = imageOf(floorDef as SurfaceOption);

  const floorNodes = useMemo(() => {
    const nodes: { key: number; node: React.ReactNode }[] = [];
    const edge = shade(floorColors[1], -0.2);
    for (let gy = 0; gy < pm.d; gy++) {
      for (let gx = 0; gx < pm.w; gx++) {
        const ht = pm.heights[gy][gx];
        if (ht === null) continue;
        const top = (gx + gy) % 2 ? floorColors[1] : floorColors[0];
        const z = ht * STEP_Z;
        const [ex, ey] = project(o, gx, gy, z);
        nodes.push({
          key: gx + gy + 0.5,
          node: (
            <g key={`t${gx}-${gy}`}>
              <IsoBox origin={o} gx={gx} gy={gy} w={1} d={1} h={z + FLOOR_T} z={-FLOOR_T}
                colors={{ top, left: shade(floorColors[0], -0.3), right: shade(floorColors[0], -0.45), outline: edge }} />
              {floorTexture && (
                <image href={floorTexture.url} width={floorTexture.w} height={floorTexture.h} style={{ imageRendering: 'pixelated' }}
                  transform={`matrix(${(16 * UNIT) / floorTexture.w} ${(8 * UNIT) / floorTexture.w} ${(-16 * UNIT) / floorTexture.w} ${(8 * UNIT) / floorTexture.w} ${ex} ${ey})`} />
              )}
            </g>
          ),
        });
      }
    }
    return nodes;
  }, [pm, o, floorColors[0], floorColors[1], floorTexture?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const wallNode = useMemo(() => {
    const { back, left } = wallSegments(pm);
    const parts: React.ReactNode[] = [];
    const topColor = '#2c2420';
    const baseOf = (gx: number, gy: number) => (tileHeight(pm, gx, gy) ?? 0) * STEP_Z - FLOOR_T;
    for (const s of back) {
      const base = baseOf(s.gx, s.gy);
      parts.push(<IsoBox key={`b${s.gx}`} origin={o} gx={s.gx} gy={s.gy - 0.25} w={1} d={0.25} h={wallTop - base} z={base}
        colors={{ top: topColor, left: wallColors[0], right: shade(wallColors[0], -0.25), outline: PALETTE.k }} />);
      if (wallTexture) {
        const [ex, ey] = project(o, s.gx, s.gy, wallTop);
        parts.push(<image key={`bt${s.gx}`} href={wallTexture.url} width={wallTexture.w} height={wallTexture.h} style={{ imageRendering: 'pixelated' }}
          transform={`matrix(${(16 * UNIT) / wallTexture.w} ${(8 * UNIT) / wallTexture.w} 0 ${((wallTop - base - FLOOR_T) * UNIT) / wallTexture.h} ${ex} ${ey})`} />);
      } else {
        const [x, y] = project(o, s.gx + 0.5, s.gy, wallTop);
        parts.push(<rect key={`bs${s.gx}`} x={x} y={y + UNIT} width={UNIT} height={(wallTop - base - FLOOR_T - 6) * UNIT} fill={shade(wallColors[0], -0.07)} />);
      }
      // rodapé
      parts.push(<IsoBox key={`bb${s.gx}`} origin={o} gx={s.gx} gy={s.gy - 0.05} w={1} d={0.05} h={5} z={base + FLOOR_T}
        colors={{ top: '#5d3a1a', left: '#6b4220', right: '#5d3a1a' }} />);
    }
    for (const s of left) {
      const base = baseOf(s.gx, s.gy);
      parts.push(<IsoBox key={`l${s.gy}`} origin={o} gx={s.gx - 0.25} gy={s.gy} w={0.25} d={1} h={wallTop - base} z={base}
        colors={{ top: topColor, left: shade(wallColors[1], -0.25), right: wallColors[1], outline: PALETTE.k }} />);
      if (wallTexture) {
        const [ex, ey] = project(o, s.gx, s.gy + 1, wallTop);
        parts.push(<image key={`lt${s.gy}`} href={wallTexture.url} width={wallTexture.w} height={wallTexture.h} style={{ imageRendering: 'pixelated' }}
          transform={`matrix(${(16 * UNIT) / wallTexture.w} ${(-8 * UNIT) / wallTexture.w} 0 ${((wallTop - base - FLOOR_T) * UNIT) / wallTexture.h} ${ex} ${ey})`} />);
        const a = project(o, s.gx, s.gy, wallTop);
        const b = project(o, s.gx, s.gy + 1, wallTop);
        const bb = project(o, s.gx, s.gy + 1, base + FLOOR_T);
        const ab = project(o, s.gx, s.gy, base + FLOOR_T);
        parts.push(<polygon key={`ls${s.gy}`} points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${bb[0]},${bb[1]} ${ab[0]},${ab[1]}`} fill="#000" opacity={0.14} />);
      } else {
        const [x, y] = project(o, s.gx, s.gy + 0.5, wallTop);
        parts.push(<rect key={`lst${s.gy}`} x={x} y={y + UNIT} width={UNIT} height={(wallTop - base - FLOOR_T - 6) * UNIT} fill={shade(wallColors[1], -0.08)} />);
      }
      parts.push(<IsoBox key={`lb${s.gy}`} origin={o} gx={s.gx - 0.05} gy={s.gy} w={0.05} d={1} h={5} z={base + FLOOR_T}
        colors={{ top: '#5d3a1a', left: '#5d3a1a', right: '#6b4220' }} />);
    }
    // canto
    if (back.length && left.length && back[0].gx === left[0].gx && back[0].gy === left[0].gy) {
      const s = back[0];
      const base = baseOf(s.gx, s.gy);
      parts.push(<IsoBox key="corner" origin={o} gx={s.gx - 0.25} gy={s.gy - 0.25} w={0.25} d={0.25} h={wallTop - base} z={base}
        colors={{ top: topColor, left: shade(wallColors[1], -0.3), right: shade(wallColors[0], -0.3), outline: PALETTE.k }} />);
    }
    // janelas na parede do fundo
    const windowSegs = back.length >= 6 ? [back[Math.floor(back.length * 0.35)], back[Math.floor(back.length * 0.7)]] : back.length >= 3 ? [back[Math.floor(back.length * 0.6)]] : [];
    windowSegs.forEach((s, i) => {
      const base = baseOf(s.gx, s.gy) + FLOOR_T;
      const z1 = base + Math.min(wallH - 14, 30);
      const z2 = Math.min(wallTop - 6, z1 + 30);
      const pts = [project(o, s.gx + 0.15, s.gy, z2), project(o, s.gx + 0.85, s.gy, z2), project(o, s.gx + 0.85, s.gy, z1), project(o, s.gx + 0.15, s.gy, z1)];
      const inner = [project(o, s.gx + 0.22, s.gy, z2 - 3), project(o, s.gx + 0.78, s.gy, z2 - 3), project(o, s.gx + 0.78, s.gy, z1 + 3), project(o, s.gx + 0.22, s.gy, z1 + 3)];
      const mid = [project(o, s.gx + 0.5, s.gy, z2 - 3), project(o, s.gx + 0.5, s.gy, z1 + 3)];
      parts.push(
        <g key={`win${i}`}>
          <polygon points={pts.map(p => p.join(',')).join(' ')} fill="#f4f4f4" stroke={PALETTE.k} strokeWidth={1} />
          <polygon points={inner.map(p => p.join(',')).join(' ')} fill={night ? '#1d2550' : '#8fd0ff'} />
          {!night && <polygon points={`${inner[0].join(',')} ${inner[1].join(',')} ${inner[2][0]},${inner[2][1] - 10 * UNIT}`} fill="#c9ecff" opacity={0.6} />}
          <line x1={mid[0][0]} y1={mid[0][1]} x2={mid[1][0]} y2={mid[1][1]} stroke="#f4f4f4" strokeWidth={UNIT} />
        </g>
      );
    });
    // porta na parede esquerda
    const doorSeg = left.find(s => s.gy === pm.door[1]);
    if (doorSeg) {
      const base = baseOf(doorSeg.gx, doorSeg.gy) + FLOOR_T;
      const dz = Math.min(wallH - 10, 46);
      const frame = [project(o, doorSeg.gx, doorSeg.gy + 0.12, base), project(o, doorSeg.gx, doorSeg.gy + 0.88, base), project(o, doorSeg.gx, doorSeg.gy + 0.88, base + dz), project(o, doorSeg.gx, doorSeg.gy + 0.12, base + dz)];
      const hole = [project(o, doorSeg.gx, doorSeg.gy + 0.2, base), project(o, doorSeg.gx, doorSeg.gy + 0.8, base), project(o, doorSeg.gx, doorSeg.gy + 0.8, base + dz - 4), project(o, doorSeg.gx, doorSeg.gy + 0.2, base + dz - 4)];
      parts.push(
        <g key="door">
          <polygon points={frame.map(p => p.join(',')).join(' ')} fill="#8b5a2b" stroke={PALETTE.k} strokeWidth={1} />
          <polygon points={hole.map(p => p.join(',')).join(' ')} fill="#0d0f1c" />
        </g>
      );
    }
    return <g>{parts}</g>;
  }, [pm, o, wallTop, wallH, wallColors[0], wallColors[1], wallTexture?.url, night]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!layout || !layouts) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <PixelIcon sprite={PIGO} size={48} className="pixel-bob" />
        <span className="text-sm font-pixel">Abrindo o quarto...</span>
      </div>
    );
  }

  const room = ROOMS.find(r => r.id === roomId)!;
  const selectedItem = layout.items.find(i => i.uid === selectedUid) || null;
  const selectedDef = selectedItem ? lookup(selectedItem.mobiId) : null;
  const placingDef = mode.kind === 'placing' ? lookup(mode.mobiId) : null;
  const actorBlock = new Set([`${avatar.pos[0]},${avatar.pos[1]}`, `${pet.pos[0]},${pet.pos[1]}`]);
  const placeOk = (def: MobiDef, gx: number, gy: number, rot: 0 | 1, moving?: string) =>
    canPlace(layout.items, def, gx, gy, rot, pm, { ignoreUid: moving, blocked: moving ? undefined : actorBlock, lookup });
  const placingValid = Boolean(placingDef && hover && mode.kind === 'placing' && placeOk(placingDef, hover[0], hover[1], mode.rot, mode.movingUid));

  const tileFromEvent = (e: React.MouseEvent): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return pickTile(pm, o, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
  };

  const walkAvatarTo = (target: [number, number], sitUid?: string) => {
    const path = findPath(layout.items, avatar.pos, target, pm, { lookup, allowTarget: Boolean(sitUid) });
    if (path.length === 0 && !(target[0] === avatar.pos[0] && target[1] === avatar.pos[1])) {
      showToast('Não dá para chegar aí.', 'info');
      return;
    }
    setAvatar(a => ({ ...a, path, sitUid: null, pendingSit: sitUid || null }));
  };

  const handleSceneClick = (e: React.MouseEvent) => {
    const t = tileFromEvent(e);
    if (mode.kind === 'placing') {
      if (!t || !placingDef) return;
      if (!placeOk(placingDef, t[0], t[1], mode.rot, mode.movingUid)) {
        showToast('Não cabe aqui: escolha um espaço livre e plano.', 'info');
        return;
      }
      if (mode.movingUid) {
        updateLayout(l => ({ ...l, items: l.items.map(i => (i.uid === mode.movingUid ? { ...i, gx: t[0], gy: t[1], rot: mode.rot } : i)) }));
        setSelectedUid(mode.movingUid);
      } else {
        const uid = newUid();
        updateLayout(l => ({ ...l, items: [...l.items, { uid, mobiId: mode.mobiId, gx: t[0], gy: t[1], rot: mode.rot }] }));
        setSelectedUid(uid);
      }
      setMode({ kind: 'idle' });
      return;
    }
    setSelectedUid(null);
    if (t) walkAvatarTo(t);
  };

  // Estado padrão de mobis interativos: lareira acesa; luminária acesa à noite
  const defaultState = (def: MobiDef) => (def.id === 'lareira' || (def.id === 'luminaria' && night) ? 1 : 0);

  const interact = (item: PlacedMobi) => {
    const def = lookup(item.mobiId);
    if (!def) return;
    if (def.toggle) {
      updateLayout(l => ({ ...l, items: l.items.map(i => (i.uid === item.uid ? { ...i, state: (i.state ?? defaultState(def)) ? 0 : 1 } : i)) }));
    } else if (def.seat) {
      walkAvatarTo([item.gx, item.gy], item.uid);
    }
  };

  const rotateSelected = () => {
    if (!selectedItem || !selectedDef) return;
    const rot: 0 | 1 = selectedItem.rot ? 0 : 1;
    if (!placeOk(selectedDef, selectedItem.gx, selectedItem.gy, rot, selectedItem.uid)) {
      showToast('Sem espaço para girar aqui.', 'info');
      return;
    }
    updateLayout(l => ({ ...l, items: l.items.map(i => (i.uid === selectedItem.uid ? { ...i, rot } : i)) }));
  };

  const pickUpSelected = () => {
    if (!selectedItem) return;
    updateLayout(l => ({ ...l, items: l.items.filter(i => i.uid !== selectedItem.uid) }));
    if (avatar.sitUid === selectedItem.uid) setAvatar(a => ({ ...a, sitUid: null }));
    setSelectedUid(null);
  };

  const chooseModel = (id: string) => {
    const m = ROOM_MODELS.find(x => x.id === id);
    if (!m) return;
    if (level < m.minLevel) {
      showToast(`Planta "${m.name}" libera no nível ${m.minLevel}.`, 'info');
      return;
    }
    const target = parseModel(m);
    const bad = itemsNotFitting(layout.items, target, lookup);
    updateLayout(l => ({ ...l, model: id, items: l.items.filter(i => !bad.some(b => b.uid === i.uid)) }));
    if (bad.length) showToast(`${bad.length} mobi(s) não couberam na nova planta e voltaram ao inventário.`, 'info');
  };

  // ---------- Objetos ordenados por profundidade ----------
  type Obj = { key: number; node: React.ReactNode };
  const objects: Obj[] = [...floorNodes];
  const shadow = (gx: number, gy: number, w: number, d: number, z: number, k: string) => {
    const [cx, cy] = project(o, gx + w / 2, gy + d / 2, z);
    return <ellipse key={k} cx={cx} cy={cy} rx={(w + d) * 7 * UNIT} ry={(w + d) * 3.5 * UNIT} fill="#000" opacity={0.18} />;
  };

  for (const it of layout.items) {
    const def = lookup(it.mobiId);
    if (!def || it.uid === (mode.kind === 'placing' ? mode.movingUid : undefined)) continue;
    const { w, d } = footprint(def, it.rot);
    const z = (footprintHeight(pm, it.gx, it.gy, w, d) ?? 0) * STEP_Z;
    const selected = it.uid === selectedUid;
    objects.push({
      key: def.walkable ? it.gx + it.gy + 0.6 : it.gx + w + it.gy + d,
      node: (
        <g
          key={it.uid}
          className={`${mode.kind === 'idle' ? 'pixel-clickable' : ''} ${selected ? 'pixel-selected' : ''}`}
          onClick={(e) => { if (mode.kind !== 'idle') return; e.stopPropagation(); setSelectedUid(it.uid); }}
          onDoubleClick={(e) => { if (mode.kind !== 'idle') return; e.stopPropagation(); interact(it); }}
        >
          {!def.walkable && shadow(it.gx, it.gy, w, d, z, 's')}
          {def.render({ o, gx: it.gx, gy: it.gy, rot: it.rot, night, z, state: it.state ?? defaultState(def) })}
        </g>
      ),
    });
  }

  // Avatar
  const sitItem = avatar.sitUid ? layout.items.find(i => i.uid === avatar.sitUid) : null;
  const sitDef = sitItem ? lookup(sitItem.mobiId) : null;
  // sentado: com o corpo base, os joelhos ficam na altura do assento; no desenho procedural, o quadril
  const sitOffset = avatarPack ? -1 : -12;
  const avZ = (tileHeight(pm, avatar.pos[0], avatar.pos[1]) ?? 0) * STEP_Z + (sitDef ? (sitDef.seatZ ?? 8) + sitOffset : 0);
  const [avX, avY] = project(o, avatar.pos[0] + 0.5, avatar.pos[1] + 0.5, avZ);
  const moving = avatar.path.length > 0;
  const avatarFrame: AvatarFrame = sitDef ? 'sentado' : moving ? (['andar_1', 'andar_2', 'andar_3', 'andar_4'] as const)[walkFrame - 1] : 'parado';

  // Balão de fala: largura pelo texto, sempre dentro da cena
  let bubbleNode: React.ReactNode = null;
  if (bubble) {
    const text = bubble.length > 44 ? `${bubble.slice(0, 43)}…` : bubble;
    const bw = text.length * 6.4 + 16;
    const bh = 18;
    const lift = avatarPack ? (sitDef ? 76 : 90) : (sitDef ? 56 : 70);
    const avXGuess = project(o, avatar.pos[0] + 0.5, avatar.pos[1] + 0.5)[0];
    const left = avXGuess - bw / 2;
    const dx = Math.max(6 - left, 0) + Math.min(scene.width - 6 - (left + bw), 0);
    bubbleNode = (
      <g transform={`translate(${dx} ${-lift})`}>
        <rect x={-bw / 2} y={-bh} width={bw} height={bh} rx={4} fill="#f4f4f4" stroke={PALETTE.k} strokeWidth={1.5} />
        <polygon points={`${-dx - 4},0 ${-dx + 4},0 ${-dx},6`} fill="#f4f4f4" stroke={PALETTE.k} strokeWidth={1.5} />
        <text x={0} y={-5} textAnchor="middle" fontSize={11} fill="#1a1c2c" className="font-pixel">{text}</text>
      </g>
    );
  }

  objects.push({
    key: avatar.pos[0] + avatar.pos[1] + 2.05,
    node: (
      <g key="avatar" style={{ pointerEvents: 'none', transform: `translate(${avX}px, ${avY}px)`, transition: `transform ${STEP_MS}ms linear` }}>
        <ellipse cx={0} cy={0} rx={12} ry={5} fill="#000" opacity={0.2} />
        {avatarPack ? (
          <SheetAvatar pack={avatarPack} look={look} dir={avatar.dir} frame={avatarFrame} x={0} y={2} />
        ) : (
          <Avatar look={look} dir={avatar.dir} frame={moving ? ((walkFrame % 2) + 1) as 1 | 2 : 0} sitting={Boolean(sitDef)} x={0} y={1} />
        )}
        {bubbleNode}
      </g>
    ),
  });

  // Pigo (pet)
  const petZ = (tileHeight(pm, pet.pos[0], pet.pos[1]) ?? 0) * STEP_Z;
  const [ptX, ptY] = project(o, pet.pos[0] + 0.5, pet.pos[1] + 0.5, petZ);
  const customPigo = creatorImages.pigo;
  const { w: pw, h: ph } = spriteSize(PIGO);
  const petFlip = pet.dir === 'sw' || pet.dir === 'nw';
  objects.push({
    key: pet.pos[0] + pet.pos[1] + 2.04,
    node: (
      <g key="pet" style={{ pointerEvents: 'none', transform: `translate(${ptX}px, ${ptY}px)`, transition: `transform ${STEP_MS}ms linear` }}>
        <ellipse cx={0} cy={0} rx={8 * UNIT} ry={3.5 * UNIT} fill="#000" opacity={0.2} />
        {customPigo ? (
          <image href={customPigo.url} x={-customPigo.w / 2} y={-customPigo.h + 2} width={customPigo.w} height={customPigo.h} style={{ imageRendering: 'pixelated' }}
            transform={petFlip ? 'scale(-1 1)' : undefined} />
        ) : (
          <g className={pet.path.length ? '' : 'pixel-bob'}>
            <PixelSprite sprite={PIGO} x={-(pw * UNIT) / 2} y={-ph * UNIT + 2 * UNIT} scale={UNIT} flip={petFlip} />
            <g className="pixel-blink"><PixelSprite sprite={PIGO_BLINK} x={-(pw * UNIT) / 2} y={-ph * UNIT + 2 * UNIT} scale={UNIT} flip={petFlip} /></g>
          </g>
        )}
      </g>
    ),
  });
  objects.sort((a, b) => a.key - b.key);

  // Prévia de posicionamento
  let preview: React.ReactNode = null;
  if (placingDef && hover && mode.kind === 'placing') {
    const { w, d } = footprint(placingDef, mode.rot);
    const z = (footprintHeight(pm, hover[0], hover[1], w, d) ?? tileHeight(pm, hover[0], hover[1]) ?? 0) * STEP_Z;
    const tiles: React.ReactNode[] = [];
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < d; y++) {
        tiles.push(<IsoTile key={`pv${x}-${y}`} origin={{ ...o, y: o.y - z * UNIT }} gx={hover[0] + x} gy={hover[1] + y}
          color={placingValid ? 'rgba(115,239,247,0.35)' : 'rgba(239,68,68,0.45)'} outline={placingValid ? PALETTE.C : '#ef4444'} />);
      }
    }
    preview = (
      <g style={{ pointerEvents: 'none' }}>
        {tiles}
        <g opacity={0.75}>{placingDef.render({ o, gx: hover[0], gy: hover[1], rot: mode.rot, night, z })}</g>
      </g>
    );
  }
  const hoverZ = hover ? (tileHeight(pm, hover[0], hover[1]) ?? 0) * STEP_Z : 0;

  const roomMobis = catalog.filter(m => m.rooms.includes(roomId));
  const unlockedTotal = roomMobis.filter(m => can(m.unlock)).length;

  // ---------- UI dos painéis ----------
  const wardrobeRow = (label: string, options: WardrobeOption[], current: string, onPick: (id: string) => void) => (
    <div>
      <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">{label}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(opt => {
          const ok = can(opt.unlock);
          return (
            <button
              key={opt.id}
              disabled={!ok}
              onClick={() => onPick(opt.id)}
              title={ok ? opt.name : unlockLabel(opt.unlock)}
              className={`relative px-1.5 py-1.5 rounded-lg text-[10px] font-semibold border leading-tight ${
                current === opt.id ? 'bg-amber-500/15 border-amber-500/50 text-amber-200' : ok ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-slate-950/30 border-slate-850 text-slate-600'
              }`}
            >
              {!ok && <Lock className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" />}
              {opt.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Linha do provador com as peças do pacote oficial de um slot
  const packSlotRow = (label: string, slot: AvatarSlot, current: string | undefined, optional: boolean, onPick: (id: string) => void) => {
    const parts = (avatarPack?.parts || []).filter(p => p.slot === slot);
    const options: WardrobeOption[] = [
      ...(optional ? [{ id: 'nenhum', name: 'Nenhum', unlock: { type: 'default' as const } }] : []),
      ...parts.map(p => ({ id: p.id, name: p.name, unlock: p.unlock || { type: 'default' as const } })),
    ];
    if (options.length === 0) return null;
    const selected = current && options.some(o => o.id === current) ? current : (optional ? 'nenhum' : options[0].id);
    return wardrobeRow(label, options, selected, onPick);
  };

  const swatches = (label: string, colors: string[], current: string, onPick: (c: string) => void) => (
    <div>
      <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-1">
        {colors.map(col => (
          <button key={col} onClick={() => onPick(col)} title={col}
            className={`w-5 h-5 rounded-md border ${current === col ? 'border-white ring-2 ring-amber-400' : 'border-slate-700'}`}
            style={{ background: col }} />
        ))}
        <label className="w-5 h-5 rounded-md border border-dashed border-slate-500 flex items-center justify-center text-[10px] text-slate-400 cursor-pointer overflow-hidden" title="Cor livre">
          +
          <input type="color" value={current} onChange={(e) => onPick(e.target.value)} className="opacity-0 w-0 h-0" />
        </label>
      </div>
    </div>
  );

  const surfaceList = (kind: 'paredes' | 'pisos') => {
    const options = kind === 'paredes' ? wallOptions : floorOptions;
    const currentId = kind === 'paredes' ? layout.wallpaper : layout.floor;
    const custom = kind === 'paredes' ? (layout.customWall || wallColors) : (layout.customFloor || floorColors);
    return (
      <div className="space-y-2">
        {kind === 'paredes' && (
          <div className="grid grid-cols-3 gap-1.5 mb-1">
            {(['baixa', 'normal', 'alta'] as const).map(hgt => (
              <button key={hgt} onClick={() => updateLayout(l => ({ ...l, wallHeight: hgt }))}
                className={`py-1.5 rounded-lg text-[11px] font-semibold border capitalize ${(layout.wallHeight || 'normal') === hgt ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' : 'bg-slate-950/60 border-slate-800 text-slate-300'}`}>
                Parede {hgt}
              </button>
            ))}
          </div>
        )}
        {options.map(s => {
          const ok = can(s.unlock);
          return (
            <button
              key={s.id}
              disabled={!ok}
              onClick={() => updateLayout(l => (kind === 'paredes' ? { ...l, wallpaper: s.id } : { ...l, floor: s.id }))}
              className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left ${
                currentId === s.id ? 'bg-amber-500/10 border-amber-500/40' : ok ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700' : 'bg-slate-950/30 border-slate-850'
              }`}
            >
              <span className="flex w-10 h-8 rounded-md overflow-hidden border border-slate-700 shrink-0" style={{ filter: ok ? undefined : 'grayscale(1) brightness(0.5)' }}>
                {s.image ? <img src={s.image} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} alt="" /> : (
                  <>
                    <span className="flex-1" style={{ background: s.colors[0] }} />
                    <span className="flex-1" style={{ background: s.colors[1] }} />
                  </>
                )}
              </span>
              <span className="min-w-0">
                <span className={`text-xs font-semibold block truncate ${ok ? 'text-white' : 'text-slate-500'}`}>{s.name}</span>
                <span className="text-[10px] text-slate-500">{ok ? (currentId === s.id ? 'Em uso' : 'Clique para usar') : unlockLabel(s.unlock)}</span>
              </span>
              {!ok && <Lock className="ml-auto w-3.5 h-3.5 text-slate-500" />}
            </button>
          );
        })}
        <div className={`p-2 rounded-xl border ${currentId === 'custom' ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950/60 border-slate-800'}`}>
          <span className="text-xs font-semibold text-white block mb-1.5">Cores livres</span>
          <div className="flex items-center gap-3">
            {[0, 1].map(idx => (
              <label key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <input
                  type="color"
                  value={custom[idx]}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateLayout(l => {
                      const base: [string, string] = kind === 'paredes' ? [...(l.customWall || wallColors)] as [string, string] : [...(l.customFloor || floorColors)] as [string, string];
                      base[idx] = value;
                      return kind === 'paredes' ? { ...l, wallpaper: 'custom', customWall: base } : { ...l, floor: 'custom', customFloor: base };
                    });
                  }}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                {kind === 'paredes' ? (idx === 0 ? 'Fundo' : 'Lateral') : (idx === 0 ? 'Tile A' : 'Tile B')}
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const TABS: { id: Panel; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'mobis', label: 'Mobis', Icon: Armchair },
    { id: 'visual', label: 'Visual', Icon: Shirt },
    { id: 'plantas', label: 'Plantas', Icon: LayoutGrid },
    { id: 'paredes', label: 'Paredes', Icon: Lamp },
    { id: 'pisos', label: 'Pisos', Icon: Package },
    { id: 'criador', label: 'Criador', Icon: Pickaxe },
  ];

  return (
    <div ref={wrapperRef} className={`h-full flex flex-col ${isFullscreen ? 'bg-[#0b0e1a] p-3' : 'p-4'} gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {avatarPack ? (
            <span className="w-8"><SheetAvatarViews pack={avatarPack} look={look} height={44} dirs={['s']} /></span>
          ) : (
            <AvatarPreview look={look} size={44} />
          )}
          <div>
            <h1 className="text-xl font-pixel font-bold text-white leading-none">{room.name}</h1>
            <p className="text-[11px] text-slate-400 mt-1">
              Planta: {model.name} • {pm.tileCount} tiles • clique no piso para andar • duplo clique para sentar/acender
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-850">
            {ROOMS.map(r => (
              <button key={r.id} disabled={!r.available} onClick={() => { setRoomId(r.id); setMode({ kind: 'idle' }); setSelectedUid(null); }}
                title={r.available ? r.name : r.subtitle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-pixel transition-all ${
                  roomId === r.id ? 'bg-amber-500/20 text-amber-300' : r.available ? 'text-slate-300 hover:text-white' : 'text-slate-600 cursor-not-allowed'
                }`}>
                {!r.available && <Lock className="w-3 h-3" />}
                {r.name}
              </button>
            ))}
          </div>
          <button onClick={() => setPanelOpen(v => !v)} title={panelOpen ? 'Esconder painel' : 'Mostrar painel'} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white">
            {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <button onClick={toggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div
            ref={stageRef}
            className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border-4 border-slate-800 flex items-center justify-center"
            style={{ cursor: mode.kind === 'placing' ? (placingValid ? 'copy' : 'not-allowed') : 'default', background: night ? 'radial-gradient(circle at 50% 30%, #1b2140, #0b0e1a)' : 'radial-gradient(circle at 50% 30%, #23304f, #10142a)' }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${scene.width} ${scene.height}`}
              width={scene.width * scale}
              height={scene.height * scale}
              shapeRendering="crispEdges"
              className="pixel-scene block"
              onMouseMove={(e) => setHover(tileFromEvent(e))}
              onMouseLeave={() => setHover(null)}
              onClick={handleSceneClick}
            >
              {wallNode}
              {objects.map(ob => <React.Fragment key={(ob.node as React.ReactElement).key}>{ob.node}</React.Fragment>)}
              {hover && mode.kind === 'idle' && (
                <IsoTile origin={{ ...o, y: o.y - hoverZ * UNIT }} gx={hover[0]} gy={hover[1]} color="rgba(255,255,255,0.16)" outline={PALETTE.w} />
              )}
              {preview}
              {night && <rect x={0} y={0} width={scene.width} height={scene.height} fill="#0b1030" opacity={0.16} pointerEvents="none" />}
            </svg>

            {mode.kind === 'placing' && placingDef && (
              <div className="absolute top-3 left-3 flex items-center gap-2 font-pixel text-xs bg-[#f4f4f4] text-slate-900 border-2 border-[#1a1c2c] px-2 py-1 shadow-[3px_3px_0_#1a1c2c]">
                Posicionando: {placingDef.name} • R gira • Esc cancela
              </div>
            )}
          </div>

          {selectedItem && selectedDef && mode.kind === 'idle' && (
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <span className="font-pixel text-sm text-amber-300">{selectedDef.name}</span>
                <span className="text-[11px] text-slate-400 block">{selectedDef.description}</span>
              </div>
              <div className="flex gap-1.5">
                {(selectedDef.seat || selectedDef.toggle) && (
                  <button onClick={() => interact(selectedItem)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500">
                    {selectedDef.seat ? <><Armchair className="w-3.5 h-3.5" /> Sentar</> : <><Lamp className="w-3.5 h-3.5" /> Ligar/Desligar</>}
                  </button>
                )}
                <button onClick={rotateSelected} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750">
                  <RotateCw className="w-3.5 h-3.5" /> Girar
                </button>
                <button onClick={() => { setMode({ kind: 'placing', mobiId: selectedItem.mobiId, rot: selectedItem.rot, movingUid: selectedItem.uid }); setSelectedUid(null); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750">
                  <Move className="w-3.5 h-3.5" /> Mover
                </button>
                <button onClick={pickUpSelected} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750">
                  <Package className="w-3.5 h-3.5" /> Guardar
                </button>
                <button onClick={() => setSelectedUid(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {panelOpen && (
          <div className="w-[310px] shrink-0 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3 min-h-0">
            <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-850 shrink-0">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setPanel(id)}
                  className={`flex items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-semibold rounded-md ${panel === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {panel === 'mobis' && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-pixel text-base text-white">Inventário</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-400" /> {unlockedTotal}/{roomMobis.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[...roomMobis].sort((a, b) => Number(can(b.unlock)) - Number(can(a.unlock))).map(def => {
                      const ok = can(def.unlock);
                      const available = def.qty - (placedCount[def.id] || 0);
                      const active = mode.kind === 'placing' && mode.mobiId === def.id && !mode.movingUid;
                      return (
                        <button key={def.id} disabled={!ok || available <= 0}
                          onClick={() => { setSelectedUid(null); setMode({ kind: 'placing', mobiId: def.id, rot: 0 }); }}
                          title={ok ? def.description : `Bloqueado — ${unlockLabel(def.unlock)}`}
                          className={`relative flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                            active ? 'bg-cyan-500/10 border-cyan-400/50' : ok ? 'bg-slate-950/60 border-slate-800 hover:border-amber-500/50' : 'bg-slate-950/30 border-slate-850'
                          } ${ok && available <= 0 ? 'opacity-50' : ''}`}>
                          <MobiPreview def={def} locked={!ok} />
                          <span className={`text-[11px] font-semibold leading-tight ${ok ? 'text-white' : 'text-slate-500'}`}>{def.name}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            {ok ? (def.qty >= 99 ? 'Ilimitado' : `${Math.max(0, available)} de ${def.qty}`) : unlockLabel(def.unlock)}
                          </span>
                          {!ok && <Lock className="absolute top-2 right-2 w-3 h-3 text-slate-500" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {panel === 'visual' && (
                <div className="space-y-3">
                  <div className="flex items-end justify-center gap-4 p-2 rounded-xl bg-gradient-to-b from-slate-200 to-slate-50 border border-slate-800">
                    {avatarPack ? (
                      <SheetAvatarViews pack={avatarPack} look={look} height={120} />
                    ) : (
                      <>
                        <AvatarPreview look={look} dir="se" size={128} />
                        <AvatarPreview look={look} dir="nw" size={128} />
                      </>
                    )}
                  </div>
                  {swatches('Pele', SKIN_TONES, look.skin, c => updateLook({ skin: c }))}
                  {avatarPack ? (
                    <>
                      {packSlotRow('Cabelo', 'cabelo', look.hair, true, id => updateLook({ hair: id }))}
                      {swatches('Cor do cabelo', PALETTE_CHOICES, look.hairColor, c => updateLook({ hairColor: c }))}
                      {packSlotRow('Roupa', 'roupa', look.top, false, id => updateLook({ top: id }))}
                      {swatches('Cor da roupa', PALETTE_CHOICES, look.topColor, c => updateLook({ topColor: c }))}
                      {packSlotRow('Calça', 'calca', look.pants, false, id => updateLook({ pants: id }))}
                      {swatches('Cor da calça', PALETTE_CHOICES, look.pantsColor, c => updateLook({ pantsColor: c }))}
                      {packSlotRow('Sapatos', 'sapato', look.shoes, false, id => updateLook({ shoes: id }))}
                      {swatches('Cor dos sapatos', PALETTE_CHOICES, look.shoesColor, c => updateLook({ shoesColor: c }))}
                      {packSlotRow('Acessório', 'chapeu', look.hat, true, id => updateLook({ hat: id }))}
                      {swatches('Cor do acessório', PALETTE_CHOICES, look.hatColor, c => updateLook({ hatColor: c }))}
                      <p className="text-[10px] text-slate-500">
                        Novas peças: desenhe no modelo design/avatar/modelo_avatar.psd, exporte a camada para src/game/pack/avatar e cadastre em pack.json.
                      </p>
                    </>
                  ) : (
                    <>
                      {wardrobeRow('Cabelo', HAIR_STYLES, look.hair, id => updateLook({ hair: id }))}
                      {swatches('Cor do cabelo', PALETTE_CHOICES, look.hairColor, c => updateLook({ hairColor: c }))}
                      {wardrobeRow('Roupa', TOP_STYLES, look.top, id => updateLook({ top: id }))}
                      {swatches('Cor da roupa', PALETTE_CHOICES, look.topColor, c => updateLook({ topColor: c }))}
                      {swatches('Calça', PALETTE_CHOICES, look.pantsColor, c => updateLook({ pantsColor: c }))}
                      {swatches('Sapatos', PALETTE_CHOICES, look.shoesColor, c => updateLook({ shoesColor: c }))}
                      {wardrobeRow('Acessório', HATS, look.hat, id => updateLook({ hat: id }))}
                      {swatches('Cor do acessório', PALETTE_CHOICES, look.hatColor, c => updateLook({ hatColor: c }))}
                    </>
                  )}
                </div>
              )}

              {panel === 'plantas' && (
                <div className="grid grid-cols-2 gap-2">
                  {ROOM_MODELS.map(m => {
                    const ok = level >= m.minLevel;
                    const p = parseModel(m);
                    return (
                      <button key={m.id} onClick={() => chooseModel(m.id)} title={ok ? m.description : `Libera no nível ${m.minLevel}`}
                        className={`relative flex flex-col items-center p-2 rounded-xl border text-center ${
                          layout.model === m.id ? 'bg-amber-500/10 border-amber-500/50' : ok ? 'bg-slate-950/60 border-slate-800 hover:border-amber-500/40' : 'bg-slate-950/30 border-slate-850'
                        }`}>
                        <ModelPreview pm={p} locked={!ok} />
                        <span className={`text-[11px] font-semibold ${ok ? 'text-white' : 'text-slate-500'}`}>{m.name}</span>
                        <span className="text-[10px] text-slate-500">{ok ? `${p.tileCount} tiles${p.maxH ? ' • desníveis' : ''}` : `Nível ${m.minLevel}`}</span>
                        {!ok && <Lock className="absolute top-2 right-2 w-3 h-3 text-slate-500" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {panel === 'paredes' && surfaceList('paredes')}
              {panel === 'pisos' && surfaceList('pisos')}

              {panel === 'criador' && (
                <div className="space-y-3 text-[11px] text-slate-400">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-white block">Pacote oficial (para todos os jogadores)</span>
                    <span className="block">
                      Os assets que você disponibiliza ficam em <code className="text-amber-300">src/game/pack/</code> e são cadastrados em
                      <code className="text-amber-300"> pack.json</code> (nome, tamanho e qual conquista/nível libera). Eles vão junto no instalador.
                    </span>
                    <span className="block">No pacote agora: {ASSET_PACK.mobis.length} mobi(s), {ASSET_PACK.floors.length} piso(s), {ASSET_PACK.walls.length} parede(s).</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-white block">Modo criador (testar antes de publicar)</span>
                    <span className="block">Solte um PNG nesta pasta e clique em Recarregar para vê-lo no quarto na hora, sem recompilar.</span>
                    <span className="text-[10px] text-slate-500 block break-all">{creatorAssets?.folder}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => window.electronAPI?.openGameAssetsFolder()} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750">
                        <FolderOpen className="w-3.5 h-3.5" /> Abrir pasta
                      </button>
                      <button onClick={async () => { await loadCreatorAssets(); showToast('Assets do criador recarregados!', 'success'); }}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750">
                        <RefreshCw className="w-3.5 h-3.5" /> Recarregar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
