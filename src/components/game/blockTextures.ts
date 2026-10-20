import * as THREE from 'three';
import type { BlockType } from './types';

/**
 * Texturas dos blocos, desenhadas pixel a pixel (16x16, estilo Minecraft) num único atlas.
 * Tudo é gerado no navegador na hora: não precisa baixar imagens.
 * Cada textura fica numa "célula" de 18x18 com 1 pixel de borda repetida (evita linhas entre blocos).
 */

export const TILE = 16;
const CELL = TILE + 2;
const COLS = 8;

type RGB = [number, number, number];
type Px = [number, number, number, number]; // r, g, b, a (0..255)
type Painter = (rand: () => number) => Px[]; // TILE*TILE pixels, linha a linha (y=0 é o topo)

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const shade = (c: RGB, k: number, a = 255): Px => [clamp(c[0] * k), clamp(c[1] * k), clamp(c[2] * k), a];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grid = (fn: (x: number, y: number) => Px): Px[] => {
  const out: Px[] = [];
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.push(fn(x, y));
  return out;
};

/** Ruído simples: cada pixel varia um pouco de brilho em volta da cor base. */
const noisy = (base: string, amount = 0.14): Painter => rand => {
  const c = hex(base);
  return grid(() => shade(c, 1 - amount / 2 + rand() * amount));
};

const grassTop = (base: string): Painter => rand => {
  const c = hex(base);
  return grid(() => {
    const r = rand();
    // tufinhos mais escuros e mais claros, como folhas de grama
    const k = r < 0.12 ? 0.8 : r > 0.9 ? 1.12 : 0.92 + rand() * 0.14;
    return shade(c, k);
  });
};

const dirtPx = (rand: () => number, dirt: RGB) => {
  const r = rand();
  return r < 0.1 ? shade(dirt, 0.72) : r > 0.93 ? shade(mix(dirt, [150, 150, 140], 0.5), 1) : shade(dirt, 0.9 + rand() * 0.16);
};

const dirt: Painter = rand => {
  const d = hex('#866043');
  return grid(() => dirtPx(rand, d));
};

const grassSide = (base: string): Painter => rand => {
  const g = hex(base);
  const d = hex('#866043');
  // franja de grama com borda irregular
  const fringe = Array.from({ length: TILE }, () => 2 + Math.floor(rand() * 3));
  return grid((x, y) => (y < fringe[x] ? shade(g, 0.86 + rand() * 0.16) : dirtPx(rand, d)));
};

const stone = (base = '#8f8f8f'): Painter => rand => {
  const c = hex(base);
  const px = grid(() => shade(c, 0.88 + rand() * 0.18));
  // rachaduras/manchas horizontais
  for (let i = 0; i < 5; i++) {
    const y = Math.floor(rand() * TILE), x0 = Math.floor(rand() * TILE), len = 2 + Math.floor(rand() * 4);
    for (let x = x0; x < Math.min(TILE, x0 + len); x++) px[y * TILE + x] = shade(c, 0.72);
  }
  return px;
};

/** Pedregulho: pedras arredondadas com "cimento" escuro entre elas (diagrama de Voronoi). */
const cobble = (base = '#7a7a7a'): Painter => rand => {
  const c = hex(base);
  const pts = Array.from({ length: 9 }, () => [rand() * TILE, rand() * TILE, 0.85 + rand() * 0.3]);
  return grid((x, y) => {
    let d1 = 1e9, d2 = 1e9, k = 1;
    for (const [px, py, pk] of pts) {
      for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
        const d = (x - px - ox) ** 2 + (y - py - oy) ** 2;
        if (d < d1) { d2 = d1; d1 = d; k = pk; } else if (d < d2) d2 = d;
      }
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1) < 1.1;
    return edge ? shade(c, 0.55) : shade(c, k * (0.92 + rand() * 0.12));
  });
};

const sand = (base: string): Painter => rand => {
  const c = hex(base);
  return grid(() => {
    const r = rand();
    return shade(c, r < 0.08 ? 0.86 : r > 0.95 ? 1.08 : 0.95 + rand() * 0.08);
  });
};

const sandstone = (base: string, top = false): Painter => rand => {
  const c = hex(base);
  return grid((x, y) => {
    if (top) return shade(c, 0.95 + rand() * 0.08);
    const band = y < 3 ? 1.06 : y === 3 || y === 11 ? 0.84 : y > 12 ? 0.9 : 0.98;
    return shade(c, band * (0.96 + rand() * 0.06));
  });
};

