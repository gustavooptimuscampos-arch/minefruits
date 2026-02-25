import { BlockType, Fruit, FruitType } from './types';

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

export function generateTerrain(size = 32): Record<string, BlockType> {
  const blocks: Record<string, BlockType> = {};
  const half = Math.floor(size / 2);
  const WATER_LEVEL = 2;

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const h1 = fbm(x, z, 4, 0) * 8;
      const h2 = fbm(x, z, 2, 50) * 4;
      const mountains = Math.pow(fbm(x, z, 3, 200), 2) * 12;
      const height = Math.floor(1 + h1 + h2 + mountains);
      const maxHeight = Math.max(height, 15); // Ensure enough depth for caves

      const moisture = fbm(x, z, 2, 300);
      const isDesert = moisture < 0.3;
      const isSnow = height > 10;

      // Generate full column including underground
      for (let y = 0; y <= maxHeight; y++) {
        // Cave carving
        const caveValue = cave3D(x, y, z, 42);
        const isCave = y > 0 && y < height - 1 && caveValue > 0.35;
        
        if (isCave && y <= height) continue; // Skip block = cave

        if (y > height) continue; // Above ground

        let type: BlockType;
        if (y === 0) {
          type = 'stone';
        } else if (y === height) {
          if (isSnow) type = 'snow';
          else if (isDesert) type = 'sand';
          else type = 'grass';
        } else if (y >= height - 2) {
          if (isDesert) type = 'sand';
          else type = 'dirt';
        } else {
          type = 'stone';

          // Ore generation based on depth
          if (y <= height - 3) {
            const oreNoise = noise2D(x * 3 + y * 7, z * 3 + y * 5, 500);
            
            if (y <= 4 && oreNoise > 0.92) {
              type = 'diamond_ore';
            } else if (y <= 3 && noise2D(x * 5, z * 5 + y, 600) > 0.94) {
              type = 'obsidian';
            } else if (y <= 8 && oreNoise > 0.88) {
              type = 'gold_ore';
            } else if (y <= 10 && noise2D(x * 4, z * 4 + y, 700) > 0.87) {
              type = 'lapis_ore';
            } else if (y <= 12 && oreNoise > 0.82) {
              type = 'iron_ore';
            } else if (y <= 14 && noise2D(x * 3 + y, z * 3, 800) > 0.84) {
              type = 'copper_ore';
            } else if (oreNoise > 0.78) {
              type = 'coal_ore';
            }
          }
        }
        blocks[`${x},${y},${z}`] = type;
      }

      // Water
      if (height < WATER_LEVEL) {
        for (let y = height + 1; y <= WATER_LEVEL; y++) {
          blocks[`${x},${y},${z}`] = 'water';
        }
        if (height >= WATER_LEVEL - 1) {
          blocks[`${x},${height},${z}`] = 'sand';
        }
      }
    }
  }

  // Trees
  const treeSpacing = 5;
  for (let x = -half + 2; x < half - 2; x += treeSpacing) {
    for (let z = -half + 2; z < half - 2; z += treeSpacing) {
      const offsetX = x + Math.floor(noise2D(x, z, 999) * 3) - 1;
      const offsetZ = z + Math.floor(noise2D(x, z, 888) * 3) - 1;
      const groundKey = findGround(offsetX, offsetZ, blocks);
      if (!groundKey) continue;
      const groundType = blocks[groundKey];
      if (groundType !== 'grass') continue;
      const groundY = parseInt(groundKey.split(',')[1]);
      if (groundY <= WATER_LEVEL) continue;

      const treeHeight = 3 + Math.floor(noise2D(offsetX, offsetZ, 777) * 3);
      for (let y = groundY + 1; y <= groundY + treeHeight; y++) {
        blocks[`${offsetX},${y},${offsetZ}`] = 'wood';
      }
      const topY = groundY + treeHeight;
      const leafRadius = Math.floor(treeHeight / 2) + 1;
      for (let dx = -leafRadius; dx <= leafRadius; dx++) {
        for (let dz = -leafRadius; dz <= leafRadius; dz++) {
          for (let dy = -1; dy <= 2; dy++) {
            const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
            if (dist <= leafRadius + 1 && !(dx === 0 && dz === 0 && dy <= 0)) {
              const lKey = `${offsetX + dx},${topY + dy},${offsetZ + dz}`;
              if (!blocks[lKey]) blocks[lKey] = 'leaves';
            }
          }
        }
      }
    }
  }

  // Flowers
  for (let x = -half; x < half; x += 3) {
    for (let z = -half; z < half; z += 3) {
      if (noise2D(x, z, 555) > 0.7) {
        const gk = findGround(x, z, blocks);
        if (gk && blocks[gk] === 'grass') {
          const gy = parseInt(gk.split(',')[1]);
          if (gy > WATER_LEVEL) blocks[`${x},${gy + 1},${z}`] = 'flower';
        }
      }
    }
  }

  return blocks;
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

function findGround(x: number, z: number, blocks: Record<string, BlockType>): string | null {
  for (let y = 30; y >= 0; y--) {
    const key = `${x},${y},${z}`;
    if (blocks[key] && blocks[key] !== 'wood' && blocks[key] !== 'leaves' && blocks[key] !== 'water' && blocks[key] !== 'flower') return key;
  }
  return null;
}

export function getGroundHeight(x: number, z: number, blocks: Record<string, BlockType>): number {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  let maxY = 0;
  for (let y = 0; y < 30; y++) {
    const block = blocks[`${bx},${y},${bz}`];
    if (block && block !== 'water') maxY = y + 1;
  }
  return maxY;
}

export function generateFruits(blocks: Record<string, BlockType>): Fruit[] {
  const fruitTypes: FruitType[] = ['flame', 'ice', 'light', 'dark', 'rubber'];
  const positions: [number, number][] = [
    [-8, 5], [9, -8], [5, 12], [-12, -7], [0, 0],
    [11, 5], [-6, -12], [13, -4], [-10, 10], [3, -6],
  ];
  return positions.map((pos, i) => {
    const groundY = getGroundHeight(pos[0], pos[1], blocks);
    return {
      id: `fruit-${i}`,
      position: [pos[0] + 0.5, groundY + 1.5, pos[1] + 0.5] as [number, number, number],
      type: fruitTypes[i % fruitTypes.length],
      collected: false,
    };
  });
}
