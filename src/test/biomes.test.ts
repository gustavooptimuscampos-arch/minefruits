import { describe, it, expect } from 'vitest';
import { BIOMES, CAVE_TOP, WORLD_HALF, WATER_LEVEL, biomeAt, buildBiomeLayout, seedFromString } from '@/components/game/biomes';
import { WORLD_HEIGHT, BLOCK_TYPES as BLOCK_TYPES_FOR_TEST } from '@/components/game/world';
import { generateTerrain, generateFruits, generateCoins, getGroundHeight } from '@/components/game/terrainGenerator';
import { spawnGuardians } from '@/components/game/mobs';
import { BLOCK_DROPS, ITEM_CONFIG, UNBREAKABLE } from '@/components/game/types';

const SEEDS = [1, 42, 2026, 987654321, seedFromString('ABCDE')];

describe('mapa com biomas', () => {
  it('a mesma semente gera sempre a mesma ilha (multiplayer)', () => {
    const a = generateTerrain(buildBiomeLayout(seedFromString('XYZ12')));
    const b = generateTerrain(buildBiomeLayout(seedFromString('XYZ12')));
    expect(a.countBlocks()).toEqual(b.countBlocks());
    expect(a.groundHeight(5, 7)).toBe(b.groundHeight(5, 7));
  });

  it.each(SEEDS)('semente %s tem vários biomas de terra', (seed) => {
    const layout = buildBiomeLayout(seed);
    const found = new Set<string>();
    for (let x = -WORLD_HALF; x < WORLD_HALF; x += 2) {
      for (let z = -WORLD_HALF; z < WORLD_HALF; z += 2) found.add(biomeAt(x, z, layout));
    }
    const land = [...found].filter(b => b !== 'ocean' && b !== 'beach');
    expect(land.length).toBeGreaterThanOrEqual(7);
    expect(found.has('ocean')).toBe(true);
  });

  it.each(SEEDS)('semente %s: o centro é terra firme (o jogador nasce ali)', (seed) => {
    const layout = buildBiomeLayout(seed);
    const blocks = generateTerrain(layout);
    expect(getGroundHeight(0, 0, blocks)).toBeGreaterThan(WATER_LEVEL + 1);
    expect(biomeAt(0, 0, layout)).toBe('plains');
  });

  it.each(SEEDS)('semente %s: subsolo fundo, com cavernas/ravinas e bedrock', (seed) => {
    const world = generateTerrain(buildBiomeLayout(seed));
    // Cerca de 30 blocos entre a superfície do centro e as cavernas
    expect(world.groundHeight(0, 0) - CAVE_TOP).toBeGreaterThanOrEqual(26);
    // Bedrock em todo o fundo
    for (let x = -WORLD_HALF; x < WORLD_HALF; x += 9) for (let z = -WORLD_HALF; z < WORLD_HALF; z += 9) {
      expect(world.get(x, 0, z)).toBe('bedrock');
    }
    // Existe espaço vazio (caverna ou ravina) lá embaixo
    let air = 0;
    for (let x = -WORLD_HALF; x < WORLD_HALF; x++) for (let z = -WORLD_HALF; z < WORLD_HALF; z++) {
      for (let y = 2; y <= CAVE_TOP; y++) if (!world.get(x, y, z) && y < world.groundHeight(x, z) - 6) air++;
    }
    expect(air).toBeGreaterThan(1500);
    // Nada passa do teto do mundo
    for (let x = -WORLD_HALF; x < WORLD_HALF; x += 3) for (let z = -WORLD_HALF; z < WORLD_HALF; z += 3) {
      expect(world.groundHeight(x, z)).toBeLessThan(WORLD_HEIGHT);
    }
  });

  it('todo bloco tem cor; todo bloco quebrável vai para o inventário', () => {
    for (const t of BLOCK_TYPES_FOR_TEST) {
      if (t === 'water' || UNBREAKABLE.includes(t)) continue;
      const drop = BLOCK_DROPS[t];
      expect(drop, `drop de ${t}`).toBeTruthy();
      expect(ITEM_CONFIG[drop!], `item ${drop}`).toBeTruthy();
    }
  });

  it('quebrar um bloco atualiza o chão e marca só o chunk dele', () => {
    const world = generateTerrain(buildBiomeLayout(5));
    const g = world.groundHeight(3, 3);
    const v = world.chunkVersion(4, 4);
    const far = world.chunkVersion(0, 0);
    world.set(3, g - 1, 3, null);
    expect(world.groundHeight(3, 3)).toBeLessThan(g);
    expect(world.chunkVersion(4, 4)).toBe(v + 1);
    expect(world.chunkVersion(0, 0)).toBe(far);
  });

  it.each(SEEDS)('semente %s: frutas e moedas ficam em terra, dentro da ilha', (seed) => {
    const layout = buildBiomeLayout(seed);
    const blocks = generateTerrain(layout);
    const fruits = generateFruits(blocks, seed, layout);
    const coins = generateCoins(blocks, seed);
    expect(fruits.length).toBeGreaterThanOrEqual(6);
    expect(fruits.length).toBeLessThanOrEqual(8);
    expect(coins.length).toBeGreaterThanOrEqual(50);
    for (const item of [...fruits, ...coins]) {
      const [x, , z] = item.position;
      expect(Math.abs(x)).toBeLessThan(WORLD_HALF);
      expect(Math.abs(z)).toBeLessThan(WORLD_HALF);
      expect(getGroundHeight(x, z, blocks)).toBeGreaterThan(WATER_LEVEL);
    }
  });

  it.each(SEEDS)('semente %s: frutas em lugares difíceis, cada uma com Guardião', (seed) => {
    const layout = buildBiomeLayout(seed);
    const world = generateTerrain(layout);
    const fruits = generateFruits(world, seed, layout);
    const byType = (t: string) => fruits.filter(f => f.type === t);
    // Trevas fica lá embaixo, numa ravina (precisa cavar)
    const dark = byType('dark').find(f => world.groundHeight(f.position[0], f.position[2]) - f.position[1] > 10);
    expect(dark, 'fruta das Trevas no subsolo').toBeTruthy();
    // Fogo no deserto, Gelo na taiga, Borracha na selva, Luz na montanha
    expect(fruits.some(f => f.type === 'flame' && biomeAt(f.position[0], f.position[2], layout) === 'desert')).toBe(true);
    expect(fruits.some(f => f.type === 'ice' && biomeAt(f.position[0], f.position[2], layout) === 'taiga')).toBe(true);
    expect(fruits.some(f => f.type === 'rubber' && biomeAt(f.position[0], f.position[2], layout) === 'jungle')).toBe(true);
    expect(fruits.some(f => f.type === 'light' && biomeAt(f.position[0], f.position[2], layout) === 'mountains')).toBe(true);
    // A fruta da caverna fica num espaço vazio (dá para chegar)
    expect(world.get(Math.floor(dark!.position[0]), Math.floor(dark!.position[1]), Math.floor(dark!.position[2]))).toBeUndefined();
    const guardians = spawnGuardians(fruits, world);
    expect(guardians).toHaveLength(fruits.length);
    // Nenhum Guardião nasce dentro de bloco (senão a fruta ficava presa para sempre)
    for (const g of guardians) {
      const feet = g.position[1] - 0.8;
      expect(world.isSolid(Math.floor(g.position[0]), Math.floor(feet + 0.01), Math.floor(g.position[2])), g.id).toBe(false);
    }
    // A fruta das Trevas tem uma escada até a superfície: dá para chegar andando
    expect(fruits.length).toBe(8);
    expect(new Set(guardians.map(g => g.guardsFruit))).toEqual(new Set(fruits.map(f => f.id)));
  });

  it('todo bioma tem nome e emoji para o HUD', () => {
    for (const info of Object.values(BIOMES)) {
      expect(info.name.length).toBeGreaterThan(2);
      expect(info.emoji.length).toBeGreaterThan(0);
    }
  });
});