const logSide = (base: string, birch = false): Painter => rand => {
  const c = hex(base);
  const stripes = Array.from({ length: TILE }, () => 0.82 + rand() * 0.25);
  const px = grid((x, y) => shade(c, stripes[x] * (0.94 + rand() * 0.1) * (birch ? 1 : (y % 5 === 0 && rand() < 0.3 ? 0.85 : 1))));
  if (birch) {
    // manchas pretas da bétula
    for (let i = 0; i < 6; i++) {
      const y = Math.floor(rand() * TILE), x0 = Math.floor(rand() * TILE), len = 2 + Math.floor(rand() * 3);
      for (let x = x0; x < Math.min(TILE, x0 + len); x++) px[y * TILE + x] = shade([40, 40, 36], 1);
    }
  }
  return px;
};

const logTop = (bark: string, inner: string): Painter => rand => {
  const b = hex(bark), w = hex(inner);
  return grid((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.5) return shade(b, 0.9 + rand() * 0.1);
    const ring = Math.floor(d) % 2 === 0 ? 1 : 0.86;
    return shade(w, ring * (0.95 + rand() * 0.08));
  });
};

const planks = (base: string): Painter => rand => {
  const c = hex(base);
  const plankK = [0.98, 1.05, 0.94, 1.02];
  return grid((x, y) => {
    const row = Math.floor(y / 4);
    if (y % 4 === 3) return shade(c, 0.62);
    const seam = (row % 2 === 0 ? 7 : 12);
    if (x === seam && y % 4 !== 3) return shade(c, 0.7);
    const grain = rand() < 0.12 ? 0.86 : 1;
    return shade(c, plankK[row] * grain * (0.96 + rand() * 0.06));
  });
};

const leaves = (base: string): Painter => rand => {
  const c = hex(base);
  return grid(() => {
    const r = rand();
    if (r < 0.22) return [0, 0, 0, 0]; // buraquinhos: dá para ver através das folhas
    return shade(c, r > 0.85 ? 1.18 : 0.78 + rand() * 0.3);
  });
};

/** Minério: pedra com aglomerados de pedrinhas coloridas e um pixel de brilho em cada uma. */
const ore = (oreColor: string, stoneBase = '#8f8f8f'): Painter => rand => {
  const px = stone(stoneBase)(rand);
  const o = hex(oreColor);
  const clusters = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < clusters; i++) {
    const cx = 2 + Math.floor(rand() * 12), cy = 2 + Math.floor(rand() * 12);
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].slice(0, 3 + Math.floor(rand() * 4));
    for (const [dx, dy] of cells) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= TILE || y >= TILE) continue;
      px[y * TILE + x] = shade(o, 0.8 + rand() * 0.25);
    }
    // sombra embaixo e brilho em cima: parece pedra preciosa encrustada
    if (cy + 2 < TILE) px[(cy + 2) * TILE + cx] = shade(o, 0.45);
    px[cy * TILE + cx] = shade(mix(o, [255, 255, 255], 0.55), 1);
  }
  return px;
};

const glowstone: Painter = rand => {
  const c = hex('#f2c35a');
  return cobble('#d9a441')(rand).map(p => (p[0] < 150 ? shade(hex('#8a5a1c'), 1) : shade(c, 0.9 + rand() * 0.25)));
};

const bricks = (base: string): Painter => rand => {
  const c = hex(base);
  return grid((x, y) => {
    const row = Math.floor(y / 4);
    if (y % 4 === 3) return shade(c, 0.45);
    const off = row % 2 === 0 ? 0 : 4;
    if ((x + off) % 8 === 7) return shade(c, 0.45);
    return shade(c, 0.9 + rand() * 0.18);
  });
};

const cactusSide: Painter = rand => {
  const c = hex('#3f8f3a');
  return grid((x, y) => {
    if (x === 0 || x === 15) return shade(c, 0.7);
    if (x % 4 === 2) return (y % 4 === 1 && rand() < 0.7) ? [230, 225, 170, 255] : shade(c, 1.12); // espinhos
    return shade(c, 0.9 + rand() * 0.1);
  });
};
const cactusTop: Painter = rand => {
  const c = hex('#4fa04a');
  return grid((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    return shade(c, d > 6.5 ? 0.72 : d < 2 ? 1.12 : 0.95 + rand() * 0.08);
  });
};

const ice: Painter = rand => {
  const c = hex('#a8d8f2');
  return grid((x, y) => {
    const streak = (x + y * 2) % 11 === 0 || (x * 2 - y + 40) % 13 === 0;
    return shade(c, streak ? 1.15 : 0.93 + rand() * 0.08);
  });
};

const snow: Painter = rand => grid(() => shade(hex('#f4f7fb'), 0.94 + rand() * 0.07));

