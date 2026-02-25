import { BlockType, Fruit, FruitType } from './types';

export function generateTerrain(size = 24): Record<string, BlockType> {
  const blocks: Record<string, BlockType> = {};
  const half = Math.floor(size / 2);

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const height = Math.floor(
        2 + Math.sin(x * 0.3) * Math.cos(z * 0.3) * 1.5 + Math.random() * 0.5
      );

      for (let y = 0; y <= height; y++) {
        let type: BlockType = 'stone';
        if (y === height) type = 'grass';
        else if (y >= height - 1) type = 'dirt';
        blocks[`${x},${y},${z}`] = type;
      }
    }
  }

  // Add trees
  const treePositions = [
    [-6, -4], [4, 5], [-3, 8], [7, -7], [0, -10], [-9, 2], [5, -3], [10, 8],
  ];

  treePositions.forEach(([tx, tz]) => {
    const groundKey = findGround(tx, tz, blocks);
    if (!groundKey) return;
    const groundY = parseInt(groundKey.split(',')[1]);

    // Trunk
    for (let y = groundY + 1; y <= groundY + 4; y++) {
      blocks[`${tx},${y},${tz}`] = 'wood';
    }

    // Leaves
    const topY = groundY + 4;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = 0; dy <= 1; dy++) {
          if (dx === 0 && dz === 0 && dy === 0) continue;
          blocks[`${tx + dx},${topY + dy},${tz + dz}`] = 'leaves';
        }
      }
    }
    blocks[`${tx},${topY + 2},${tz}`] = 'leaves';
  });

  return blocks;
}

function findGround(x: number, z: number, blocks: Record<string, BlockType>): string | null {
  for (let y = 20; y >= 0; y--) {
    const key = `${x},${y},${z}`;
    if (blocks[key] && blocks[key] !== 'wood' && blocks[key] !== 'leaves') return key;
  }
  return null;
}

export function getGroundHeight(x: number, z: number, blocks: Record<string, BlockType>): number {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  let maxY = 0;
  for (let y = 0; y < 20; y++) {
    if (blocks[`${bx},${y},${bz}`]) {
      maxY = y + 1;
    }
  }
  return maxY;
}

export function generateFruits(blocks: Record<string, BlockType>): Fruit[] {
  const fruitTypes: FruitType[] = ['flame', 'ice', 'light', 'dark', 'rubber'];
  const positions: [number, number][] = [
    [-5, 3], [6, -6], [3, 9], [-8, -5], [0, 0],
    [8, 3], [-4, -9], [10, -2], [-7, 7], [2, -4],
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
