import { BlockType } from './types';

/** Tamanho do mundo (a ilha). Era 20x20; agora é 128x128, com vários biomas. */
export const WORLD_SIZE = 128;
export const WORLD_HALF = WORLD_SIZE / 2;
/**
 * Altura onde começa a superfície. Tudo abaixo é subsolo: uns 30 blocos de
 * pedra com minérios, cavernas e ravinas, e bedrock no fundo (y = 0).
 */
export const SURFACE_BASE = 34;
export const WATER_LEVEL = SURFACE_BASE + 2;
/** Cavernas e ravinas ficam abaixo desta altura (uns 30 blocos sob a superfície). */
export const CAVE_TOP = 10;

export type BiomeId =
  | 'plains' | 'forest' | 'desert' | 'savanna' | 'jungle'
  | 'swamp' | 'taiga' | 'mountains' | 'beach' | 'ocean';

export interface BiomeInfo {
  name: string;
  emoji: string;
  /** Bloco da superfície e dos 2 blocos logo abaixo. */
  surface: BlockType;
  subsurface: BlockType;
  /** Altura base e variação do relevo. */
  base: number;
  amp: number;
  /** Chance (0–1) de nascer uma árvore/cacto em cada coluna. */
  treeChance: number;
  flowerChance: number;
}

export const BIOMES: Record<BiomeId, BiomeInfo> = {
  plains:    { name: 'Planície',      emoji: '🌾', surface: 'grass',        subsurface: 'dirt',      base: 4, amp: 2.5, treeChance: 0.012, flowerChance: 0.06 },
  forest:    { name: 'Floresta',      emoji: '🌳', surface: 'grass',        subsurface: 'dirt',      base: 4, amp: 3.5, treeChance: 0.10,  flowerChance: 0.03 },
  desert:    { name: 'Deserto',       emoji: '🏜️', surface: 'sand',         subsurface: 'sandstone', base: 4, amp: 2,   treeChance: 0.02,  flowerChance: 0 },
  savanna:   { name: 'Savana',        emoji: '🦒', surface: 'dry_grass',    subsurface: 'dirt',      base: 5, amp: 2,   treeChance: 0.018, flowerChance: 0.01 },
  jungle:    { name: 'Selva',         emoji: '🌴', surface: 'jungle_grass', subsurface: 'dirt',      base: 5, amp: 4.5, treeChance: 0.11,  flowerChance: 0.04 },
  swamp:     { name: 'Pântano',       emoji: '🐸', surface: 'swamp_grass',  subsurface: 'dirt',      base: 2, amp: 1.6, treeChance: 0.04,  flowerChance: 0.01 },
  taiga:     { name: 'Taiga Nevada',  emoji: '❄️', surface: 'snow',         subsurface: 'dirt',      base: 5, amp: 3.5, treeChance: 0.07,  flowerChance: 0 },
  mountains: { name: 'Montanhas',     emoji: '⛰️', surface: 'stone',        subsurface: 'stone',     base: 7, amp: 15,  treeChance: 0.012, flowerChance: 0 },
  beach:     { name: 'Praia',         emoji: '🏖️', surface: 'sand',         subsurface: 'sand',      base: 2, amp: 1,   treeChance: 0,     flowerChance: 0 },
  ocean:     { name: 'Oceano',        emoji: '🌊', surface: 'sand',         subsurface: 'sand',      base: 0, amp: 0,   treeChance: 0,     flowerChance: 0 },
};

/** Biomas de terra que podem aparecer na ilha (todo mapa tem todos). */
const LAND_BIOMES: BiomeId[] = ['forest', 'desert', 'savanna', 'jungle', 'swamp', 'taiga', 'mountains'];
/** Anel de fora: mais florestas, para a ilha parecer uma mata grande. */
const OUTER_BIOMES: BiomeId[] = ['forest', 'forest', 'jungle', 'taiga', 'savanna', 'desert', 'swamp', 'mountains', 'forest'];

/** Gerador pseudo-aleatório com semente (o mesmo mapa para todos numa sala multiplayer). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Transforma um texto (código da sala) numa semente numérica. */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface BiomeCenter { x: number; z: number; biome: BiomeId }

export interface BiomeLayout {
  seed: number;
  /** Deslocamento pequeno derivado da semente, usado nos ruídos. */
  offset: number;
  centers: BiomeCenter[];
}

/**
 * Espalha um "centro" para cada bioma pela ilha, como regiões de um mapa.
 * A planície fica sempre no meio (onde o jogador nasce); os outros biomas
 * são sorteados em volta, então cada partida tem um mapa diferente.
 */