const torch: Painter = () => grid((x, y) => {
  if (x < 7 || x > 8) return [0, 0, 0, 0];
  if (y < 3) return [255, 220, 90, 255];
  if (y < 5) return [255, 150, 40, 255];
  if (y < 6) return [70, 40, 20, 255];
  return y < 16 ? (x === 7 ? [120, 82, 46, 255] : [92, 62, 34, 255]) : [0, 0, 0, 0];
});

const craftingTop = (planksP: Painter): Painter => rand => {
  const px = planksP(rand);
  for (let i = 1; i < TILE - 1; i++) {
    px[1 * TILE + i] = px[14 * TILE + i] = px[i * TILE + 1] = px[i * TILE + 14] = [70, 45, 25, 255];
    if (i % 4 === 0) for (let j = 2; j < 14; j++) { px[j * TILE + i] = [110, 75, 40, 255]; px[i * TILE + j] = [110, 75, 40, 255]; }
  }
  return px;
};
const craftingSide = (planksP: Painter): Painter => rand => {
  const px = planksP(rand);
  // serra e martelo desenhados de leve
  for (let x = 3; x < 8; x++) px[5 * TILE + x] = [190, 190, 195, 255];
  for (let y = 5; y < 11; y++) px[y * TILE + 4] = [90, 60, 30, 255];
  for (let x = 9; x < 13; x++) px[4 * TILE + x] = [150, 150, 155, 255];
  for (let y = 4; y < 11; y++) px[y * TILE + 11] = [100, 66, 34, 255];
  return px;
};

const door: Painter = rand => {
  const px = planks('#a1887f')(rand);
  for (let y = 2; y < 7; y++) for (let x = 3; x < 13; x++) px[y * TILE + x] = (x === 8 ? [110, 85, 70, 255] : [170, 210, 230, 255]);
  px[9 * TILE + 12] = px[9 * TILE + 13] = [60, 60, 60, 255];
  return px;
};

const white: Painter = () => grid(() => [255, 255, 255, 255]);

const obsidian: Painter = rand => {
  const c = hex('#1e1030');
  return grid(() => {
    const r = rand();
    return r > 0.93 ? shade(hex('#6b4a9c'), 1) : shade(c, 0.85 + rand() * 0.3);
  });
};

// ---------- Qual textura vai em cada face ----------
type Role = 'top' | 'side' | 'bottom';
interface BlockTex { top: Painter; side: Painter; bottom?: Painter }

const planksP = planks('#b8904a');
const BLOCKS: Partial<Record<BlockType, BlockTex>> = {
  grass: { top: grassTop('#5fa83a'), side: grassSide('#5fa83a'), bottom: dirt },
  dry_grass: { top: grassTop('#b3a64a'), side: grassSide('#b3a64a'), bottom: dirt },
  jungle_grass: { top: grassTop('#3fae32'), side: grassSide('#3fae32'), bottom: dirt },
  swamp_grass: { top: grassTop('#5d7636'), side: grassSide('#5d7636'), bottom: dirt },
  dirt: { top: dirt, side: dirt },
  stone: { top: stone(), side: stone() },
  cobblestone: { top: cobble(), side: cobble() },
  sand: { top: sand('#e3d3a0'), side: sand('#e3d3a0') },
  sandstone: { top: sandstone('#d6c08a', true), side: sandstone('#d6c08a') },
  snow: { top: snow, side: snow },
  ice: { top: ice, side: ice },
  wood: { top: logTop('#5a3d22', '#b08850'), side: logSide('#5a3d22') },
  birch_wood: { top: logTop('#dcd6c6', '#d9c18a'), side: logSide('#dcd6c6', true) },
  planks: { top: planksP, side: planksP },
  leaves: { top: leaves('#3a8a2c'), side: leaves('#3a8a2c') },
  spruce_leaves: { top: leaves('#2b5a38'), side: leaves('#2b5a38') },
  jungle_leaves: { top: leaves('#2fa632'), side: leaves('#2fa632') },
  acacia_leaves: { top: leaves('#7aa035'), side: leaves('#7aa035') },
  coal_ore: { top: ore('#262626'), side: ore('#262626') },
  iron_ore: { top: ore('#d8a982'), side: ore('#d8a982') },
  copper_ore: { top: ore('#d4803a'), side: ore('#d4803a') },
  gold_ore: { top: ore('#ffd84a'), side: ore('#ffd84a') },
  lapis_ore: { top: ore('#2357c9'), side: ore('#2357c9') },
  diamond_ore: { top: ore('#5ff2e6'), side: ore('#5ff2e6') },
  netherite_ore: { top: ore('#6b4a3a', '#5a2a24'), side: ore('#6b4a3a', '#5a2a24') },
  obsidian: { top: obsidian, side: obsidian },
  netherrack: { top: noisy('#8f2323', 0.3), side: noisy('#8f2323', 0.3) },
  nether_brick: { top: bricks('#4a1a1a'), side: bricks('#4a1a1a') },
  glowstone: { top: glowstone, side: glowstone },
  bedrock: { top: noisy('#4a4a4a', 0.7), side: noisy('#4a4a4a', 0.7) },
  cactus: { top: cactusTop, side: cactusSide },
  torch: { top: torch, side: torch },
  door: { top: planks('#a1887f'), side: door },
  crafting_table: { top: craftingTop(planksP), side: craftingSide(planksP), bottom: planksP },
};

