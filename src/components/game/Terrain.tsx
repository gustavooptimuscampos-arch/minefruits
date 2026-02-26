import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { BlockType, BLOCK_COLORS } from './types';

interface TerrainProps {
  blocks: Record<string, BlockType>;
}

const MAX_BLOCKS = 50000;

// Only include blocks with at least one exposed face (not surrounded on all 6 sides)
function getVisibleBlocks(blocks: Record<string, BlockType>) {
  const solid: { position: THREE.Vector3; type: BlockType }[] = [];
  const water: { position: THREE.Vector3 }[] = [];
  const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  Object.entries(blocks).forEach(([key, type]) => {
    const [x, y, z] = key.split(',').map(Number);

    if (type === 'water') {
      water.push({ position: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5) });
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
      solid.push({ position: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), type });
    }
  });

  return { solid, water };
}

export function Terrain({ blocks }: TerrainProps) {
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);

  const { solid, water } = useMemo(() => getVisibleBlocks(blocks), [blocks]);

  useEffect(() => {
    if (!solidRef.current) return;
    const mesh = solidRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    const count = Math.min(solid.length, MAX_BLOCKS);
    mesh.count = count;

    for (let i = 0; i < count; i++) {
      const block = solid[i];
      dummy.position.copy(block.position);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const baseColor = BLOCK_COLORS[block.type] || '#808080';
      color.set(baseColor);
      const variation = (Math.sin(block.position.x * 13.7 + block.position.z * 7.3) * 0.5 + 0.5) * 0.08 - 0.04;
      color.r = Math.max(0, Math.min(1, color.r + variation));
      color.g = Math.max(0, Math.min(1, color.g + variation * 0.8));
      color.b = Math.max(0, Math.min(1, color.b + variation * 0.6));
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [solid]);

  useEffect(() => {
    if (!waterRef.current || water.length === 0) return;
    const mesh = waterRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color('#2196F3');

    mesh.count = water.length;

    water.forEach((block, i) => {
      dummy.position.copy(block.position);
      dummy.position.y -= 0.15;
      dummy.scale.set(1, 0.7, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [water]);

  return (
    <>
      <instancedMesh ref={solidRef} args={[undefined, undefined, MAX_BLOCKS]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      {water.length > 0 && (
        <instancedMesh ref={waterRef} args={[undefined, undefined, Math.max(water.length, 1)]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.55}
            color="#2196F3"
            toneMapped={false}
          />
        </instancedMesh>
      )}
    </>
  );
}