export function buildBiomeLayout(seed: number): BiomeLayout {
  const rand = mulberry32(seed);
  const shuffle = (list: BiomeId[]) => {
    const order = [...list];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  const centers: BiomeCenter[] = [{ x: 0, z: 0, biome: 'plains' }];
  const addRing = (list: BiomeId[], radius: number) => {
    const start = rand() * Math.PI * 2;
    list.forEach((biome, i) => {
      const angle = start + (i / list.length) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const r = WORLD_HALF * radius * (0.88 + rand() * 0.24);
      centers.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r, biome });
    });
  };
  addRing(shuffle(LAND_BIOMES), 0.36);
  addRing(shuffle(OUTER_BIOMES), 0.66);
  return { seed, offset: (seed % 997) * 1.731, centers };
}

function hash2(x: number, z: number, s: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + s) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, z: number, scale: number, s: number): number {
  const sx = x / scale, sz = z / scale;
  const ix = Math.floor(sx), iz = Math.floor(sz);
  const fx = sx - ix, fz = sz - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}

/** 0 no centro da ilha, 1 na borda. */
export function islandDistance(x: number, z: number): number {
  return Math.sqrt(x * x + z * z) / WORLD_HALF;
}

/** 1 em terra firme, cai para 0 perto do mar. */
export function islandMask(x: number, z: number, layout: BiomeLayout): number {
  const wobble = (valueNoise(x, z, 14, layout.offset + 777) - 0.5) * 0.16;
  const d = islandDistance(x, z) + wobble;
  const t = Math.min(1, Math.max(0, (d - 0.7) / (0.97 - 0.7)));
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Peso de cada bioma numa coluna. As bordas são "tortas" (ruído) para não
 * parecerem linhas retas, e o relevo mistura os biomas vizinhos para não
 * formar paredões na divisa.
 */
export function biomeWeights(x: number, z: number, layout: BiomeLayout): { biome: BiomeId; weight: number }[] {
  const wx = x + (valueNoise(x, z, 14, layout.offset + 11) - 0.5) * 16;
  const wz = z + (valueNoise(x, z, 14, layout.offset + 23) - 0.5) * 16;
  const dists = layout.centers.map(c => Math.hypot(wx - c.x, wz - c.z));
  const min = Math.min(...dists);
  const raw = dists.map(d => Math.exp(-(d - min) / 3.2));
  const total = raw.reduce((a, b) => a + b, 0);
  return layout.centers.map((c, i) => ({ biome: c.biome, weight: raw[i] / total }));
}

/** Bioma principal (de terra) de uma coluna, sem considerar praia/oceano. */
export function landBiomeAt(x: number, z: number, layout: BiomeLayout): BiomeId {
  const w = biomeWeights(x, z, layout);
  let best = w[0];
  for (const item of w) if (item.weight > best.weight) best = item;
  return best.biome;
}

/** Altura do terreno numa coluna (já com a ilha e a mistura entre biomas). */
export function heightAt(x: number, z: number, layout: BiomeLayout): number {
  const n = valueNoise(x, z, 12, layout.offset) * 0.55 + valueNoise(x, z, 6, layout.offset + 50) * 0.3 + valueNoise(x, z, 3, layout.offset + 90) * 0.15;
  let h = 0;
  for (const { biome, weight } of biomeWeights(x, z, layout)) {
    if (weight < 0.01) continue;
    const info = BIOMES[biome];
    const shaped = biome === 'mountains' ? Math.pow(n, 1.4) : n;
    h += (info.base + info.amp * shaped) * weight;
  }
  const mask = islandMask(x, z, layout);
  // Altura relativa (1 = fundo do mar, ~4 = praia); somada à base do subsolo
  return SURFACE_BASE + Math.min(26, Math.floor(1 + (h - 1) * mask));
}

/** Bioma que o jogador vê no HUD, incluindo praia e oceano. */
export function biomeAt(x: number, z: number, layout: BiomeLayout): BiomeId {
  const bx = Math.floor(x), bz = Math.floor(z);
  if (Math.abs(bx) >= WORLD_HALF || Math.abs(bz) >= WORLD_HALF) return 'ocean';
  const h = heightAt(bx, bz, layout);
  const land = landBiomeAt(bx, bz, layout);
  if (h <= WATER_LEVEL - 1 && islandMask(bx, bz, layout) < 0.6) return 'ocean';
  if (h <= WATER_LEVEL + 1 && islandMask(bx, bz, layout) < 0.9 && land !== 'taiga' && land !== 'mountains' && land !== 'swamp') return 'beach';
  return land;
}
