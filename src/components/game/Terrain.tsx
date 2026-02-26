import { useMemo } from 'react';
import * as THREE from 'three';
import { BlockType, BLOCK_COLORS } from './types';

interface TerrainProps {
  blocks: Record<string, BlockType>;
}

// Group blocks by type for efficient rendering
function groupBlocksByType(blocks: Record<string, BlockType>) {
  const groups: Record<string, THREE.Vector3[]> = {};
  const water: THREE.Vector3[] = [];
  const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  Object.entries(blocks).forEach(([key, type]) => {
    const [x, y, z] = key.split(',').map(Number);

    if (type === 'water') {
      water.push(new THREE.Vector3(x + 0.5, y + 0.35, z + 0.5));
      return;
    }

    // Check if block has at least one exposed face
    let exposed = false;
    for (const [dx, dy, dz] of neighbors) {
      const nk = `${x + dx},${y + dy},${z + dz}`;
      const nb = blocks[nk];
      if (!nb || nb === 'water') {
        exposed = true;
        break;
      }
    }

    if (exposed) {
      if (!groups[type]) groups[type] = [];
      groups[type].push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
    }
  });

  return { groups, water };
}

function BlockGroup({ positions, color }: { positions: THREE.Vector3[]; color: string }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  
  const mergedGeometry = useMemo(() => {
    if (positions.length === 0) return null;
    
    const merged = new THREE.BufferGeometry();
    const posArr: number[] = [];
    const normalArr: number[] = [];
    const indexArr: number[] = [];
    
    const basePos = geometry.attributes.position.array;
    const baseNormal = geometry.attributes.normal.array;
    const baseIndex = geometry.index!.array;
    const vertCount = basePos.length / 3;
    
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      for (let v = 0; v < basePos.length; v += 3) {
        posArr.push(basePos[v] + p.x, basePos[v+1] + p.y, basePos[v+2] + p.z);
        normalArr.push(baseNormal[v], baseNormal[v+1], baseNormal[v+2]);
      }
      for (let j = 0; j < baseIndex.length; j++) {
        indexArr.push(baseIndex[j] + i * vertCount);
      }
    }
    
    merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normalArr, 3));
    merged.setIndex(indexArr);
    merged.computeBoundingSphere();
    
    return merged;
  }, [positions, geometry]);

  if (!mergedGeometry) return null;

  return (
    <mesh geometry={mergedGeometry} frustumCulled={false}>
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

export function Terrain({ blocks }: TerrainProps) {
  const { groups, water } = useMemo(() => groupBlocksByType(blocks), [blocks]);

  return (
    <>
      {Object.entries(groups).map(([type, positions]) => (
        <BlockGroup
          key={type}
          positions={positions}
          color={BLOCK_COLORS[type as BlockType] || '#808080'}
        />
      ))}

      {water.length > 0 && (
        <BlockGroup
          positions={water}
          color="#42A5F5"
        />
      )}
    </>
  );
}
