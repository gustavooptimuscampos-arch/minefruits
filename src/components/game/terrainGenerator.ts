import { BlockType, Fruit, FruitType, GameCoin, GRASS_BLOCKS, PLANT_BLOCKS } from './types';
import { World } from './world';
import { BIOMES, BiomeId, BiomeLayout, CAVE_TOP, SURFACE_BASE, WATER_LEVEL, WORLD_HALF, WORLD_SIZE, biomeAt, heightAt, islandMask, landBiomeAt, mulberry32 } from './biomes';

function noise2D(x: number, z: number, seed = 0): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number, scale: number, seed = 0): number {
  const sx = x / scale;
  const sz = z / scale;
  const ix = Math.floor(sx);
  const iz = Math.floor(sz);
  const fx = sx - ix;
  const fz = sz - iz;
  const smoothFx = fx * fx * (3 - 2 * fx);
  const smoothFz = fz * fz * (3 - 2 * fz);
  const a = noise2D(ix, iz, seed);
  const b = noise2D(ix + 1, iz, seed);
  const c = noise2D(ix, iz + 1, seed);
  const d = noise2D(ix + 1, iz + 1, seed);
  return a * (1 - smoothFx) * (1 - smoothFz) +
    b * smoothFx * (1 - smoothFz) +
    c * (1 - smoothFx) * smoothFz +
    d * smoothFx * smoothFz;
}

function fbm(x: number, z: number, octaves: number, seed = 0): number {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, z * frequency, 8, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

function cave3D(x: number, y: number, z: number, seed = 0): number {
  const n1 = Math.sin(x * 0.4 + seed) * Math.cos(z * 0.4 + seed) * Math.sin(y * 0.5 + seed);
  const n2 = Math.sin(x * 0.15 + y * 0.2 + seed * 2) * Math.cos(z * 0.15 + y * 0.3);
  return (n1 + n2) * 0.5;
}

/** Ruído 3D suave (para os túneis das cavernas). */
function hash3(x: number, y: number, z: number, s: number): number {
  const n = Math.sin(x * 12.9898 + y * 39.346 + z * 78.233 + s) * 43758.5453;
  return n - Math.floor(n);
}

function noise3(x: number, y: number, z: number, scale: number, s: number): number {
  const fx0 = x / scale, fy0 = y / scale, fz0 = z / scale;
  const ix = Math.floor(fx0), iy = Math.floor(fy0), iz = Math.floor(fz0);
  const fx = fx0 - ix, fy = fy0 - iy, fz = fz0 - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, s);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), ux), lerp(c(0, 1, 0), c(1, 1, 0), ux), uy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), ux), lerp(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz,
  );
}

function leafBlob(world: World, cx: number, cy: number, cz: number, radius: number, type: BlockType, flat = false) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = flat ? 0 : -1; dy <= (flat ? 0 : 2); dy++) {
        const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
        if (dist <= radius + (flat ? 0 : 1)) world.rawSetIfEmpty(cx + dx, cy + dy, cz + dz, type);
      }
    }
  }
}

/** Árvore (ou cacto) do jeito de cada bioma. */
function placeTree(world: World, x: number, groundY: number, z: number, biome: BiomeId, r: number) {
  const top = groundY + 1;
  const trunk = (y: number, type: BlockType = 'wood', dx = 0) => world.rawSet(x + dx, y, z, type);
  switch (biome) {
    case 'desert': {
      const h = 2 + Math.floor(r * 2);
      for (let y = top; y < top + h; y++) trunk(y, 'cactus');
      return;
    }
    case 'taiga':
    case 'mountains': {
      // Pinheiro: tronco alto e copa em cone
      const h = 5 + Math.floor(r * 3);
      for (let y = top; y < top + h; y++) trunk(y);
      const crown = top + h;
      world.rawSetIfEmpty(x, crown, z, 'spruce_leaves');
      for (let layer = 0; layer < 4; layer++) {
        const radius = layer === 0 ? 1 : layer % 2 === 1 ? 2 : 1;
        const y = crown - 1 - layer;
        for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
          world.rawSetIfEmpty(x + dx, y, z + dz, 'spruce_leaves');
        }
      }
      return;
    }
    case 'jungle': {
      const h = 7 + Math.floor(r * 4);
      for (let y = top; y < top + h; y++) trunk(y);
      leafBlob(world, x, top + h, z, 3, 'jungle_leaves');
      return;
    }
    case 'savanna': {
      // Acácia: tronco torto e copa achatada
      const h = 4 + Math.floor(r * 2);
      const lean = r > 0.5 ? 1 : -1;
      for (let i = 0; i < h; i++) trunk(top + i, 'wood', i >= h - 2 ? lean : 0);
      leafBlob(world, x + lean, top + h, z, 2, 'acacia_leaves', true);
      leafBlob(world, x + lean, top + h + 1, z, 1, 'acacia_leaves', true);
      return;
    }
    case 'swamp': {
      const h = 4 + Math.floor(r * 2);
      for (let y = top; y < top + h; y++) trunk(y);
      leafBlob(world, x, top + h - 1, z, 3, 'leaves', true);
      leafBlob(world, x, top + h, z, 2, 'leaves', true);
      return;
    }
    default: {
      // Floresta e planície: carvalho, e na floresta às vezes bétula (tronco branco)
      const birch = biome === 'forest' && r > 0.6;
      const h = (birch ? 5 : 4) + Math.floor(r * 2);
      for (let y = top; y < top + h; y++) trunk(y, birch ? 'birch_wood' : 'wood');
      leafBlob(world, x, top + h - 1, z, 2, 'leaves');
    }
  }
}