/** Caminhada de verdade, sem cavar: anda para o lado, sobe 1 bloco, desce qualquer altura. */
function walkable(w: ReturnType<typeof generateTerrain>, from: [number, number, number]) {
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const stand = (x: number, y: number, z: number) => w.isSolid(x, y - 1, z) && !w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z);
  const seen = new Set<string>([key(...from)]);
  const q: [number, number, number][] = [from];
  while (q.length) {
    const [x, y, z] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (Math.abs(nx) >= WORLD_HALF || Math.abs(nz) >= WORLD_HALF) continue;
      for (let ny = y + 1; ny >= Math.max(1, y - 20); ny--) {
        if (ny === y + 1 && w.isSolid(x, y + 2, z)) continue;
        if (stand(nx, ny, nz)) {
          const k = key(nx, ny, nz);
          if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nz]); }
          break;
        }
        if ((w.isSolid(nx, ny, nz) || w.isSolid(nx, ny + 1, nz)) && ny < y + 1) break;
      }
    }
  }
  return seen;
}

describe('todas as frutas dá para pegar', () => {
  it.each([1, 42, 2026])('semente %s: as 8 frutas são alcançáveis andando (a das Trevas pela escada)', (seed) => {
    const layout = buildBiomeLayout(seed);
    const world = generateTerrain(layout);
    const fruits = generateFruits(world, seed, layout);
    expect(fruits).toHaveLength(8);
    const seen = walkable(world, [0, world.groundHeight(0, 0), 0]);
    for (const f of fruits) {
      const x = Math.floor(f.position[0]), y = Math.round(f.position[1] - 1.5), z = Math.floor(f.position[2]);
      let ok = false;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -2; dy <= 1; dy++) {
        if (seen.has(`${x + dx},${y + dy},${z + dz}`)) ok = true;
      }
      expect(ok, `${f.type} em ${x},${y},${z}`).toBe(true);
    }
  });
});

import { generateStarterFruits } from '@/components/game/terrainGenerator';
describe('frutas iniciais (sem Guardião)', () => {
  it.each([1, 42, 2026])('semente %s: 5 frutas, uma de cada poder, perto do começo e em terra', (seed) => {
    const world = generateTerrain(buildBiomeLayout(seed));
    const wild = generateStarterFruits(world, seed);
    expect(wild.map(f => f.type).sort()).toEqual(['dark', 'flame', 'ice', 'light', 'rubber']);
    for (const f of wild) {
      expect(f.wild).toBe(true);
      expect(Math.hypot(f.position[0], f.position[2])).toBeLessThan(40);
      expect(getGroundHeight(f.position[0], f.position[2], world)).toBeGreaterThan(WATER_LEVEL);
    }
    // ninguém ganha Guardião para fruta inicial
    expect(spawnGuardians(generateFruits(world, seed, buildBiomeLayout(seed)), world).every(g => !g.guardsFruit?.startsWith('wild'))).toBe(true);
  });
});