/** Blocos que brilham sozinhos (aparecem mesmo no escuro). */
export const GLOWING: Partial<Record<BlockType, number>> = { glowstone: 0.9, torch: 1, diamond_ore: 0.25, gold_ore: 0.15, lapis_ore: 0.12 };

let atlas: { texture: THREE.CanvasTexture; glow: THREE.CanvasTexture; uv: Map<string, [number, number, number, number]> } | null = null;

function paintAll() {
  const entries: [string, Painter, number][] = [['_white', white, 0]];
  let seed = 11;
  for (const [type, tex] of Object.entries(BLOCKS) as [BlockType, BlockTex][]) {
    entries.push([`${type}:top`, tex.top, GLOWING[type] ?? 0]);
    entries.push([`${type}:side`, tex.side, GLOWING[type] ?? 0]);
    if (tex.bottom) entries.push([`${type}:bottom`, tex.bottom, GLOWING[type] ?? 0]);
  }
  const rows = Math.ceil(entries.length / COLS);
  const W = COLS * CELL, H = rows * CELL;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  };
  const canvas = make(), glowCanvas = make();
  const ctx = canvas.getContext('2d')!, gctx = glowCanvas.getContext('2d')!;
  const img = ctx.createImageData(W, H), gimg = gctx.createImageData(W, H);
  const uv = new Map<string, [number, number, number, number]>();

  entries.forEach(([key, painter, glow], i) => {
    const px = painter(rng(seed += 97));
    const col = i % COLS, row = Math.floor(i / COLS);
    const ox = col * CELL, oy = row * CELL;
    for (let y = -1; y <= TILE; y++) for (let x = -1; x <= TILE; x++) {
      // borda de 1 pixel repete a beira da textura (sem linhas entre os blocos de longe)
      const sx = Math.min(TILE - 1, Math.max(0, x)), sy = Math.min(TILE - 1, Math.max(0, y));
      const p = px[sy * TILE + sx];
      const o = ((oy + 1 + y) * W + (ox + 1 + x)) * 4;
      img.data[o] = p[0]; img.data[o + 1] = p[1]; img.data[o + 2] = p[2]; img.data[o + 3] = p[3];
      // Brilho próprio: só as partes claras/coloridas (pedrinhas do minério, chama da tocha)
      const bright = Math.max(p[0], p[1], p[2]);
      const sat = bright - Math.min(p[0], p[1], p[2]);
      const g = glow > 0 && p[3] > 0 && (sat > 60 || bright > 200) ? glow : 0;
      gimg.data[o] = p[0] * g; gimg.data[o + 1] = p[1] * g; gimg.data[o + 2] = p[2] * g; gimg.data[o + 3] = 255;
    }
    const u0 = (ox + 1) / W, u1 = (ox + 1 + TILE) / W;
    // a textura é "virada" (flipY): v = 1 é o topo da imagem
    const vTop = 1 - (oy + 1) / H, vBottom = 1 - (oy + 1 + TILE) / H;
    uv.set(key, [u0, vBottom, u1, vTop]);
  });
  ctx.putImageData(img, 0, 0);
  gctx.putImageData(gimg, 0, 0);

  const setup = (c: HTMLCanvasElement, color: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { texture: setup(canvas, true), glow: setup(glowCanvas, true), uv };
}

/** Atlas com todas as texturas (criado uma vez, na primeira vez que é pedido). */
export function getBlockAtlas() {
  if (!atlas) atlas = paintAll();
  return atlas;
}

/** Coordenadas [u0, v0, u1, v1] da textura de um bloco numa face. Blocos sem textura própria usam branco. */
export function blockUV(type: BlockType | 'white', role: Role): [number, number, number, number] {
  const { uv } = getBlockAtlas();
  return uv.get(`${type}:${role}`) ?? (role === 'bottom' ? uv.get(`${type}:side`) : undefined) ?? uv.get('_white')!;
}

/** Tem textura própria (então a cor do vértice deve ser branca, não a cor do bloco). */
export const hasTexture = (type: BlockType) => type in BLOCKS;