/** Minério conforme a profundidade (diamante só lá no fundo, perto das cavernas). */
function oreAt(x: number, y: number, z: number, surface: number, s: number): BlockType {
  if (y > surface - 4) return 'stone';
  const n = noise2D(x * 3 + y * 7, z * 3 + y * 5, 500 + s);
  if (y <= 7 && n > 0.93) return 'diamond_ore';
  if (y <= 4 && noise2D(x * 5, z * 5 + y, 600 + s) > 0.95) return 'obsidian';
  if (y <= 13 && n > 0.9) return 'gold_ore';
  if (y <= 16 && noise2D(x * 4, z * 4 + y, 700 + s) > 0.9) return 'lapis_ore';
  if (y <= 26 && n > 0.85) return 'iron_ore';
  if (y <= 30 && noise2D(x * 3 + y, z * 3, 800 + s) > 0.87) return 'copper_ore';
  if (n > 0.82) return 'coal_ore';
  return 'stone';
}

/**
 * Ravinas: rachaduras longas e fundas no subsolo, com paredes cheias de minério.
 * Ficam abaixo de CAVE_TOP, então só aparecem depois de cavar uns 30 blocos.
 */
function carveRavines(world: World, layout: BiomeLayout) {
  const rand = mulberry32(layout.seed + 303);
  const count = 4;
  for (let i = 0; i < count; i++) {
    const angle0 = rand() * Math.PI * 2;
    const r0 = WORLD_HALF * (0.15 + rand() * 0.45);
    let cx = Math.cos(angle0) * r0, cz = Math.sin(angle0) * r0;
    let dir = rand() * Math.PI * 2;
    const length = 30 + Math.floor(rand() * 25);
    const floor = 2 + Math.floor(rand() * 2);
    for (let t = 0; t < length; t++) {
      if (t === Math.floor(length / 2)) world.ravineSpots.push([Math.round(cx), floor, Math.round(cz)]);
      const k = Math.sin((Math.PI * t) / length); // mais larga e alta no meio
      const width = 1 + 1.8 * k;
      const ceil = floor + 3 + Math.round((CAVE_TOP - floor - 2) * k);
      for (let y = floor; y <= ceil; y++) {
        // Paredes um pouco inclinadas: mais estreita embaixo
        const w = width * (0.55 + 0.45 * ((y - floor) / Math.max(1, ceil - floor)));
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
          const x = Math.round(cx) + dx, z = Math.round(cz) + dz;
          if (Math.hypot(x - cx, z - cz) > w) continue;
          if (y >= world.groundHeight(x, z) - 6) continue; // nunca abre na superfície
          world.rawSet(x, y, z, null);
        }
      }
      dir += (rand() - 0.5) * 0.25;
      cx += Math.cos(dir);
      cz += Math.sin(dir);
      if (Math.abs(cx) > WORLD_HALF - 6 || Math.abs(cz) > WORLD_HALF - 6) break;
    }
  }
}

/**
 * Gera a ilha com vários biomas (planície no meio e os outros em volta) e
 * o subsolo: pedra com minérios, cavernas, ravinas e bedrock no fundo.
 * A mesma semente gera sempre o mesmo mapa.
 */
export function generateTerrain(layout: BiomeLayout, size = WORLD_SIZE): World {
  const world = new World(size);
  const half = Math.floor(size / 2);
  const s = layout.offset;
  const heights = new Map<string, number>();
  const surfaceBiome = new Map<string, BiomeId>();

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const height = heightAt(x, z, layout);
      const biome = biomeAt(x, z, layout);
      const land = landBiomeAt(x, z, layout);
      heights.set(`${x},${z}`, height);
      surfaceBiome.set(`${x},${z}`, biome);
      const info = BIOMES[biome];
      const snowCap = land === 'mountains' && height >= SURFACE_BASE + 14;

      for (let y = 0; y <= height; y++) {
        // Fundo do mundo: bedrock (não quebra)
        if (y === 0 || (y === 1 && noise2D(x, z, 42 + s) > 0.5)) {
          world.rawSet(x, y, z, 'bedrock');
          continue;
        }
        // Cavernas: túneis compridos lá embaixo
        if (y >= 2 && y <= CAVE_TOP && y < height - 8) {
          // Coordenadas giradas para os túneis não seguirem uma grade
          const rx = x * 0.8 + z * 0.6, rz = z * 0.8 - x * 0.6;
          const a = noise3(rx, y * 1.6, rz, 9, 91 + s);
          const b = noise3(rz, y * 1.6, rx, 9, 191 + s);
          if (Math.abs(a - 0.5) < 0.055 && Math.abs(b - 0.5) < 0.09) continue;
          if (noise3(rz, y, rx, 6, 291 + s) > 0.78) continue; // salões maiores
        }

        let type: BlockType;
        if (y === height) {
          type = snowCap ? 'snow' : info.surface;
          // Montanha: um pouco de grama nas partes baixas
          if (land === 'mountains' && height < SURFACE_BASE + 9 && noise2D(x, z, 321 + s) > 0.4) type = 'grass';
        } else if (y >= height - 2) {
          type = info.subsurface;
        } else {
          type = oreAt(x, y, z, height, s);
        }
        world.rawSet(x, y, z, type);
      }

      // Água (mar, lagos e poças do pântano); na taiga a beira congela
      if (height < WATER_LEVEL) {
        for (let y = height + 1; y <= WATER_LEVEL; y++) {
          const frozen = y === WATER_LEVEL && land === 'taiga' && islandMask(x, z, layout) > 0.5;
          world.rawSet(x, y, z, frozen ? 'ice' : 'water');
        }
        if (land !== 'swamp' && land !== 'taiga') world.rawSet(x, height, z, 'sand');
      }
    }
  }

  carveRavines(world, layout);

  // Árvores, cactos e flores conforme o bioma
  const taken = new Set<string>();
  for (let x = -half + 2; x < half - 2; x++) {
    for (let z = -half + 2; z < half - 2; z++) {
      const biome = surfaceBiome.get(`${x},${z}`)!;
      const info = BIOMES[biome];
      const groundY = heights.get(`${x},${z}`)!;
      if (groundY <= WATER_LEVEL) continue;
      const surface = world.get(x, groundY, z);
      if (!surface || surface === 'water' || surface === 'ice') continue;
      const r = noise2D(x, z, 999 + s);

      if (r < info.treeChance) {
        // Distância mínima entre árvores
        let near = false;
        for (let dx = -2; dx <= 2 && !near; dx++) for (let dz = -2; dz <= 2; dz++) if (taken.has(`${x + dx},${z + dz}`)) { near = true; break; }
        if (near) continue;
        // Não nasce árvore no centro, onde o jogador aparece
        if (Math.abs(x) <= 2 && Math.abs(z) <= 2) continue;
        taken.add(`${x},${z}`);
        placeTree(world, x, groundY, z, biome === 'mountains' && groundY >= SURFACE_BASE + 14 ? 'taiga' : biome, noise2D(x, z, 888 + s));
      } else if (noise2D(x, z, 555 + s) < info.flowerChance && GRASS_BLOCKS.includes(surface)) {
        world.rawSetIfEmpty(x, groundY + 1, z, 'flower');
      }
    }
  }

  return world;
}

// Generate Nether dimension
export function generateNether(size = 24): Record<string, BlockType> {
  const blocks: Record<string, BlockType> = {};
  const half = Math.floor(size / 2);

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const height = Math.floor(3 + fbm(x, z, 3, 1000) * 6);

      for (let y = 0; y <= height; y++) {
        const caveValue = cave3D(x, y, z, 1000);
        if (y > 0 && y < height - 1 && caveValue > 0.3) continue;

        let type: BlockType = 'netherrack';

        if (y <= 2) {
          const oreNoise = noise2D(x * 4 + y, z * 4, 1100);
          if (oreNoise > 0.9) type = 'netherite_ore';
          else if (oreNoise > 0.85) type = 'nether_brick';
        }

        if (y === height && noise2D(x, z, 1200) > 0.85) {
          type = 'glowstone';
        }

        blocks[`${x},${y},${z}`] = type;
      }

      // Ceiling at y=15
      for (let y = 13; y <= 15; y++) {
        const cVal = cave3D(x, y, z, 1050);
        if (cVal < 0.2) {
          blocks[`${x},${y},${z}`] = 'netherrack';
          if (noise2D(x + y, z, 1300) > 0.8) {
            blocks[`${x},${y},${z}`] = 'glowstone';
          }
        }
      }
    }
  }

  return blocks;
}

export function getGroundHeight(x: number, z: number, world: World): number {
  return world.groundHeight(x, z);
}

/** Colunas de terra firme (sem água, longe da borda) para espalhar frutas e moedas. */
function landSpots(world: World, rand: () => number, count: number, minDist: number): [number, number][] {
  const spots: [number, number][] = [];
  const range = WORLD_HALF - 4;
  for (let tries = 0; tries < count * 60 && spots.length < count; tries++) {
    const x = Math.floor((rand() * 2 - 1) * range);
    const z = Math.floor((rand() * 2 - 1) * range);
    if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;
    const g = world.groundHeight(x, z);
    const top = world.get(x, g - 1, z);
    if (g <= WATER_LEVEL + 1 || !top || top === 'water' || top === 'ice' || PLANT_BLOCKS.includes(top)) continue;
    if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < minDist)) continue;
    spots.push([x, z]);
  }
  return spots;
}

/** Onde fica cada fruta especial: no bioma que combina com ela. */
const FRUIT_HOMES: [FruitType, BiomeId][] = [['flame', 'desert'], ['ice', 'taiga'], ['rubber', 'jungle'], ['light', 'mountains']];

function isGoodSpot(world: World, x: number, z: number) {
  const g = world.groundHeight(x, z);
  const top = world.get(x, g - 1, z);
  return g > WATER_LEVEL + 1 && !!top && top !== 'water' && top !== 'ice' && !PLANT_BLOCKS.includes(top);
}

/** Procura, em espiral a partir do centro do bioma, um lugar firme dentro dele. */
function spotInBiome(world: World, layout: BiomeLayout, biome: BiomeId, highest: boolean): [number, number] | null {
  const center = layout.centers.find(c => c.biome === biome);
  if (!center) return null;
  let best: [number, number] | null = null;
  let bestH = -1;
  for (let r = 0; r <= 14; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = Math.round(center.x) + dx, z = Math.round(center.z) + dz;
      if (Math.abs(x) >= WORLD_HALF - 3 || Math.abs(z) >= WORLD_HALF - 3) continue;
      if (biomeAt(x, z, layout) !== biome || !isGoodSpot(world, x, z)) continue;
      if (!highest) return [x, z];
      const h = world.groundHeight(x, z);
      if (h > bestH) { bestH = h; best = [x, z]; }
    }
  }
  return best;
}

/**
 * As frutas ficam em lugares difíceis, cada uma protegida por um Guardião:
 * Fogo no deserto, Gelo na taiga, Borracha na selva, Luz no pico da montanha
 * e Trevas no fundo de uma ravina (só cavando ~30 blocos). Mais 3 espalhadas.
 */
export function generateFruits(world: World, seed = 1, layout?: BiomeLayout): Fruit[] {
  const fruitTypes: FruitType[] = ['flame', 'ice', 'light', 'dark', 'rubber'];
  const rand = mulberry32(seed + 101);
  const placed: { type: FruitType; position: [number, number, number] }[] = [];
  const at = (x: number, z: number): [number, number, number] => [x + 0.5, world.groundHeight(x, z) + 1.5, z + 0.5];

  if (layout) {
    for (const [type, biome] of FRUIT_HOMES) {
      const spot = spotInBiome(world, layout, biome, biome === 'mountains');
      if (spot) placed.push({ type, position: at(spot[0], spot[1]) });
    }
  }
  const ravine = world.ravineSpots.find(([x, y, z]) => world.groundHeight(x, z) - y > 12);
  if (ravine) placed.push({ type: 'dark', position: [ravine[0] + 0.5, ravine[1] + 1.5, ravine[2] + 0.5] });

  // Completa até 8 frutas em lugares aleatórios
  const extra = landSpots(world, rand, 8, 14).filter(([x, z]) => placed.every(p => Math.hypot(p.position[0] - x, p.position[2] - z) > 14));
  for (const [x, z] of extra) {
    if (placed.length >= 8) break;
    placed.push({ type: fruitTypes[placed.length % fruitTypes.length], position: at(x, z) });
  }

  return placed.map((p, i) => ({ id: `fruit-${i}`, position: p.position, type: p.type, collected: false }));
}

export function generateCoins(world: World, seed = 1): GameCoin[] {
  const rand = mulberry32(seed + 202);
  return landSpots(world, rand, 70, 5).map((pos, i) => {
    const groundY = world.groundHeight(pos[0], pos[1]);
    return {
      id: `coin-${i}`,
      position: [pos[0] + 0.5, groundY + 1.2, pos[1] + 0.5] as [number, number, number],
      collected: false,
      value: i % 5 === 0 ? 5 : 1, // Cada 5ª moeda vale 5
    };
  });
}
